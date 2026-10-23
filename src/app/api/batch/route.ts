import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadBatchMetadata, type BatchMetadata } from '@/lib/ipfs';
import { requestFingerprint, OperationError } from '@/lib/chain/protocol';
import { operationRequestKey, operationResponse, operationFailure, sameOrigin } from '@/lib/chain/http';
import crypto from 'crypto';
import { getSession } from '@/lib/auth';
import { batchScope } from '@/lib/access-policy';

// ============================================================
// POST /api/batch — Create a new honey batch
// ============================================================

const CreateBatchSchema = z.object({
  beekeeperId:    z.string().min(1).max(150),
  honeyType:      z.string().min(1).max(100),
  quantityGrams:  z.number().int().positive().max(10_000_000), // max 10 tonnes
  hivesHarvested: z.number().int().positive().max(100000),
  harvestDate:    z.string().datetime({ offset: true }),
  region:         z.string().min(1).max(150),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  const apiKey = request.headers.get('x-admin-api-key') ??
    request.headers.get('authorization')?.replace('Bearer ', '');
  const { env } = await import('@/lib/env');
  const isAdminKey = Boolean(apiKey && env.ADMIN_API_KEY && apiKey === env.ADMIN_API_KEY);

  if (!isAdminKey && (!session || !['admin', 'beekeeper'].includes(session.role))) {
    return Response.json({ error: 'Unauthorized. Login or API key required.' }, { status: 401 });
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateBatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { beekeeperId, honeyType, quantityGrams, hivesHarvested, harvestDate, region } = parsed.data;

  if (!isAdminKey && session?.role !== 'admin' && session?.beekeeperId !== beekeeperId) {
    return Response.json({ error: 'Forbidden. This beekeeper is not linked to your account.' }, { status: 403 });
  }

  // Verify beekeeper exists
  const beekeeper = await prisma.beekeeper.findUnique({ where: { id: beekeeperId } });
  if (!beekeeper) {
    return Response.json({ error: 'Beekeeper not found' }, { status: 404 });
  }
  try {
  sameOrigin(request);
  if (new Date(harvestDate).getTime() > Date.now()) throw new OperationError('Harvest time cannot be in the future', 422);
  if (!beekeeper.wallet) throw new OperationError('This beekeeper needs wallet enrollment before chain registration. Contact the cooperative operator.');
  const key = operationRequestKey(request);
  const initiatedBy = session?.accountId ?? 'whatsapp:' + beekeeperId;
  const requestHash = requestFingerprint('CREATE_BATCH', parsed.data);
  const { operationService } = await import('@/lib/chain/operations');
  const previous = await operationService.existing(initiatedBy, key, requestHash);
  if (previous) return operationResponse(previous);

  // Generate batch code: "HC-{YEAR}-{REGION_CODE}-{SEQUENCE}"
  const year = new Date(harvestDate).getFullYear();
  const regionCode = region
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);

  // Use a secure random 6-character hex suffix to prevent concurrent DB race conditions (GAP-12 fix)
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const batchCode = `HC-${year}-${regionCode}-${randomSuffix}`;

  // Compute the batch ID hash (used as the blockchain key)

  // Build IPFS metadata
  const metadata: BatchMetadata = {
    batchCode,
    beekeeperPublicName: beekeeper.name ?? `Beekeeper ${beekeeperId.slice(-6)}`,
    region: beekeeper.region ?? region,
    honeyType,
    harvestDate: new Date(harvestDate).toISOString().split('T')[0],
    quantityGrams,
    version: '2.0',
  };

  // Upload to IPFS — do this BEFORE blockchain so we have the CID
  let metadataCID: string;
  let metadataHash: string;
  try {
    const result = await uploadBatchMetadata(metadata);
    metadataCID = result.cid;
    metadataHash = result.hash;
  } catch (err) {
    console.error('[api/batch] IPFS upload failed:', err);
    return Response.json(
      { error: 'IPFS upload failed — batch not created. Please retry.' },
      { status: 503 }
    );
  }

  const operation = await operationService.enqueue({ initiatedBy, key, requestHash, actorAddress: beekeeper.wallet, payload: {
    kind: 'CREATE_BATCH', batchCode, beekeeperId, honeyType, quantityGrams, hivesHarvested,
    harvestTimestamp: Math.floor(new Date(harvestDate).getTime() / 1000), region: metadata.region, metadataCID, metadataHash,
  } });
  return operationResponse(operation);
  } catch (error) { return operationFailure(error); }
}

// ============================================================
// GET /api/batch — List all batches (paginated)
// ============================================================

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const searchParams = request.nextUrl.searchParams;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const status = searchParams.get('status') ?? undefined;

  const where = { AND: [batchScope(session), status ? { status } : {}] };

  const [batches, total] = await Promise.all([
    prisma.honeyBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        beekeeper: { select: { name: true, region: true } },
        _count: { select: { qrTokens: true, custodyEvents: true } },
      },
    }),
    prisma.honeyBatch.count({ where }),
  ]);

  return Response.json({
    batches,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
