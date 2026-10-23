import type { MqttClient, IPublishPacket } from 'mqtt';
import { mqttDeviceTopic, parsePacket, TelemetryError } from './protocol';
import type { TelemetryService } from './service';
import { SignedEnvelopeSchema } from './schema';

export function decodeSignedEnvelope(payload: Buffer) {
  if (payload.length > 8192) throw new TelemetryError('Envelope too large', 413);
  let envelope;
  try { envelope = SignedEnvelopeSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload))); }
  catch { throw new TelemetryError('Invalid signed envelope'); }
  const bytes = Buffer.from(envelope.payload, 'base64');
  if (bytes.toString('base64') !== envelope.payload) throw new TelemetryError('Noncanonical base64 envelope');
  const packet = parsePacket(bytes);
  return { bytes, signature: envelope.signature, envelope, packet };
}
export function decodeMqttPacket(topic: string, payload: Buffer) {
  const decoded = decodeSignedEnvelope(payload);
  if (topic !== mqttDeviceTopic(decoded.packet.deviceId)) throw new TelemetryError('Topic does not match the signed device', 401);
  return decoded;
}

/** QoS-1 PUBACK is emitted by MQTT.js only after handleMessage's callback succeeds. */
export function installTelemetryHandler(client: MqttClient, service: Pick<TelemetryService, 'ingest'>, onFatal: () => void, report: (event: string) => void = console.warn) {
  client.handleMessage = (packet: IPublishPacket, callback) => {
    void (async () => {
      try {
        if (packet.qos !== 1 || packet.retain) throw new TelemetryError('Only non-retained QoS-1 telemetry is accepted');
        const { bytes, signature } = decodeMqttPacket(packet.topic, Buffer.from(packet.payload));
        await service.ingest(bytes, signature);
        callback();
      } catch (error) {
        if (error instanceof TelemetryError && error.status < 500) {
          // Invalid messages are acknowledged to prevent a poison message from blocking the persistent session.
          report(`Rejected telemetry (${error.status}); no reading was saved.`); callback();
        } else {
          // Do not acknowledge a transient storage failure. Stop and let the service supervisor reconnect
          // the same persistent client ID; the broker can redeliver its unacknowledged QoS-1 packet.
          report('Telemetry storage unavailable; packet was not acknowledged. Restarting the bridge is required.');
          client.stream.destroy(); callback(new Error('Telemetry storage unavailable')); onFatal();
        }
      }
    })();
  };
}
