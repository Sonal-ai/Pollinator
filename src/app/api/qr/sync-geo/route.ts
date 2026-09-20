import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluateScanAnomaly } from '@/lib/anti-clone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nonce, city, region, country, latitude, longitude } = body;

    if (!nonce) {
      return NextResponse.json({ error: 'Missing nonce parameter' }, { status: 400 });
    }

    const token = await prisma.qRToken.findUnique({
      where: { nonce },
      include: { batch: true },
    });

    if (!token) {
      return NextResponse.json({ error: 'QR Token not found' }, { status: 404 });
    }

    // Find the latest scan recorded for this token
    const latestScan = await prisma.qRScan.findFirst({
      where: { qrTokenId: token.id },
      orderBy: { timestamp: 'desc' },
    });

    if (latestScan) {
      // Update with client-reported dynamic geolocation
      await prisma.qRScan.update({
        where: { id: latestScan.id },
        data: {
          ipCity: city || latestScan.ipCity,
          ipRegion: region || latestScan.ipRegion,
          ipCountry: country || latestScan.ipCountry,
        },
      });
    }

    // Run impossible travel anomaly evaluation across scans
    const anomalyReport = await evaluateScanAnomaly({
      qrTokenId: token.id,
      batchId: token.batchId,
      batchCode: token.batch.batchCode,
      currentCity: city,
      currentRegion: region,
      currentCountry: country,
      currentLat: latitude,
      currentLon: longitude,
    });

    const totalScans = await prisma.qRScan.count({ where: { qrTokenId: token.id } });

    return NextResponse.json({
      success: true,
      hasAnomaly: anomalyReport.isAnomaly,
      anomalyReport,
      totalScans,
    });
  } catch (err: any) {
    console.error('[sync-geo] API error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
