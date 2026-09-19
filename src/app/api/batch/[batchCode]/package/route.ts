import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { packageBatchOnChain, getExplorerTxUrl } from '@/lib/blockchain';
import { uploadBatchMetadata, fetchMetadata, type BatchMetadata } from '@/lib/ipfs';

const PackageSchema = z.object({
  jarCount:        z.number().int().positive(),
  jarSizeGrams:    z.number().int().positive(),
  processorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

// ============================================================
// POST /api/batch/[batchCode]/package
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchCode: string }> }
) {
  const { batchCode } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PackageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { getSession } = await import('@/lib/auth');
  const session = await getSession();

  if (session?.role !== 'admin' && session?.role !== 'processor') {
    return Response.json({ error: 'Unauthorized. Only Processors can package honey.' }, { status: 403 });
  }

  const { jarCount, jarSizeGrams } = parsed.data;
  const processorWallet = session?.walletAddress ?? parsed.data.processorWallet;

  const batch = await prisma.honeyBatch.findUnique({ where: { batchCode } });
  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 });
  if (batch.recalled) return Response.json({ error: 'Batch is recalled' }, { status: 409 });

  // Integrity check (also enforced by smart contract)
  const totalGrams = jarCount * jarSizeGrams;
  if (totalGrams > batch.quantity_grams) {
    return Response.json(
      { error: `Packaged quantity (${totalGrams}g) exceeds harvested quantity (${batch.quantity_grams}g)` },
      { status: 400 }
    );
  }

  // Fetch existing metadata and add packaging details
  let updatedMetadata: BatchMetadata;
  try {
    const existing = batch.metadataCID ? await fetchMetadata(batch.metadataCID) : null;
    updatedMetadata = {
      ...(existing ?? {
        batchCode,
        beekeeperPublicName: 'Unknown',
        region: batch.region ?? 'India',
        honeyType: batch.honey_type,
        harvestDate: batch.harvest_timestamp?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
        quantityGrams: batch.quantity_grams,
        version: '1.0',
      }),
      packagingDetails: {
        jarCount,
        jarSizeGrams,
        packagedAt: new Date().toISOString(),
      },
    };
  } catch {
    updatedMetadata = {
      batchCode,
      beekeeperPublicName: 'Unknown',
      region: batch.region ?? 'India',
      honeyType: batch.honey_type,
      harvestDate: new Date().toISOString().split('T')[0],
      quantityGrams: batch.quantity_grams,
      packagingDetails: { jarCount, jarSizeGrams, packagedAt: new Date().toISOString() },
      version: '1.0',
    };
  }

  // Upload updated metadata to IPFS
  let newCID: string;
  let newHash: string;
  try {
    const result = await uploadBatchMetadata(updatedMetadata);
    newCID = result.cid;
    newHash = result.hash;
  } catch (err) {
    console.error('[api/batch/package] IPFS upload failed:', err);
    return Response.json({ error: 'IPFS upload failed' }, { status: 503 });
  }

  // Commit on-chain
  let txHash: string | null = null;
  try {
    txHash = await packageBatchOnChain({
      batchCode,
      jarCount,
      jarSizeGrams,
      newMetadataCID: newCID,
      newMetadataHash: newHash,
    });
  } catch (err) {
    console.error('[api/batch/package] Blockchain tx failed:', err);
  }

  await prisma.honeyBatch.update({
    where: { batchCode },
    data: {
      status: 'PACKAGED',
      metadataCID: newCID,
      metadataHash: newHash,
      current_custodian: processorWallet ?? batch.current_custodian,
    },
  });

  return Response.json({ batchCode, jarCount, jarSizeGrams, newCID, txHash, polygonscanUrl: getExplorerTxUrl(txHash) });
}
