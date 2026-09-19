import crypto from 'crypto';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

const SensorReadingSchema = z.object({
  hiveId:       z.string().min(1),       // deviceId (not DB id)
  deviceId:     z.string().min(1),
  temperatureC: z.number().min(-10).max(60).optional(),
  humidityPct:  z.number().min(0).max(100).optional(),
  weightKg:     z.number().min(0).max(500).optional(),
  pressureHPa:  z.number().min(800).max(1100).optional(),
  batteryPct:   z.number().min(0).max(100).optional(),
  timestamp:    z.string().datetime({ offset: true }).optional(),
});

// ============================================================
// POST /api/sensor-data — IoT telemetry ingestion from ESP32
// ============================================================

export async function POST(request: NextRequest) {
  // Device authentication: shared secret in Authorization header (timing-safe comparison)
  const authHeader = request.headers.get('authorization') ?? '';
  const deviceSecret = authHeader.replace(/^Bearer\s+/i, '').trim();
  const expectedSecret = process.env.IOT_DEVICE_SECRET || 'pollinator-iot-device-secret';

  if (!deviceSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const secretBuffer = Buffer.from(deviceSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (
    secretBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(secretBuffer, expectedBuffer)
  ) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SensorReadingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { hiveId: deviceId, temperatureC, humidityPct, weightKg, pressureHPa, batteryPct, timestamp } = parsed.data;

  // Look up the hive by deviceId
  const hive = await prisma.hive.findUnique({ where: { deviceId } });
  if (!hive) {
    return Response.json({ error: `Hive with deviceId ${deviceId} not registered` }, { status: 404 });
  }

  // Anomaly detection: flag implausible readings
  const anomalies: string[] = [];
  if (temperatureC !== undefined && (temperatureC < 0 || temperatureC > 50)) {
    anomalies.push(`Temperature out of range: ${temperatureC}°C`);
  }
  if (humidityPct !== undefined && (humidityPct < 10 || humidityPct > 99)) {
    anomalies.push(`Humidity out of range: ${humidityPct}%`);
  }

  // Fetch previous reading to compute weight trends and delta
  const previousReading = await prisma.sensorReading.findFirst({
    where: { hiveId: hive.id },
    orderBy: { timestamp: 'desc' },
  });

  // Store reading
  const reading = await prisma.sensorReading.create({
    data: {
      hiveId:      hive.id,
      tempC:       temperatureC,
      humidityPct,
      weightKg,
      pressureHPa,
      batteryPct,
      timestamp:   timestamp ? new Date(timestamp) : new Date(),
    },
  });

  // Run AI / Bio-apiculture health assessment
  const { calculateHiveHealth } = await import('@/lib/iot-health-model');
  const healthAssessment = calculateHiveHealth({
    tempC: temperatureC ?? 35,
    humidityPct: humidityPct ?? 55,
    weightKg: weightKg ?? 40,
    batteryPct,
    previousWeightKg: previousReading?.weightKg ?? null,
  });

  return Response.json(
    {
      success: true,
      hiveId: hive.id,
      deviceId,
      readingId: reading.id,
      healthAssessment,
      anomalies: anomalies.length > 0 ? anomalies : undefined,
    },
    { status: 201 }
  );
}
