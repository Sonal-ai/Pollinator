import { PacketSchema, ReceiptSchema, SignedEnvelopeSchema, type SignedEnvelope } from './schema';
import type { StoredReceipt } from './acknowledgement';

export function decodeCanonicalBase64(value: string, maximum: number) {
  if (!value || value.length > Math.ceil(maximum / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Invalid packet encoding.');
  const binary = atob(value);
  if (binary.length > maximum || btoa(binary) !== value) throw new Error('Invalid packet encoding.');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
export function decodeClientEnvelope(input: unknown) {
  const envelope = SignedEnvelopeSchema.parse(input);
  const bytes = decodeCanonicalBase64(envelope.payload, 4096);
  const packet = PacketSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  return { envelope, bytes, packet };
}
export async function clientPacketHash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** This checks routing identity only. The hive, which holds the secret, must authenticate the receipt MAC. */
export function readReceiptIdentity(receipt: StoredReceipt) {
  const envelope = SignedEnvelopeSchema.parse(receipt);
  const bytes = decodeCanonicalBase64(envelope.payload, 1024);
  return ReceiptSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}
export type BleFrame = { event: 'idle' } | SignedEnvelope;
export class BleFrameDecoder {
  private bytes: number[] = [];
  push(chunk: Uint8Array): BleFrame[] {
    if (chunk.length > 8192) { this.bytes = []; throw new Error('Hive sent an oversized BLE notification.'); }
    const frames: BleFrame[] = [];
    for (const byte of chunk) {
      if (byte === 10) {
        if (!this.bytes.length) continue;
        const line = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(this.bytes));
        this.bytes = [];
        const value: unknown = JSON.parse(line);
        if (value && typeof value === 'object' && 'event' in value && value.event === 'idle' && Object.keys(value).length === 1) frames.push({ event: 'idle' });
        else frames.push(decodeClientEnvelope(value).envelope);
      } else {
        if (byte > 127 || this.bytes.length >= 8192) { this.bytes = []; throw new Error('Hive sent an invalid or oversized BLE frame.'); }
        this.bytes.push(byte);
      }
    }
    return frames;
  }
}
