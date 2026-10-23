import type { PrismaClient } from '@prisma/client';
import type { SessionPayload } from '../access-policy';
import { hiveScope } from '../access-policy';
import { allowedRequestOrigin } from '../request-origin';
import { boundedBody, RequestBodyError } from '../request-body';
import { decodeSignedEnvelope } from './mqtt-bridge';
import { TelemetryError } from './protocol';
import type { SignedEnvelope } from './schema';
import { TelemetryService } from './service';

type Dependencies = {
  db: PrismaClient;
  session: () => Promise<SessionPayload | null>;
  publish: (deviceId: string, envelope: SignedEnvelope) => Promise<void>;
  statusOnly?: boolean;
};
export function createGatewayHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    const response = (value: unknown, status: number) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
    try {
      const session = await dependencies.session();
      if (!session) return response({ error: 'Sign in before syncing this phone.' }, 401);
      if (!['admin', 'beekeeper'].includes(session.role) || !allowedRequestOrigin(request)
        || request.headers.get('x-gateway-account') !== session.accountId) return response({ error: 'The current account cannot sync this queue.' }, 403);
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) return response({ error: 'Expected application/json' }, 415);
      const { bytes, signature, envelope, packet } = decodeSignedEnvelope(await boundedBody(request, 8192));
      const hive = await dependencies.db.hive.findFirst({ where: { AND: [hiveScope(session), { deviceId: packet.deviceId }] }, select: { id: true } });
      if (!hive) return response({ error: 'An owned, enrolled hive is required.' }, 404);
      const result = await new TelemetryService(dependencies.db).deliveryStatus(bytes, signature);
      if (result.source === 'LEGACY') return response({ error: 'Re-enroll this legacy device before phone delivery.' }, 409);
      if (result.receipt) return response({ state: 'STORED', source: result.source, receipt: result.receipt }, 200);
      if (dependencies.statusOnly) return response({ state: 'WAITING_FOR_STORAGE', source: result.source }, 202);
      await dependencies.publish(packet.deviceId, envelope);
      return response({ state: 'BROKER_ACCEPTED', source: result.source }, 202);
    } catch (error) {
      const known = error instanceof TelemetryError || error instanceof RequestBodyError;
      return response({ error: known ? error.message : 'Gateway delivery is unavailable. Keep the packet and retry.' }, known ? error.status : 503);
    }
  };
}
