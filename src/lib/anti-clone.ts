import { prisma } from './db';

// ============================================================
// Anti-Clone IP Anomaly Detection
// ============================================================

// Configuration — adjust thresholds without code changes by using env vars
const ANOMALY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const HIGH_VOLUME_THRESHOLD = 50;           // Scans per QR token before flagging

interface AnomalyCheckParams {
  qrTokenId: string;
  batchId: string;
  batchCode: string;
  newScanId: string;
  ipRegion: string | null;
}

/**
 * Check for duplicate-scan anomalies after a QR scan.
 * This is called fire-and-forget — it must NOT throw to the caller.
 *
 * Anomaly 1 — Geographic: Same QR scanned from 2+ different regions within 30 min.
 *   Detection: Physically impossible for a genuine bottle to teleport between regions.
 *   Limitation: IP geolocation is ~50km accurate; VPNs and mobile IPs may cause false positives.
 *   Threshold: State/region level (not city) to reduce false positives.
 *
 * Anomaly 2 — High Volume: Same QR scanned 50+ times total.
 *   Detection: A single jar can only be at one place at a time; mass scanning = cloned QR.
 *   Note: Genuine viral social media scans could hit this — admin reviews before recalling.
 */
export async function checkDuplicateScanAnomaly(params: AnomalyCheckParams): Promise<void> {
  try {
    const { qrTokenId, batchId, batchCode, ipRegion } = params;

    // --- Anomaly 1: Geographic within 30-minute window ---
    if (ipRegion) {
      const windowStart = new Date(Date.now() - ANOMALY_WINDOW_MS);
      const recentScans = await prisma.qRScan.findMany({
        where: {
          qrTokenId,
          timestamp: { gte: windowStart },
          ipRegion: { not: null },
        },
        select: { ipRegion: true },
      });

      const regions = new Set(
        recentScans.map((s: { ipRegion: string | null }) => s.ipRegion).filter((r): r is string => r !== null)
      );

      if (regions.size >= 2) {
        await createAlertIfNotExists({
          batchId,
          qrTokenId,
          alertType: 'GEOGRAPHIC_ANOMALY',
          details: JSON.stringify({
            batchCode,
            regions: Array.from(regions),
            scanCount: recentScans.length,
            windowMinutes: 30,
            detectedAt: new Date().toISOString(),
            note: 'Same QR scanned from multiple geographic regions within 30 minutes.',
          }),
        });
      }
    }

    // --- Anomaly 2: High total scan volume ---
    const totalScans = await prisma.qRScan.count({ where: { qrTokenId } });
    if (totalScans >= HIGH_VOLUME_THRESHOLD) {
      await createAlertIfNotExists({
        batchId,
        qrTokenId,
        alertType: 'HIGH_VOLUME',
        details: JSON.stringify({
          batchCode,
          totalScans,
          threshold: HIGH_VOLUME_THRESHOLD,
          detectedAt: new Date().toISOString(),
          note: 'Unusually high number of scans for a single QR token.',
        }),
      });
    }
  } catch (err) {
    // Non-fatal: log but do not surface to caller
    console.error('[anti-clone] Anomaly check failed:', err);
  }
}

/**
 * Create a ScanAlert only if one doesn't already exist for this token+type.
 * Prevents alert flood from repeated scans triggering duplicate alerts.
 */
async function createAlertIfNotExists(params: {
  batchId: string;
  qrTokenId: string;
  alertType: string;
  details: string;
}): Promise<void> {
  const { batchId, qrTokenId, alertType, details } = params;

  const existing = await prisma.scanAlert.findFirst({
    where: {
      qrTokenId,
      alertType,
      resolved: false,
    },
  });

  if (!existing) {
    await prisma.scanAlert.create({
      data: {
        batchId,
        qrTokenId,
        alertType,
        details,
        resolved: false,
      },
    });

    console.warn(`[anti-clone] 🚨 Alert created: ${alertType} for QR token ${qrTokenId}`);
  }
}

/**
 * Mark a scan alert as resolved by an admin.
 */
export async function resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
  await prisma.scanAlert.update({
    where: { id: alertId },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
    },
  });
}
