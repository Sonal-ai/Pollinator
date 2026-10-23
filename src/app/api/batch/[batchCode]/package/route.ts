import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requestFingerprint } from '@/lib/chain/protocol';
import { operationRequestKey, operationResponse, operationFailure, sameOrigin } from '@/lib/chain/http';
import { uploadBatchMetadata, verifyMetadataIntegrity, type BatchMetadata } from '@/lib/ipfs';
import { canManagePackaging } from '@/lib/access-policy';

const PackageSchema = z.object({
  jarCount:        z.number().int().positive().max(10_000),
  jarSizeGrams:    z.number().int().positive().max(1_000_000),
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

  try {
  sameOrigin(request);
  const key = operationRequestKey(request);
  const requestHash = requestFingerprint('PACKAGE_BATCH', { batchCode, jarCount, jarSizeGrams });
  const { operationService } = await import('@/lib/chain/operations');
  const previous = await operationService.existing(session.accountId, key, requestHash);
  if (previous) return operationResponse(previous);
  const batch = await prisma.honeyBatch.findUnique({ where: { batchCode } });
  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 });
  if (!session || !canManagePackaging(session, batch)) {
    return Response.json({ error: 'Forbidden. This batch is not in your custody.' }, { status: 403 });
  }
  if (batch.recalled) return Response.json({ error: 'Batch is recalled' }, { status: 409 });
  if (batch.status !== 'LAB_VERIFIED' || !batch.lab_verified) return Response.json({ error: 'Confirmed laboratory approval is required before packaging.' }, { status: 409 });

  // Integrity check (also enforced by smart contract)
  const totalGrams = jarCount * jarSizeGrams;
  if (totalGrams > batch.quantity_grams) {
    return Response.json(
      { error: `Packaged quantity (${totalGrams}g) exceeds harvested quantity (${batch.quantity_grams}g)` },
      { status: 400 }
    );
  }

  // Fetch existing metadata and add packaging details
  const existing = batch.metadataCID && batch.metadataHash
    ? await verifyMetadataIntegrity(batch.metadataCID, batch.metadataHash) : null;
  if (!existing?.valid || !existing.metadata || existing.metadata.batchCode !== batchCode || existing.metadata.quantityGrams !== batch.quantity_grams) {
    return Response.json({ error: 'Original batch evidence is unavailable or does not match. Packaging cannot replace it with reconstructed data.' }, { status: 409 });
  }
  const updatedMetadata: BatchMetadata = {
      ...existing.metadata,
      version: '2.0',
      packagingDetails: {
        jarCount,
        jarSizeGrams,
        packagedAt: new Date().toISOString(),
      },
  };

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

  const operation = await operationService.enqueue({ initiatedBy: session.accountId, key, requestHash, actorAddress: processorWallet,
    batchId: batch.id, expectedVersion: batch.version, payload: { kind: 'PACKAGE_BATCH', batchCode, jarCount, jarSizeGrams, metadataCID: newCID, metadataHash: newHash } });
  return operationResponse(operation);
  } catch (error) { return operationFailure(error); }
}
