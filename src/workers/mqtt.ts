import { readFileSync } from 'node:fs';
import mqtt from 'mqtt';
import { prisma } from '../lib/db';
import { TelemetryService } from '../lib/telemetry/service';
import { installTelemetryHandler } from '../lib/telemetry/mqtt-bridge';
import { heartbeat, pause, stopSignal } from './lifecycle';

async function main() {
  const url = new URL(process.env.IOT_MQTT_URL || ''), clientId = process.env.IOT_MQTT_CLIENT_ID;
  if (url.username || url.password) throw new Error('Broker credentials must not be in URLs');
  if (url.protocol !== 'mqtts:' && !(url.protocol === 'mqtt:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname) && process.env.NODE_ENV !== 'production')) throw new Error('TLS is required');
  if (!clientId || !/^[A-Za-z0-9_-]{8,80}$/.test(clientId)) throw new Error('A stable client ID is required');
  const certificate = (key: string) => process.env[key] ? readFileSync(process.env[key]!) : undefined;
  const client = mqtt.connect(url.toString(), { clientId, clean: false, protocolVersion: 4, reconnectPeriod: 5000, connectTimeout: 15000,
    ca: certificate('IOT_MQTT_CA'), cert: certificate('IOT_MQTT_CERT'), key: certificate('IOT_MQTT_KEY'), rejectUnauthorized: true,
    username: process.env.IOT_MQTT_USERNAME, password: process.env.IOT_MQTT_PASSWORD, queueQoSZero: false });
  const signal = stopSignal(); let fatal = false, subscribed = false;
  const started = Date.now();
  installTelemetryHandler(client, new TelemetryService(prisma), () => { fatal = true; });
  client.on('connect', () => { client.subscribe('honeychain/v1/devices/+/telemetry', { qos: 1 }, error => { if (error) fatal = true; else subscribed = true; }); });
  client.on('offline', () => { subscribed = false; });
  client.on('close', () => { subscribed = false; });
  client.on('error', () => { console.warn('MQTT connection unavailable; secrets and packet contents were not logged.'); });
  try {
    do {
      let databaseReady = false;
      try { await prisma.$queryRaw`SELECT 1`; databaseReady = true; } catch { /* readiness stays false */ }
      await heartbeat('mqtt', subscribed && databaseReady, subscribed && databaseReady ? 'subscribed_and_database_ready' : 'dependency_unavailable');
      if (process.argv.includes('--once') && (subscribed && databaseReady || fatal || Date.now() - started > 20000)) { if (!subscribed || !databaseReady) process.exitCode = 1; break; }
      await pause(5000, signal);
    } while (!signal.aborted && !fatal);
    if (fatal) process.exitCode = 1;
  } finally { await heartbeat('mqtt', false, 'stopped'); await client.endAsync(true); await prisma.$disconnect(); }
}
void main().catch(async () => { console.error('MQTT worker stopped because its configuration or runtime is unavailable.'); process.exitCode = 1; await prisma.$disconnect(); });
