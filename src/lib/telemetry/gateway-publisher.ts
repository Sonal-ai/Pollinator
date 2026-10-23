import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import mqtt, { type MqttClient } from 'mqtt';
import { mqttDeviceTopic, TelemetryError } from './protocol';
import type { SignedEnvelope } from './schema';

export function gatewayMqttOptions(environment = process.env) {
  let url: URL;
  try { url = new URL(environment.IOT_GATEWAY_MQTT_URL || ''); }
  catch { throw new TelemetryError('The MQTT phone gateway is not configured.', 503); }
  if (url.protocol !== 'mqtts:' || url.username || url.password || url.pathname && url.pathname !== '/' || url.search || url.hash) {
    throw new TelemetryError('The phone gateway requires a TLS broker without URL credentials.', 503);
  }
  const certificate = (name: string) => {
    const file = environment[name];
    if (!file) throw new TelemetryError('The phone gateway requires its own MQTT client certificate.', 503);
    return readFileSync(file);
  };
  return { url: url.toString(), options: {
    clientId: 'honeychain-gateway-' + randomUUID(), clean: true, protocolVersion: 5 as const,
    manualConnect: true, reconnectPeriod: 0, connectTimeout: 8000, queueQoSZero: false, rejectUnauthorized: true,
    ca: certificate('IOT_GATEWAY_MQTT_CA'), cert: certificate('IOT_GATEWAY_MQTT_CERT'), key: certificate('IOT_GATEWAY_MQTT_KEY'),
  } };
}

/** A broker PUBACK means accepted for delivery, never database persistence. */
export async function publishGatewayPacket(deviceId: string, envelope: SignedEnvelope) {
  const { url, options } = gatewayMqttOptions();
  const client: MqttClient = mqtt.connect(url, options);
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (error) reject(new TelemetryError('MQTT delivery is unavailable. Keep the packet and retry.', 503)); else resolve();
      };
      const timer = setTimeout(() => { finish(new Error('timeout')); client.stream?.destroy(); }, 12000);
      client.on('error', () => finish(new Error('broker error')));
      client.on('close', () => finish(new Error('connection closed')));
      client.once('connect', () => {
        if (settled) return;
        client.publish(mqttDeviceTopic(deviceId), JSON.stringify(envelope), { qos: 1, retain: false }, (error, packet) => {
          const reason = packet && 'reasonCode' in packet ? packet.reasonCode : 0;
          finish(error || typeof reason === 'number' && reason >= 128 ? new Error('publish rejected') : undefined);
        });
      });
      client.connect();
    });
  } finally { await client.endAsync(true); }
}
