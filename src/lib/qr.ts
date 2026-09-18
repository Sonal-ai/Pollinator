import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { env } from './env';
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
 * Each jar gets a unique nonce + signature — cloning one jar's QR
 * cannot be used to authenticate any other jar.
 */
export async function generateQRTokensForBatch(params: {
  batchId: string;
  batchCode: string;
  jarCount: number;
  jarSizeGrams: number;
}): Promise<QRGenerationResult[]> {
  const { batchId, batchCode, jarCount, jarSizeGrams } = params;
  const results: QRGenerationResult[] = [];

  // Deactivate any previously generated tokens for this batch
  // (prevents stale tokens if QR is regenerated)
  await prisma.qRToken.updateMany({
    where: { batchId },
    data: { active: false },
  });

  for (let i = 1; i <= jarCount; i++) {
    const nonce = randomUUID();
    const signature = signQRPayload(batchCode, nonce);
    const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify?b=${encodeURIComponent(batchCode)}&n=${nonce}&sig=${signature}`;

    await prisma.qRToken.create({
      data: {
        batchId,
        nonce,
        signature,
        jarIndex: i,
        jarSizeGrams,
        active: true,
      },
    });

    results.push({ jarIndex: i, nonce, verifyUrl, signature });
  }

  return results;
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

  if (!token) {
    return { valid: false, status: 'NOT_FOUND', reason: 'QR token not found in system.' };
  }

  if (!token.active) {
    return { valid: false, status: 'DEACTIVATED', reason: 'This QR has been deactivated.' };
  }

  if (token.batch.recalled) {
    return { valid: false, status: 'RECALLED', reason: 'This batch has been recalled.' };
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
  });

  return { valid: true, status: 'OK' };
}
