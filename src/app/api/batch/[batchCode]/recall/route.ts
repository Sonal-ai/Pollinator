import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadBatchMetadata, type BatchMetadata } from '@/lib/ipfs';
import { requestFingerprint } from '@/lib/chain/protocol';
import { operationRequestKey, operationResponse, operationFailure, sameOrigin } from '@/lib/chain/http';
const Recall = z.object({ reason: z.string().trim().min(3).max(2000) });
export async function POST(request: Request, { params }: { params: Promise<{ batchCode: string }> }) {
  const session = await getSession();
  if (session?.role !== 'admin') return Response.json({ error: 'An administrator account must approve a recall.' }, { status: 401 });
  try {
    sameOrigin(request);
    const body = Recall.safeParse(await request.json());
    if (!body.success) return Response.json({ error: 'Provide a recall reason (3–2000 characters).' }, { status: 422 });
    const key = operationRequestKey(request);
    const { batchCode } = await params;
    const requestHash = requestFingerprint('RECALL_BATCH', { batchCode, reason: body.data.reason });
    const { operationService } = await import('@/lib/chain/operations');
    const previous = await operationService.existing(session.accountId, key, requestHash);
    if (previous) return operationResponse(previous);
    const original = await prisma.honeyBatch.findUnique({ where: { batchCode } });
    if (!original) return Response.json({ error: 'Batch not found' }, { status: 404 });
    if (original.recallTxHash) return Response.json({ error: 'This batch already has a confirmed chain recall.' }, { status: 409 });
    // Safety flag and token withdrawal are immediate, even if evidence storage or wallet approval fails.
    const batch = await prisma.$transaction(async tx => {
      const updated = await tx.honeyBatch.update({ where: { id: original.id }, data: { recalled: true, status: 'RECALLED', recallReason: body.data.reason,
        ...(!original.recalled ? { version: { increment: 1 } } : {}) } });
      await tx.qRToken.updateMany({ where: { batchId: original.id }, data: { active: false } });
      return updated;
    });
    let reasonCID: string;
    try { reasonCID = (await uploadBatchMetadata({ batchCode, reason: body.data.reason, recalledBy: session.walletAddress } as unknown as BatchMetadata)).cid; }
    catch { return Response.json({ recalled: true, chainConfirmed: false, error: 'Local safety recall is active. Evidence storage is unavailable; retry with the same key to prepare the chain recall.' }, { status: 503 }); }
    const operation = await operationService.enqueue({ initiatedBy: session.accountId, key, requestHash, actorAddress: session.walletAddress,
      batchId: batch.id, expectedVersion: batch.version, payload: { kind: 'RECALL_BATCH', batchCode, reasonCID, reason: body.data.reason } });
    return operationResponse(operation);
  } catch (error) { return operationFailure(error); }
}
