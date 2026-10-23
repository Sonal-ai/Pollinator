import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hiveScope } from '@/lib/access-policy';
import { allowedRequestOrigin } from '@/lib/request-origin';
import { boundedBody, RequestBodyError } from '@/lib/request-body';
import { MetricsSchema, signPacket, TelemetryError } from '@/lib/telemetry/protocol';
import { decryptDeviceSecret } from '@/lib/telemetry/secrets';
import { TelemetryService } from '@/lib/telemetry/service';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin','beekeeper'].includes(session.role) || !allowedRequestOrigin(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    let input: unknown;
    try { input = JSON.parse((await boundedBody(request, 4096)).toString('utf8')); } catch (error) { if (error instanceof RequestBodyError) throw error; throw new TelemetryError('Invalid JSON', 400); }
    const parsed = z.object({ deviceId: z.string().max(64), metrics: MetricsSchema }).strict().safeParse(input);
    if (!parsed.success) throw new TelemetryError('Invalid simulation values');
    const hive = await prisma.hive.findFirst({ where: { AND: [hiveScope(session), { deviceId: parsed.data.deviceId }] }, include: { deviceCredential: true } });
    const credential = hive?.deviceCredential;
    if (!credential || !credential.active || credential.source !== 'SIMULATED') throw new TelemetryError('An owned, active simulation device is required', 404);
    const secret = decryptDeviceSecret(credential.encryptedSecret, `${hive!.deviceId}:${credential.epoch}`);
    const bytes = Buffer.from(JSON.stringify({ version: 1, deviceId: hive!.deviceId, epoch: credential.epoch, sequence: randomInt(2147483648), observedAt: new Date().toISOString(), metrics: parsed.data.metrics }));
    const { reading } = await new TelemetryService(prisma).ingest(bytes, signPacket(bytes, secret));
    return Response.json({ readingId: reading.id, source: reading.source }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof TelemetryError || error instanceof RequestBodyError ? error.message : 'Simulation is unavailable' },
      { status: error instanceof TelemetryError || error instanceof RequestBodyError ? error.status : 503 });
  }
}
