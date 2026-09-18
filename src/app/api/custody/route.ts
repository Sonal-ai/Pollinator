import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { transferCustodyOnChain } from '@/lib/blockchain';

// Batch status values that map to Solidity enum indices
const BATCH_STATUS_MAP: Record<string, number> = {
  CREATED:         0,
  HARVESTED:       1,
  PROCESSED:       2,
  LAB_VERIFIED:    3,
  PACKAGED:        4,
  IN_DISTRIBUTION: 5,
  AT_RETAIL:       6,
  SOLD:            7,
  RECALLED:        8,
};

const CustodyTransferSchema = z.object({
  batchId:   z.string().min(1),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'toAddress must be a valid EVM wallet address'),
  newStatus: z.enum([
    'PROCESSED', 'LAB_VERIFIED', 'PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAIL', 'SOLD',
  ]),
  note: z.string().max(500).optional(),
});

// ============================================================
// POST /api/custody — Transfer batch custody
// ============================================================

export async function POST(request: NextRequest) {
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

  const { batchId, toAddress, newStatus, note } = parsed.data;

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
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('pollinator_session');

  let session: { walletAddress?: string; role?: string } | null = null;
  if (sessionCookie) {
    try {
      session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    } catch { /* ignore */ }
  }

  const isAdmin = session?.role === 'admin';
  const isCurrentCustodian = session?.walletAddress && session.walletAddress.toLowerCase() === batch.current_custodian?.toLowerCase();

  if (!isAdmin && !isCurrentCustodian) {
    return Response.json({ 
      error: 'Unauthorized. Only the current custodian or an admin can transfer this batch.' 
    }, { status: 403 });
  }

  const fromAddress = batch.current_custodian ?? 'unknown';
  const statusIndex = BATCH_STATUS_MAP[newStatus] ?? 1;

  // Commit on-chain
  let txHash: string | null = null;
  try {
    txHash = await transferCustodyOnChain({
      batchCode: batch.batchCode,
      toAddress,
      newStatus: statusIndex,
    });
  } catch (err) {
    console.error('[api/custody] Blockchain tx failed:', err);
    // Continue — store event with null txHash
  }

  // Record custody event in DB
  await prisma.custodyEvent.create({
    data: {
      batchId,
      from: fromAddress,
      to: toAddress,
      stage: newStatus,
      txHash,
    },
  });

  // Update batch current_custodian and status
  await prisma.honeyBatch.update({
    where: { id: batchId },
    data: {
      current_custodian: toAddress,
      status: newStatus,
    },
  });

  return Response.json({
    success: true,
    from: fromAddress,
    to: toAddress,
    newStatus,
    txHash,
    polygonscanUrl: txHash ? `https://amoy.polygonscan.com/tx/${txHash}` : null,
  });
}

// ============================================================
// GET /api/custody — List custody events for a batch
// ============================================================

export async function GET(request: NextRequest) {
  const batchId = request.nextUrl.searchParams.get('batchId');
  if (!batchId) {
    return Response.json({ error: 'batchId query parameter required' }, { status: 400 });
  }

  const events = await prisma.custodyEvent.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' },
  });

  return Response.json({ events });
}
