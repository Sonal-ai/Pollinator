// Shared wire schemas. Keep Node-only crypto and database imports out of this module.
import { z } from 'zod';

export const MetricsSchema = z.object({
  tempC: z.number().finite().min(-20).max(70).optional(),
  humidityPct: z.number().finite().min(0).max(100).optional(),
  weightKg: z.number().finite().min(0).max(500).optional(),
  pressureHPa: z.number().finite().min(800).max(1100).optional(),
  batteryPct: z.number().finite().min(0).max(100).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one measured value is required');
export const PacketSchema = z.object({
  version: z.literal(1), deviceId: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/),
  epoch: z.uuid(), sequence: z.number().int().min(0).max(2147483647),
  observedAt: z.iso.datetime({ offset: true }), metrics: MetricsSchema,
}).strict();
export const SignedEnvelopeSchema = z.object({
  payload: z.string().min(1).max(5464).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const ReceiptSchema = z.object({
  version: z.literal(1), kind: z.literal('stored'),
  deviceId: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/),
  epoch: z.uuid(), sequence: z.number().int().min(0).max(2147483647),
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  readingId: z.string().min(1).max(128),
}).strict();
export type TelemetryPacket = z.infer<typeof PacketSchema>;
export type SignedEnvelope = z.infer<typeof SignedEnvelopeSchema>;
export type StoredPayload = z.infer<typeof ReceiptSchema>;
