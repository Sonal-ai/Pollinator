import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMetadataHash, uploadBatchMetadata, type BatchMetadata } from '@/lib/ipfs';
import { createBatchOnChain, hashBatchCode, getExplorerTxUrl } from '@/lib/blockchain';
import crypto from 'crypto';

// ============================================================
// POST /api/batch — Create a new honey batch
// ============================================================

const CreateBatchSchema = z.object({
  beekeeperId:    z.string().min(1),
  honeyType:      z.string().min(1),
  quantityGrams:  z.number().int().positive().max(10_000_000), // max 10 tonnes
  hivesHarvested: z.number().int().positive(),
  harvestDate:    z.string().datetime({ offset: true }),
  region:         z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { getSession } = await import('@/lib/auth');
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

  // Verify beekeeper exists
  const beekeeper = await prisma.beekeeper.findUnique({ where: { id: beekeeperId } });
  if (!beekeeper) {
    return Response.json({ error: 'Beekeeper not found' }, { status: 404 });
  }

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
  const batchIdHash = hashBatchCode(batchCode);

  // Build IPFS metadata
  const metadata: BatchMetadata = {
    batchCode,
    beekeeperPublicName: beekeeper.name ?? `Beekeeper ${beekeeperId.slice(-6)}`,
    region: beekeeper.region ?? region,
    honeyType,
    harvestDate: new Date(harvestDate).toISOString().split('T')[0],
    quantityGrams,
    version: '1.0',
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

  // Register on blockchain
  let txHash: string | null = null;
  try {
    txHash = await createBatchOnChain({
      batchCode,
      harvestTimestamp: Math.floor(new Date(harvestDate).getTime() / 1000),
      quantityGrams,
      metadataCID,
      metadataHash,
    });
  } catch (err) {
    console.error('[api/batch] Blockchain tx failed:', err);
    // We continue and store in DB with PENDING_CHAIN status
    // The batch can be retried later via a background job
  }

  // Persist to database
  const batch = await prisma.honeyBatch.create({
    data: {
      batch_id_hash:    batchIdHash,
      batchCode,
      beekeeperId,
      quantity_grams:   quantityGrams,
      honey_type:       honeyType,
      hives_harvested:  hivesHarvested,
      harvest_timestamp: new Date(harvestDate),
      region,
      status:           txHash ? 'HARVESTED' : 'PENDING_CHAIN',
      current_custodian: beekeeper.wallet ?? null,
      metadataCID,
      metadataHash,
      txHash,
    },
  });

  return Response.json(
    {
      batchId:    batch.id,
      batchCode,
      status:     batch.status,
      txHash,
      metadataCID,
      polygonscanUrl: getExplorerTxUrl(txHash),
    },
    { status: 201 }
  );
}

// ============================================================
// GET /api/batch — List all batches (paginated)
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const status = searchParams.get('status') ?? undefined;

  const where = status ? { status } : {};

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
