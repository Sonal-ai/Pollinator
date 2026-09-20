import { prisma } from './db';

// ============================================================
// Anti-Clone IP & Impossible Travel Anomaly Detection
// ============================================================

const ANOMALY_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const HIGH_VOLUME_THRESHOLD = 25;        // Scans per QR token before flagging

export interface AnomalyReport {
  isAnomaly: boolean;
  type?: 'IMPOSSIBLE_TRAVEL' | 'CROSS_COUNTRY' | 'GEOGRAPHIC_TELEPORTATION' | 'HIGH_VOLUME';
  severity?: 'CRITICAL' | 'WARNING' | 'CLEAN';
  title?: string;
  message?: string;
  distanceKm?: number;
  timeDeltaMinutes?: number;
  speedKmh?: number;
  prevScanLocation?: string;
  currentScanLocation?: string;
  prevTimestamp?: string;
  currentTimestamp?: string;
}

const KNOWN_COORDINATES: Record<string, [number, number]> = {
  // Cities
  delhi: [28.6139, 77.2090],
  mumbai: [19.0760, 72.8777],
  wardha: [20.7453, 78.6022],
  bangalore: [12.9716, 77.5946],
  melbourne: [-37.8136, 144.9631],
  sydney: [-33.8688, 151.2093],
  london: [51.5074, -0.1278],
  newyork: [40.7128, -74.0060],
  sanfrancisco: [37.7749, -122.4194],
  singapore: [1.3521, 103.8198],
  tokyo: [35.6762, 139.6503],
  berlin: [52.5200, 13.4050],
  dubai: [25.2048, 55.2708],
  // Countries
  india: [20.5937, 78.9629],
  in: [20.5937, 78.9629],
  australia: [-25.2744, 133.7751],
  au: [-25.2744, 133.7751],
  unitedstates: [37.0902, -95.7129],
  us: [37.0902, -95.7129],
  unitedkingdom: [55.3781, -3.4360],
  gb: [55.3781, -3.4360],
  uk: [55.3781, -3.4360],
  germany: [51.1657, 10.4515],
  uae: [23.4241, 53.8478],
};

/**
 * Calculate Great-Circle distance between two points on Earth using the Haversine formula.
 * Returns distance in kilometers.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function resolveCoordinates(
  city?: string | null,
  region?: string | null,
  country?: string | null,
  providedLat?: number | null,
  providedLon?: number | null
): [number, number] | null {
  if (typeof providedLat === 'number' && typeof providedLon === 'number' && !isNaN(providedLat) && !isNaN(providedLon)) {
    return [providedLat, providedLon];
  }

  const clean = (s?: string | null) => (s ? s.toLowerCase().replace(/[^a-z]/g, '') : '');
  const c = clean(city);
  const r = clean(region);
  const co = clean(country);

  if (c && KNOWN_COORDINATES[c]) return KNOWN_COORDINATES[c];
  if (r && KNOWN_COORDINATES[r]) return KNOWN_COORDINATES[r];
  if (co && KNOWN_COORDINATES[co]) return KNOWN_COORDINATES[co];

  return null;
}

/**
 * Evaluates duplicate scan anomalies across recent scans for a QR token.
 * Uses the deterministic Impossible Travel Velocity algorithm (Haversine distance / delta time).
 */
