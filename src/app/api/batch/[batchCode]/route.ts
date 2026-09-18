import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getBatchFromChain } from '@/lib/blockchain';

// ============================================================
// GET /api/batch/[batchCode] — Get full batch details
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchCode: string }> }
) {
  const { batchCode } = await params;

  const batch = await prisma.honeyBatch.findUnique({
    where: { batchCode },
    include: {
      beekeeper: { select: { name: true, region: true, kvicId: true } },
      certificates: true,
      custodyEvents: { orderBy: { createdAt: 'asc' } },
      qrTokens: {
        select: { id: true, jarIndex: true, jarSizeGrams: true, active: true, createdAt: true },
      },
      scanAlerts: { where: { resolved: false } },
    },
  });

  if (!batch) {
    return Response.json({ error: 'Batch not found' }, { status: 404 });
  }

  // Fetch live blockchain state (non-blocking — null if chain unavailable)
  const chainRecord = await getBatchFromChain(batchCode).catch(() => null);

  // Detect DB ↔ Chain disagreement
  let chainDiscrepancy: string | null = null;
  if (chainRecord && chainRecord.status !== undefined) {
    const chainRecalled = chainRecord.recalled;
    if (chainRecalled && !batch.recalled) {
      chainDiscrepancy = 'Blockchain shows batch as recalled but DB does not — DB may be stale.';
    }
  }

  return Response.json({
    batch,
    chainRecord,
    chainDiscrepancy,
    polygonscanUrl: batch.txHash
      ? `https://amoy.polygonscan.com/tx/${batch.txHash}`
      : null,
  });
}
