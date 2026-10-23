import { getSession } from '@/lib/auth';
import { hiveScope } from '@/lib/access-policy';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { estimateProductivity } from '@/lib/productivity';

// ============================================================
// GET /api/iot/[hiveId] — Historical sensor readings for charts
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hiveId: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'beekeeper'].includes(session.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { hiveId } = await params;
  const period = request.nextUrl.searchParams.get('period') ?? '7d';
  const source = request.nextUrl.searchParams.get('source') ?? 'DEVICE';
  if (!['DEVICE', 'SIMULATED', 'LEGACY'].includes(source)) return Response.json({ error: 'Unknown telemetry source' }, { status: 422 });

  // Convert period to milliseconds
  const periodMap: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const ms = periodMap[period] ?? periodMap['7d'];
  const since = new Date(Date.now() - ms);

  const hive = await prisma.hive.findFirst({
    where: { AND: [hiveScope(session), { OR: [{ id: hiveId }, { deviceId: hiveId }] }] },
    include: { beekeeper: { select: { name: true } } },
  });

  if (!hive) return Response.json({ error: 'Hive not found' }, { status: 404 });

  const readings = await prisma.sensorReading.findMany({
    where: { hiveId: hive.id, timestamp: { gte: since, lte: new Date() }, source: source as 'DEVICE' | 'SIMULATED' | 'LEGACY' },
    orderBy: { timestamp: 'desc' },
    take: 5001,
    select: {
      timestamp: true,
      tempC: true,
      humidityPct: true,
      weightKg: true,
      pressureHPa: true,
      batteryPct: true,
      source: true,
      receivedAt: true,
    },
  });
  const truncated = readings.length > 5000;
  readings.splice(5000);
  readings.reverse();

  // Compute summary statistics
  const temps     = readings.map((r) => r.tempC).filter((v): v is number => v !== null);
  const weights   = readings.map((r) => r.weightKg).filter((v): v is number => v !== null);
  const humidities = readings.map((r) => r.humidityPct).filter((v): v is number => v !== null);

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const summary = {
    avgTempC:        avg(temps),
    avgHumidityPct:  avg(humidities),
    weightGainKg:    weights.length >= 2 ? weights[weights.length - 1] - weights[0] : null,
    latestWeightKg:  weights.length ? weights[weights.length - 1] : null,
    readingCount:    readings.length,
    period,
    source,
    truncated,
  };

  return Response.json({ hive, readings, summary, productivity: estimateProductivity(readings, source) });
}