export async function evaluateScanAnomaly(params: {
  qrTokenId: string;
  batchId?: string;
  batchCode?: string;
  currentCity?: string | null;
  currentRegion?: string | null;
  currentCountry?: string | null;
  currentLat?: number | null;
  currentLon?: number | null;
}): Promise<AnomalyReport> {
  const { qrTokenId, batchId, batchCode, currentCity, currentRegion, currentCountry, currentLat, currentLon } = params;

  try {
    const recentScans = await prisma.qRScan.findMany({
      where: { qrTokenId },
      orderBy: { timestamp: 'desc' },
      take: 6,
    });

    if (recentScans.length < 2) {
      return { isAnomaly: false, severity: 'CLEAN' };
    }

    // Current scan is index 0, prior scan is index 1
    const currentScan = recentScans[0];
    const prevScan = recentScans[1];

    const currentCoords = resolveCoordinates(
      currentCity || currentScan.ipCity,
      currentRegion || currentScan.ipRegion,
      currentCountry || currentScan.ipCountry,
      currentLat,
      currentLon
    );

    const prevCoords = resolveCoordinates(
      prevScan.ipCity,
      prevScan.ipRegion,
      prevScan.ipCountry,
      null,
      null
    );

    const timeDiffMs = Math.abs(currentScan.timestamp.getTime() - prevScan.timestamp.getTime());
    const timeDiffMinutes = Math.max(1, Math.round(timeDiffMs / (60 * 1000)));
    const timeDiffHours = timeDiffMinutes / 60;

    const curLocStr = [currentCity || currentScan.ipCity, currentRegion || currentScan.ipRegion, currentCountry || currentScan.ipCountry]
      .filter(Boolean)
      .join(', ') || 'Current Scan Node';

    const prevLocStr = [prevScan.ipCity, prevScan.ipRegion, prevScan.ipCountry]
      .filter(Boolean)
      .join(', ') || 'Initial Verified Node';

    // 1. Haversine Velocity Check if both coordinates are resolvable
    if (currentCoords && prevCoords) {
      const distanceKm = calculateHaversineDistanceKm(
        prevCoords[0],
        prevCoords[1],
        currentCoords[0],
        currentCoords[1]
      );

      const speedKmh = Math.round(distanceKm / Math.max(timeDiffHours, 0.016)); // minimum 1 min

      // Physical airliner speed limit: ~850 km/h. If distance > 100km and speed > 850 km/h: impossible travel!
      if (distanceKm > 100 && (speedKmh > 850 || timeDiffMinutes <= 15)) {
        const report: AnomalyReport = {
          isAnomaly: true,
          type: 'IMPOSSIBLE_TRAVEL',
          severity: 'CRITICAL',
          title: '🚨 IMPOSSIBLE TRAVEL · COUNTERFEIT CLONE DETECTED',
          message: `This jar QR was scanned in ${prevLocStr} and ${curLocStr} within ${timeDiffMinutes} minutes (${distanceKm.toLocaleString()} km apart). Physical jar cloning suspected!`,
          distanceKm,
          timeDeltaMinutes: timeDiffMinutes,
          speedKmh,
          prevScanLocation: prevLocStr,
          currentScanLocation: curLocStr,
          prevTimestamp: prevScan.timestamp.toISOString(),
          currentTimestamp: currentScan.timestamp.toISOString(),
        };

        if (batchId) {
          await createAlertIfNotExists({
            batchId,
            qrTokenId,
            alertType: 'GEOGRAPHIC_ANOMALY',
            details: JSON.stringify(report),
          });
        }

        return report;
      }
    }

    // 2. Cross-Country / Cross-Continent check
    const curCountry = (currentCountry || currentScan.ipCountry || '').toLowerCase();
    const prevCountry = (prevScan.ipCountry || '').toLowerCase();

    if (curCountry && prevCountry && curCountry !== prevCountry && timeDiffMinutes <= 180) {
      const distanceKm = 8000;
      const report: AnomalyReport = {
        isAnomaly: true,
        type: 'CROSS_COUNTRY',
        severity: 'CRITICAL',
        title: '🚨 CROSS-BORDER IMPOSSIBLE TRAVEL DETECTED',
        message: `This jar was scanned across borders (${prevCountry.toUpperCase()} ➔ ${curCountry.toUpperCase()}) in under ${timeDiffMinutes} minutes. Physical jar cloning suspected!`,
        distanceKm,
        timeDeltaMinutes: timeDiffMinutes,
        speedKmh: Math.round(distanceKm / (timeDiffMinutes / 60)),
        prevScanLocation: prevLocStr,
        currentScanLocation: curLocStr,
        prevTimestamp: prevScan.timestamp.toISOString(),
        currentTimestamp: currentScan.timestamp.toISOString(),
      };

      if (batchId) {
        await createAlertIfNotExists({
          batchId,
          qrTokenId,
          alertType: 'GEOGRAPHIC_ANOMALY',
          details: JSON.stringify(report),
        });
      }

      return report;
    }

    // 3. High Volume Spraying check
    const totalScans = await prisma.qRScan.count({ where: { qrTokenId } });
    if (totalScans >= HIGH_VOLUME_THRESHOLD) {
      const report: AnomalyReport = {
        isAnomaly: true,
        type: 'HIGH_VOLUME',
        severity: 'WARNING',
        title: '⚠️ HIGH SCAN VOLUME DETECTED',
        message: `This serialized jar has been scanned ${totalScans} times across multiple sessions. Duplicate labels may be circulating.`,
        timeDeltaMinutes: timeDiffMinutes,
        prevScanLocation: prevLocStr,
        currentScanLocation: curLocStr,
      };

      if (batchId) {
        await createAlertIfNotExists({
          batchId,
          qrTokenId,
          alertType: 'HIGH_VOLUME',
          details: JSON.stringify(report),
        });
      }

      return report;
    }

    return { isAnomaly: false, severity: 'CLEAN' };
  } catch (err) {
    console.error('[anti-clone] evaluateScanAnomaly error:', err);
    return { isAnomaly: false, severity: 'CLEAN' };
  }
}

/**
 * Check for duplicate-scan anomalies after a QR scan (backward-compatibility wrapper).
 */
export async function checkDuplicateScanAnomaly(params: {
  qrTokenId: string;
  batchId: string;
  batchCode: string;
  newScanId: string;
  ipRegion: string | null;
}): Promise<void> {
  await evaluateScanAnomaly({
    qrTokenId: params.qrTokenId,
    batchId: params.batchId,
    batchCode: params.batchCode,
    currentRegion: params.ipRegion,
  });
}

/**
 * Create a ScanAlert only if one doesn't already exist for this token+type.
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
