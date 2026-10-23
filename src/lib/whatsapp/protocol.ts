import { createHash } from 'node:crypto';
import { z } from 'zod';

const id = z.string().min(1).max(256);
export const senderId = z.string().regex(/^[1-9]\d{7,14}$/);
const timestamp = z.string().regex(/^\d{1,10}$/).refine(value => Number(value) <= 4102444800);
const base = { id, from: senderId, timestamp };
const reply = z.object({ id: z.string().min(1).max(256), title: z.string().max(1024) }).passthrough();
export const incomingMessage = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('text'), text: z.object({ body: z.string().min(1).max(4096) }).passthrough() }).passthrough(),
  z.object({ ...base, type: z.literal('interactive'), interactive: z.discriminatedUnion('type', [
    z.object({ type: z.literal('button_reply'), button_reply: reply }).passthrough(),
    z.object({ type: z.literal('list_reply'), list_reply: reply }).passthrough(),
  ]) }).passthrough(),
  z.object({ ...base, type: z.literal('button'), button: z.object({ payload: z.string().min(1).max(256), text: z.string().max(1024) }).passthrough() }).passthrough(),
  z.object({ ...base, type: z.literal('image'), image: z.object({ id, mime_type: z.string().max(128).optional() }).passthrough() }).passthrough(),
  z.object({ ...base, type: z.literal('audio'), audio: z.object({ id, mime_type: z.string().max(128).optional() }).passthrough() }).passthrough(),
]);
export type IncomingMessage = z.infer<typeof incomingMessage>;
export const deliveryEvent = z.object({ id, recipient_id: senderId, timestamp,
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
}).passthrough();
export type DeliveryEvent = z.infer<typeof deliveryEvent>;
const envelope = z.object({ object: z.literal('whatsapp_business_account'), entry: z.array(z.object({
  changes: z.array(z.object({ field: z.string().optional(), value: z.object({
    metadata: z.object({ phone_number_id: z.string().min(1).max(128) }).passthrough().optional(),
    messages: z.array(z.unknown()).max(100).optional(), statuses: z.array(z.unknown()).max(100).optional(),
  }).passthrough() }).passthrough()).max(20),
}).passthrough()).max(20) }).passthrough();

export function parseProviderWebhook(value: unknown, phoneId: string) {
  const body = envelope.parse(value), messages: IncomingMessage[] = [], statuses: DeliveryEvent[] = [];
  let ignored = 0;
  for (const entry of body.entry) for (const change of entry.changes) {
    if (change.field && change.field !== 'messages') { ignored++; continue; }
    if (!change.value.metadata) throw new Error('Missing phone identity');
    if (change.value.metadata.phone_number_id !== phoneId) { ignored++; continue; }
    for (const message of change.value.messages ?? []) {
      const type = typeof message === 'object' && message !== null ? (message as {type?: unknown}).type : undefined;
      if (typeof type === 'string' && !['text','interactive','button','image','audio'].includes(type)) { ignored++; continue; }
      messages.push(incomingMessage.parse(message));
    }
    for (const status of change.value.statuses ?? []) statuses.push(deliveryEvent.parse(status));
    if (messages.length + statuses.length > 100) throw new Error('Too many webhook events');
  }
  return { messages, statuses, ignored };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value); if (encoded === undefined) throw new Error('Invalid JSON'); return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
}
export const payloadHash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

export function validateOutgoing(payload: unknown, waId: string) {
  const body = z.object({ messaging_product: z.literal('whatsapp'), to: senderId,
    type: z.enum(['text', 'interactive']),
  }).passthrough().parse(payload);
  if (body.to !== waId || Buffer.byteLength(canonicalJson(body)) > 65536) throw new Error('Outgoing recipient or size mismatch');
  if (body.type === 'text') z.object({ body: z.string().min(1).max(4096) }).parse(body.text);
  if (body.type === 'interactive') z.object({ type: z.enum(['button', 'list']), body: z.object({ text: z.string().min(1).max(1024) }) }).passthrough().parse(body.interactive);
  return body;
}
