import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { generateQRTokensForBatch } from '@/lib/qr';
import QRCode from 'qrcode';

const GenerateQRSchema = z.object({
  batchCode:    z.string().min(1),
  jarCount:     z.number().int().positive().max(10000),
  jarSizeGrams: z.number().int().positive(),
});

// ============================================================
// POST /api/qr — Generate QR tokens for a batch
// ============================================================

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = GenerateQRSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { getSession } = await import('@/lib/auth');
  const session = await getSession();

  if (session?.role !== 'admin' && session?.role !== 'processor') {
    return Response.json({ error: 'Unauthorized. Only Processors can generate QR tokens.' }, { status: 403 });
  }

  const { batchCode, jarCount, jarSizeGrams } = parsed.data;

  const batch = await prisma.honeyBatch.findUnique({ where: { batchCode } });
  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 });
  if (batch.recalled) return Response.json({ error: 'Cannot generate QR for recalled batch' }, { status: 409 });
  if (batch.status !== 'PACKAGED') {
    return Response.json({ error: 'QR can only be generated for PACKAGED batches' }, { status: 400 });
  }

  // Generate QR tokens (nonces + signatures)
  const tokens = await generateQRTokensForBatch({
    batchId: batch.id,
    batchCode,
    jarCount,
    jarSizeGrams,
  });

  // Generate QR code images as base64 data URLs in chunks to prevent OOM / Event Loop DoS (GAP-11 fix)
  const results: Array<{ jarIndex: number; nonce: string; verifyUrl: string; qrImageBase64: string }> = [];
  const chunkSize = 50;
  
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (token) => {
        const qrDataUrl = await QRCode.toDataURL(token.verifyUrl, {
          errorCorrectionLevel: 'H', // High error correction for damaged labels
          width: 400,
          margin: 2,
          color: { dark: '#1a1a2e', light: '#ffffff' },
        });

        return {
          jarIndex: token.jarIndex,
          nonce: token.nonce,
          verifyUrl: token.verifyUrl,
          qrImageBase64: qrDataUrl, // data:image/png;base64,...
        };
      })
    );
    results.push(...chunkResults);
    
    // Yield to the event loop between chunks
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return Response.json({ batchCode, jarCount, jarSizeGrams, qrTokens: results }, { status: 201 });
}

// ============================================================
// GET /api/qr — List QR tokens for a batch
// ============================================================

export async function GET(request: NextRequest) {
  const batchCode = request.nextUrl.searchParams.get('batchCode');
  if (!batchCode) return Response.json({ error: 'batchCode is required' }, { status: 400 });

  const batch = await prisma.honeyBatch.findUnique({
    where: { batchCode },
    include: {
      qrTokens: {
        include: {
          _count: { select: { scans: true } },
        },
        orderBy: { jarIndex: 'asc' },
      },
    },
  });

  if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 });

  return Response.json({ batchCode, qrTokens: batch.qrTokens });
}
