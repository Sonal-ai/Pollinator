import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { env } from './env';
import { serverAppOrigin } from './app-origin';
import { prisma } from './db';
import { checkDuplicateScanAnomaly } from './anti-clone';

// ============================================================
// Types
// ============================================================

export interface QRGenerationResult {
  jarIndex: number;
  nonce: string;
  verifyUrl: string;
  signature: string;
}

export interface QRVerifyResult {
  valid: boolean;
  status: 'OK' | 'INVALID_SIGNATURE' | 'NOT_FOUND' | 'DEACTIVATED' | 'RECALLED';
  reason?: string;
}

// ============================================================
// HMAC Signing
// ============================================================

/**
 * Compute HMAC-SHA256 signature for a QR payload.
 * Format: HMAC(batchCode + ':' + nonce, QR_HMAC_SECRET)
 */
export function signQRPayload(batchCode: string, nonce: string): string {
  return createHmac('sha256', env.QR_HMAC_SECRET)
    .update(`${batchCode}:${nonce}`)
    .digest('hex');
}

/**
 * Verify a QR signature using timing-safe comparison.
 * Returns true if the signature is valid.
 */
export function verifyQRSignature(
  batchCode: string,
  nonce: string,
  signature: string
): boolean {
  try {
    if (!/^[a-fA-F0-9]{64}$/.test(signature) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce)) return false;
    const expected = signQRPayload(batchCode, nonce);
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    // timingSafeEqual throws if buffers differ in length — that itself means invalid
    return false;
  }
}

// ============================================================
// QR Token Generation
// ============================================================

/**
 * Generate QR tokens for each jar in a batch.
 * Each jar gets one stable serial record. Reprints reuse it; printed QR copying
 * remains possible and is handled by advisory scan signals, not this signature.
 */
export async function generateQRTokensForBatch(params: {
  batchId: string;
  batchCode: string;
  jarCount: number;
  jarSizeGrams: number;
}): Promise<QRGenerationResult[]> {
  const { batchId, batchCode, jarCount, jarSizeGrams } = params;
  if (!Number.isInteger(jarCount) || jarCount < 1 || jarCount > 10_000 || !Number.isInteger(jarSizeGrams) || jarSizeGrams < 1) throw new Error('Invalid label inventory');
  return prisma.$transaction(async tx => {
    const batch = await tx.honeyBatch.findUnique({ where: { id: batchId } });
    if (!batch || batch.batchCode !== batchCode || batch.recalled || batch.status !== 'PACKAGED' || !batch.packagingTxHash ||
      batch.jarCount !== jarCount || batch.jarSizeGrams !== jarSizeGrams || jarCount * jarSizeGrams > batch.quantity_grams) {
      throw new Error('Label request must match confirmed packaging inventory');
    }
    let tokens = await tx.qRToken.findMany({ where: { batchId }, orderBy: { jarIndex: 'asc' } });
    if (!tokens.length) {
      await tx.qRToken.createMany({ data: Array.from({ length: jarCount }, (_, index) => {
        const nonce = randomUUID();
        return { batchId, nonce, signature: signQRPayload(batchCode, nonce), jarIndex: index + 1, jarSizeGrams, active: true };
      }) });
      tokens = await tx.qRToken.findMany({ where: { batchId }, orderBy: { jarIndex: 'asc' } });
    }
    if (tokens.length !== jarCount || tokens.some((token, index) => !token.active || token.jarIndex !== index + 1 || token.jarSizeGrams !== jarSizeGrams)) {
      throw new Error('Existing label inventory needs operator reconciliation');
    }
    return tokens.map(token => ({ jarIndex: token.jarIndex!, nonce: token.nonce, signature: token.signature,
      verifyUrl: `${serverAppOrigin(env.NEXT_PUBLIC_APP_URL)}/verify?b=${encodeURIComponent(batchCode)}&n=${token.nonce}&sig=${token.signature}` }));
  }, { isolationLevel: 'Serializable' });
}

// ============================================================
// QR Scan Verification
// ============================================================

/**
 * Verify an incoming QR scan request.
 * Logs the scan, runs anomaly detection, and returns the verdict.
 *
 * Step 1: Verify HMAC signature
 * Step 2: Look up token in DB
 * Step 3: Log the scan with IP geolocation
 * Step 4: Trigger duplicate scan anomaly check (async)
 */
export async function processQRScan(params: {
  batchCode: string;
  nonce: string;
  signature: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<QRVerifyResult> {
  const { batchCode, nonce, signature, ipAddress, userAgent } = params;

  // Step 1: Signature verification
  if (!verifyQRSignature(batchCode, nonce, signature)) {
    return { valid: false, status: 'INVALID_SIGNATURE', reason: 'QR signature verification failed.' };
  }

  // Step 2: DB lookup
  const token = await prisma.qRToken.findUnique({
    where: { nonce },
    include: { batch: true },
  });

  if (!token || token.batch.batchCode !== batchCode) {
    return { valid: false, status: 'NOT_FOUND', reason: 'QR token not found in system.' };
  }

  if (token.batch.recalled) {
    return { valid: false, status: 'RECALLED', reason: 'This batch has been recalled.' };
  }

  if (!token.active) {
    return { valid: false, status: 'DEACTIVATED', reason: 'This QR has been deactivated.' };
  }

  // Step 3: Geolocate and log scan
  let ipRegion: string | null = null;
  let ipCity: string | null = null;
  let ipCountry: string | null = null;

  if (ipAddress) {
    try {
      // Dynamic import to handle environments where geoip-lite DB may not be initialized
      const geoip = await import('geoip-lite');
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        ipRegion = geo.region || null;
        ipCity = geo.city || null;
        ipCountry = geo.country || null;
      }
    } catch {
      // Geolocation failure is non-fatal — scan still proceeds
    }
  }

  const scan = await prisma.qRScan.create({
    data: {
      qrTokenId: token.id,
      ipAddress: null, // Do not persist raw IP for privacy
      ipRegion,
      ipCity,
      ipCountry,
      userAgent,
    },
  });

  // Step 4: Anomaly detection — non-blocking fire-and-forget
  // We don't await this; it should not delay the user's verify response
  void checkDuplicateScanAnomaly({
    qrTokenId: token.id,
    batchId: token.batchId,
    batchCode,
    newScanId: scan.id,
    ipRegion,
  }).catch(() => { /* A failed advisory scan check must not become an unhandled rejection. */ });

  return { valid: true, status: 'OK' };
}
