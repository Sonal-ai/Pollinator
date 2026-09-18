import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recallBatchOnChain } from '@/lib/blockchain';
import { uploadBatchMetadata, type BatchMetadata } from '@/lib/ipfs';
import { env } from '@/lib/env';

// ============================================================
// POST /api/batch/[batchCode]/recall — Admin-only recall
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchCode: string }> }
) {
  const apiKey = request.headers.get('x-admin-api-key') ??
    request.headers.get('authorization')?.replace('Bearer ', '');
  const isAdminKey = apiKey && apiKey === env.ADMIN_API_KEY;

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('pollinator_session');

  let session: { role?: string } | null = null;
  if (sessionCookie) {
    try {
      session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    } catch { /* ignore */ }
  }

  if (!isAdminKey && session?.role !== 'admin') {
    return new Response('Unauthorized. Admin role required.', { status: 401 });
  }

  const { batchCode } = await params;

  let body: { reason?: string } = {};
  try { body = await request.json(); } catch { /* reason is optional */ }

  const reason = body.reason ?? 'Recalled by administrator';

  const batch = await prisma.honeyBatch.findUnique({ where: { batchCode } });
  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 });
  if (batch.recalled) return Response.json({ error: 'Batch is already recalled' }, { status: 409 });

  // Build recall reason document and upload to IPFS
  const recallDocument = {
    batchCode,
    reason,
    recalledAt: new Date().toISOString(),
    recalledBy: 'PLATFORM_ADMIN',
  };

  let reasonCID: string;
  try {
    // Upload as a simple metadata document
    const result = await uploadBatchMetadata(recallDocument as unknown as BatchMetadata);
    reasonCID = result.cid;
  } catch {
    // If IPFS fails, use a placeholder — recall must still proceed
    reasonCID = 'recall-reason-unavailable';
  }

  // Commit recall on-chain
  let txHash: string | null = null;
  try {
    txHash = await recallBatchOnChain({ batchCode, reasonCID });
  } catch (err) {
    console.error('[api/recall] Blockchain recall failed:', err);
    // Still update DB — better to have local recall than none
  }

  // Mark recalled in DB
  await prisma.honeyBatch.update({
    where: { batchCode },
    data: { recalled: true, status: 'RECALLED' },
  });

  // Deactivate all QR tokens for this batch
  await prisma.qRToken.updateMany({
    where: { batchId: batch.id },
    data: { active: false },
  });

  console.warn(`[RECALL] Batch ${batchCode} recalled. Reason: ${reason}. TxHash: ${txHash}`);

  return Response.json({
    batchCode,
    recalled: true,
    reason,
    txHash,
    polygonscanUrl: txHash ? `https://amoy.polygonscan.com/tx/${txHash}` : null,
  });
}
