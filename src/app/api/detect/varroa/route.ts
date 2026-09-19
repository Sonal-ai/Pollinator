import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { detectVarroaFromBuffer } from '@/lib/varroa-detector';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    let buffer: Buffer;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('image') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No image file provided in form-data' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const body = await req.json();
      if (!body.image) {
        return NextResponse.json({ error: 'No image field provided in JSON payload' }, { status: 400 });
      }
      buffer = Buffer.from(body.image, 'base64');
    }

    // Run inference on AWS Lambda Varroa Detector
    const result = await detectVarroaFromBuffer(buffer);
    const imageHash = createHash('sha256').update(buffer).digest('hex');

    // Link to logged-in beekeeper if session exists
    const session = await getSession();
    let beekeeperId: string | null = null;
    let hiveId: string | null = null;

    if (session?.walletAddress) {
      const bk = await prisma.beekeeper.findFirst({
        where: { wallet: session.walletAddress },
        include: { hives: { take: 1 } },
      });
      beekeeperId = bk?.id ?? null;
      hiveId = bk?.hives?.[0]?.id ?? null;
    }

    const maxConfidence = result.detections.length > 0
      ? Math.max(...result.detections.map((d) => d.confidence))
      : 0.95;

    const record = await prisma.aIInference.create({
      data: {
        beekeeperId,
        hiveId,
        modelVersion: 'yolo11l-varroa-onnx-v1.0',
        inputImageHash: imageHash,
        prediction: result.alert.level === 'GREEN' ? 'healthy' : 'varroa_parasite_suspected',
        confidence: maxConfidence,
        rawOutput: JSON.stringify(result),
      },
    });

    return NextResponse.json({
      inferenceId: record.id,
      ...result,
    });
  } catch (error: unknown) {
    console.error('[api/detect/varroa] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal detection error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
