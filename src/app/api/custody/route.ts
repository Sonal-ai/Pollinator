import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requestFingerprint } from '@/lib/chain/protocol';
import { operationRequestKey, operationResponse, operationFailure, sameOrigin } from '@/lib/chain/http';
import { canTransferBatch, batchScope } from '@/lib/access-policy';
import { custodyStageOptions } from '@/lib/batch-workflow';

const CustodyTransferSchema = z.object({
  batchId:   z.string().min(1),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'toAddress must be a valid EVM wallet address'),
  newStatus: z.enum([
    'HARVESTED', 'PROCESSED', 'LAB_VERIFIED', 'PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAIL', 'SOLD',
  ]),
  note: z.string().max(500).optional(),
});

// ============================================================
// POST /api/custody — Transfer batch custody
// ============================================================

export async function POST(request: NextRequest) {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CustodyTransferSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { batchId, toAddress, newStatus } = parsed.data;

  try {
  sameOrigin(request);
  const key = operationRequestKey(request);
  const requestHash = requestFingerprint('TRANSFER_CUSTODY', parsed.data);
  const { operationService } = await import('@/lib/chain/operations');
  const previous = await operationService.existing(session.accountId, key, requestHash);
  if (previous) return operationResponse(previous);
  const batch = await prisma.honeyBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return Response.json({ error: 'Batch not found' }, { status: 404 });
  }

  if (batch.recalled) {
    return Response.json({ error: 'Cannot transfer custody of a recalled batch' }, { status: 409 });
  }

  // --------------------------------------------------------
  // Strict Authorization: Only the current custodian or an admin can transfer custody
  // --------------------------------------------------------
  if (!canTransferBatch(session, batch)) {
    return Response.json({ error: 'Forbidden. Only the current custodian or owner can transfer this batch.' }, { status: 403 });
  }

  const fromAddress = batch.current_custodian ?? 'unknown';

  const allowed = custodyStageOptions(batch.status, session.role).includes(newStatus) &&
    (newStatus !== 'SOLD' || toAddress.toLowerCase() === session.walletAddress.toLowerCase());
  if (!allowed) return Response.json({ error: 'Invalid stage transition. Laboratory approval and packaging use their dedicated workflows.' }, { status: 409 });

  const operation = await operationService.enqueue({ initiatedBy: session.accountId, key, requestHash, actorAddress: session.walletAddress,
    batchId, expectedVersion: batch.version, payload: { kind: 'TRANSFER_CUSTODY', batchCode: batch.batchCode, fromAddress, toAddress, newStatus, note: parsed.data.note } });
  return operationResponse(operation);
  } catch (error) { return operationFailure(error); }
}

// ============================================================
// GET /api/custody — List custody events for a batch
// ============================================================

export async function GET(request: NextRequest) {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const batchId = request.nextUrl.searchParams.get('batchId');
  if (!batchId) {
    return Response.json({ error: 'batchId query parameter required' }, { status: 400 });
  }

  const batch = await prisma.honeyBatch.findFirst({ where: { AND: [{ id: batchId }, batchScope(session)] }, select: { id: true } });
  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 });

  const events = await prisma.custodyEvent.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' },
  });

  return Response.json({ events });
}
