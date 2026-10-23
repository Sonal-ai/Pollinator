import type { Prisma } from '@prisma/client';
export const ROLES = ['admin', 'beekeeper', 'processor', 'lab', 'distributor', 'retailer'] as const;
export type Role = (typeof ROLES)[number];
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.some((role) => role === value);
}
export interface SessionPayload {
  accountId: string;
  walletAddress: string;
  role: Role;
  beekeeperId: string | null;
}
type BatchOwner = { beekeeperId: string | null; current_custodian: string | null; status?: string };
export function isCustodian(session: SessionPayload, batch: BatchOwner): boolean {
  return Boolean(batch.current_custodian &&
    session.walletAddress.toLowerCase() === batch.current_custodian.toLowerCase());
}
export function canTransferBatch(session: SessionPayload, batch: BatchOwner): boolean {
  if (isCustodian(session, batch)) return true;
  return session.role === 'beekeeper' && Boolean(session.beekeeperId) &&
    batch.beekeeperId === session.beekeeperId && !batch.current_custodian &&
    ['HARVESTED', 'PENDING_CHAIN'].includes(batch.status ?? '');
}
export function canManagePackaging(session: SessionPayload, batch: BatchOwner): boolean {
  return session.role === 'processor' && isCustodian(session, batch);
}
export function canAttestBatch(session: SessionPayload, batch: BatchOwner): boolean {
  return session.role === 'lab' && isCustodian(session, batch);
}
export function canViewBatch(session: SessionPayload, batch: BatchOwner): boolean {
  return session.role === 'admin' || isCustodian(session, batch) ||
    (session.role === 'beekeeper' && Boolean(session.beekeeperId) && batch.beekeeperId === session.beekeeperId);
}
export function batchScope(session: SessionPayload): Prisma.HoneyBatchWhereInput {
  if (session.role === 'admin') return {};
  const held: Prisma.HoneyBatchWhereInput = {
    current_custodian: { equals: session.walletAddress, mode: 'insensitive' },
  };
  return session.role === 'beekeeper' && session.beekeeperId
    ? { OR: [held, { beekeeperId: session.beekeeperId }] } : held;
}
export function beekeeperScope(session: SessionPayload): Prisma.BeekeeperWhereInput {
  if (session.role === 'admin') return {};
  return { id: { in: session.role === 'beekeeper' && session.beekeeperId ? [session.beekeeperId] : [] } };
}
export function hiveScope(session: SessionPayload): Prisma.HiveWhereInput {
  if (session.role === 'admin') return {};
  return { beekeeperId: { in: session.role === 'beekeeper' && session.beekeeperId ? [session.beekeeperId] : [] } };
}
