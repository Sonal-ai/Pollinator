import { createHmac, timingSafeEqual } from 'node:crypto';
import { packetHash, parsePacket, TelemetryError } from './protocol';
import { ReceiptSchema, type StoredPayload } from './schema';

export type StoredReceipt = { payload: string; signature: string };
export type ReceiptIdentity = Pick<StoredPayload, 'deviceId' | 'epoch' | 'sequence' | 'packetHash'>;

function receiptMac(bytes: Buffer, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new TelemetryError('Invalid receipt signing credential', 503);
  return createHmac('sha256', Buffer.from(secret, 'hex'))
    .update('honey-chain-stored-v1\n').update(bytes).digest();
}

/** Call only after the database commits, or after finding an identical committed row. */
export function createStoredReceipt(
  packetBytes: Buffer,
  reading: { id: string; packetHash: string | null; epoch: string | null; sequence: number | null },
  secret: string,
): StoredReceipt {
  const packet = parsePacket(packetBytes), hash = packetHash(packetBytes);
  if (reading.packetHash !== hash || reading.epoch !== packet.epoch || reading.sequence !== packet.sequence) {
    throw new TelemetryError('Stored reading does not match the packet', 503);
  }
  const receipt = ReceiptSchema.parse({ version: 1, kind: 'stored', deviceId: packet.deviceId,
    epoch: packet.epoch, sequence: packet.sequence, packetHash: hash, readingId: reading.id });
  const bytes = Buffer.from(JSON.stringify(receipt));
  return { payload: bytes.toString('base64'), signature: receiptMac(bytes, secret).toString('hex') };
}

/** Firmware must make the equivalent checks before deleting its journal entry. */
export function verifyStoredReceipt(receipt: StoredReceipt, secret: string, expected: ReceiptIdentity): boolean {
  try {
    if (typeof receipt.payload !== 'string' || receipt.payload.length > 2048
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(receipt.payload) || !/^[a-f0-9]{64}$/.test(receipt.signature)) return false;
    const bytes = Buffer.from(receipt.payload, 'base64');
    if (bytes.toString('base64') !== receipt.payload) return false;
    if (!timingSafeEqual(Buffer.from(receipt.signature, 'hex'), receiptMac(bytes, secret))) return false;
    const stored = ReceiptSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    return stored.deviceId === expected.deviceId && stored.epoch === expected.epoch
      && stored.sequence === expected.sequence && stored.packetHash === expected.packetHash;
  } catch { return false; }
}
