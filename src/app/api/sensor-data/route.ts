import { prisma } from '@/lib/db';
import { boundedBody, RequestBodyError } from '@/lib/request-body';
import { TelemetryError } from '@/lib/telemetry/protocol';
import { TelemetryService } from '@/lib/telemetry/service';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return Response.json({ error: 'Expected application/json' }, { status: 415 });
    const signature = request.headers.get('x-device-signature') || '';
    if (!/^[a-f0-9]{64}$/.test(signature)) return Response.json({ error: 'A device signature is required' }, { status: 401 });
    const { reading, duplicate, receipt } = await new TelemetryService(prisma).ingest(await boundedBody(request, 4096), signature);
    return Response.json({ readingId: reading.id, source: reading.source, duplicate, receivedAt: reading.receivedAt, receipt },
      { status: duplicate ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof TelemetryError || error instanceof RequestBodyError ? error.message : 'Telemetry storage is unavailable. Retry the same signed packet.' },
      { status: error instanceof TelemetryError || error instanceof RequestBodyError ? error.status : 503 });
  }
}
