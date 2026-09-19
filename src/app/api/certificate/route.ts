import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadFileToPinata, computeFileHash } from '@/lib/ipfs';
import { verifyLabOnChain, hashBatchCode, getExplorerTxUrl } from '@/lib/blockchain';
import { env } from '@/lib/env';

// ============================================================
// POST /api/certificate — Upload lab certificate and commit hash on-chain
// ============================================================

export async function POST(request: NextRequest) {
  // Authenticate via session cookie
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();

  const apiKey = request.headers.get('x-admin-api-key') ?? request.headers.get('authorization')?.replace('Bearer ', '');
  const isAdminKey = Boolean(apiKey && env.ADMIN_API_KEY && apiKey === env.ADMIN_API_KEY);

  if (!isAdminKey && session?.role !== 'lab' && session?.role !== 'admin') {
    return Response.json({ error: 'Unauthorized. Lab or Admin role required.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const batchId = formData.get('batchId')?.toString();
  // Securely assign the labActorId from the session, or fallback to formData if using admin API key
  const labActorId = session?.walletAddress ?? formData.get('labActorId')?.toString();
  const file = formData.get('file') as File | null;

  if (!batchId || !labActorId || !file) {
    return Response.json(
      { error: 'batchId, labActorId (from session), and file are required' },
      { status: 422 }
    );
  }

  // Validate file type
  if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
    return Response.json({ error: 'Only PDF files are accepted for lab certificates' }, { status: 415 });
  }

  // Max file size: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'Certificate file must be under 10MB' }, { status: 413 });
  }

  // Fetch the batch
  const batch = await prisma.honeyBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return Response.json({ error: 'Batch not found' }, { status: 404 });
  }

  if (batch.recalled) {
    return Response.json({ error: 'Cannot upload certificate for a recalled batch' }, { status: 409 });
  }

  if (batch.lab_verified) {
    return Response.json({ error: 'Batch already has a lab certificate' }, { status: 409 });
  }

  // Hash and upload PDF to IPFS
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const certificateHash = computeFileHash(fileBuffer);

  let ipfsCID: string;
  try {
    const result = await uploadFileToPinata(fileBuffer, file.name, batch.batchCode);
    ipfsCID = result.cid;
  } catch (err) {
    console.error('[api/certificate] IPFS upload failed:', err);
    return Response.json({ error: 'IPFS upload failed — please retry' }, { status: 503 });
  }

  // Commit hash on-chain
  let txHash: string | null = null;
  try {
    txHash = await verifyLabOnChain({
      batchCode: batch.batchCode,
      labReportHash: certificateHash,
    });
  } catch (err) {
    console.error('[api/certificate] Blockchain tx failed:', err);
    // Continue — save to DB with null txHash, can retry
  }

  // Persist certificate record
  const certificate = await prisma.certificate.create({
    data: {
      batchId,
      labActorId,
      certificateHash,
      ipfsCID,
      txHash,
    },
  });

  // Update batch status
  await prisma.honeyBatch.update({
    where: { id: batchId },
    data: {
      lab_verified: true,
      status: 'LAB_VERIFIED',
    },
  });

  return Response.json(
    {
      certificateId:   certificate.id,
      certificateHash,
      ipfsCID,
      txHash,
      ipfsUrl:         `${process.env.IPFS_GATEWAY}${ipfsCID}`,
      polygonscanUrl:  getExplorerTxUrl(txHash),
    },
    { status: 201 }
  );
}
