import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PacketSchema } from './schema';
import type { TelemetryPacket } from './schema';
export { MetricsSchema, PacketSchema } from './schema';
export type { TelemetryPacket } from './schema';

export class TelemetryError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export function packetHash(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex'); }
export function signPacket(bytes: Buffer, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new TelemetryError('Invalid device signing credential', 503);
  return createHmac('sha256', Buffer.from(secret, 'hex')).update('honey-chain-telemetry-v1\n').update(bytes).digest('hex');
}
export function verifyPacket(bytes: Buffer, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signPacket(bytes, secret), 'hex'));
}
export function parsePacket(bytes: Buffer): TelemetryPacket {
  if (bytes.length > 4096) throw new TelemetryError('Telemetry packets must be at most 4096 bytes', 413);
  try { return PacketSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
  catch { throw new TelemetryError('Invalid version-1 telemetry packet'); }
}
export function checkPacketTime(packet: TelemetryPacket, now: Date) {
  const age = now.getTime() - Date.parse(packet.observedAt);
  if (age < -5 * 60_000 || age > 7 * 86400_000) throw new TelemetryError('Packet time is outside the seven-day offline / five-minute clock-skew window');
}
export function mqttDeviceTopic(deviceId: string) { return `honeychain/v1/devices/${deviceId}/telemetry`; }
