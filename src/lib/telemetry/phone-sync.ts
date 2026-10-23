import { z } from 'zod';
import { SignedEnvelopeSchema, type SignedEnvelope } from './schema';
import type { StoredReceipt } from './acknowledgement';
import type { GatewayRecord, LocalGatewayQueue } from './local-queue';

const ReplySchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('STORED'), source: z.enum(['DEVICE', 'SIMULATED']), receipt: SignedEnvelopeSchema }).strict(),
  z.object({ state: z.literal('BROKER_ACCEPTED'), source: z.enum(['DEVICE', 'SIMULATED']) }).strict(),
  z.object({ state: z.literal('WAITING_FOR_STORAGE'), source: z.enum(['DEVICE', 'SIMULATED']) }).strict(),
]);
export type GatewayReply = z.infer<typeof ReplySchema>;
export async function requestGateway(owner: string, envelope: SignedEnvelope, statusOnly: boolean, signal: AbortSignal): Promise<GatewayReply> {
  const response = await fetch(statusOnly ? '/api/iot/gateway/receipt' : '/api/iot/gateway', {
    method: 'POST', credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', 'X-Gateway-Account': owner }, body: JSON.stringify(envelope),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error.slice(0, 240) : 'Cannot sync now. Keep the packet and retry.';
    throw new Error(error);
  }
  const reply = ReplySchema.parse(data);
  if (reply.state === 'STORED' ? response.status !== 200 : response.status !== 202) throw new Error('Unexpected storage acknowledgement. The packet was kept.');
  return reply;
}
export function syncDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancelled = () => { clearTimeout(timer); reject(new DOMException('Sync cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve(); }, ms);
    if (signal.aborted) cancelled(); else signal.addEventListener('abort', cancelled, { once: true });
  });
}
type Options = {
  deviceId: string; signal: AbortSignal;
  request: (envelope: SignedEnvelope, statusOnly: boolean) => Promise<GatewayReply>;
  acknowledge: (record: GatewayRecord, receipt: StoredReceipt) => Promise<boolean>;
  updated: () => Promise<void>;
  delay?: (ms: number, signal: AbortSignal) => Promise<void>;
};
export async function syncPhoneQueue(queue: LocalGatewayQueue, options: Options) {
  const records = (await queue.list()).filter(record => record.deviceId === options.deviceId).slice(0, 10);
  const delay = options.delay || syncDelay;
  let stored = 0, receiptsSent = 0;
  for (const record of records) {
    options.signal.throwIfAborted();
    try {
      let receipt = record.receipt;
      if (!receipt) {
        let reply = await options.request(record.envelope, false);
        for (let attempt = 0; reply.state !== 'STORED' && attempt < 4; attempt++) {
          await delay(1000, options.signal);
          reply = await options.request(record.envelope, true);
        }
        if (reply.state !== 'STORED') throw new Error('MQTT accepted the packet; database storage is still pending. The phone and hive must keep their copies.');
        receipt = reply.receipt;
        await queue.attachReceipt(record.id, receipt);
        stored++;
        await options.updated();
      }
      options.signal.throwIfAborted();
      if (await options.acknowledge(record, receipt)) {
        await queue.removeStored(record.id); receiptsSent++;
      }
      await options.updated();
      if (!record.receipt) await delay(2500, options.signal);
    } catch (error) {
      await queue.recordError(record.id, options.signal.aborted ? 'Sync cancelled. Saved packet retained.' : error instanceof Error ? error.message : 'Delivery failed. Saved packet retained.');
      await options.updated();
      throw error;
    }
  }
  return { stored, receiptsSent };
}
