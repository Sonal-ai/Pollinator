import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadFileToPinata, computeFileHash } from '@/lib/ipfs';
import { requestFingerprint } from '@/lib/chain/protocol';
import { operationRequestKey, operationResponse, operationFailure, sameOrigin, readCertificateForm } from '@/lib/chain/http';
import { env } from '@/lib/env';
import { canAttestBatch } from '@/lib/access-policy';

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
    formData = await readCertificateForm(request);
  } catch (error) {
    return operationFailure(error);
  }

  const batchId = formData.get('batchId')?.toString();
  // Securely assign the labActorId from the session, or fallback to formData if using admin API key
  const labActorId = session?.walletAddress ?? formData.get('labActorId')?.toString();
  const file = formData.get('file');

  if (!batchId || !labActorId || !file || typeof file === 'string') {
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

  try {
  sameOrigin(request);
  const key = operationRequestKey(request);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  if (fileBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') return Response.json({ error: 'The file does not contain a PDF header.' }, { status: 415 });
  const certificateHash = computeFileHash(fileBuffer);
  const initiatedBy = session?.accountId ?? 'api:lab:' + labActorId.toLowerCase();
  const requestHash = requestFingerprint('VERIFY_LAB', { batchId, labActorId, certificateHash });
  const { operationService } = await import('@/lib/chain/operations');
  const previous = await operationService.existing(initiatedBy, key, requestHash);
  if (previous) return operationResponse(previous);
  // Fetch the batch
  const batch = await prisma.honeyBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return Response.json({ error: 'Batch not found' }, { status: 404 });
  }

  if (!isAdminKey && (!session || !canAttestBatch(session, batch))) {
    return Response.json({ error: 'Forbidden. This batch is not assigned to your lab.' }, { status: 403 });
  }

  if (batch.recalled) {
    return Response.json({ error: 'Cannot upload certificate for a recalled batch' }, { status: 409 });
  }

  if (batch.lab_verified) {
    return Response.json({ error: 'Batch already has a lab certificate' }, { status: 409 });
  }
  if (batch.status !== 'PROCESSED') return Response.json({ error: 'The batch must be processed and held by this lab before approval.' }, { status: 409 });

  // Hash and upload PDF to IPFS

  let ipfsCID: string;
  try {
    const result = await uploadFileToPinata(fileBuffer, file.name, batch.batchCode);
    ipfsCID = result.cid;
  } catch (err) {
    console.error('[api/certificate] IPFS upload failed:', err);
    return Response.json({ error: 'IPFS upload failed — please retry' }, { status: 503 });
  }

  const operation = await operationService.enqueue({ initiatedBy, key, requestHash, actorAddress: labActorId, batchId, expectedVersion: batch.version,
    payload: { kind: 'VERIFY_LAB', batchCode: batch.batchCode, labActorId, certificateHash, ipfsCID } });
  return operationResponse(operation);
  } catch (error) { return operationFailure(error); }
}
