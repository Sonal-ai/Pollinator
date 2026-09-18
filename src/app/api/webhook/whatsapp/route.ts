import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { handleIncomingMessage } from '@/lib/whatsapp/handler';
import { env } from '@/lib/env';

export const runtime = 'nodejs'; // Must use Node.js runtime — needs crypto module

// ============================================================
// GET — Meta Webhook Verification Challenge
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[webhook] Meta verification challenge passed');
    return new Response(challenge, { status: 200 });
  }

  console.warn('[webhook] Meta verification challenge FAILED — check WHATSAPP_VERIFY_TOKEN');
  return new Response('Forbidden', { status: 403 });
}

// ============================================================
// POST — Incoming Messages from Meta
// ============================================================

export async function POST(request: NextRequest) {
  // Read raw body as text FIRST — HMAC verification requires the raw bytes.
  // After .text(), cannot call .json() on the same request in Next.js 16.
  const rawBody = await request.text();

  // Verify HMAC-SHA256 signature from Meta
  const signature = request.headers.get('x-hub-signature-256') ?? '';
  const expectedSig =
    'sha256=' +
    createHmac('sha256', env.WHATSAPP_APP_SECRET)
      .update(rawBody)
      .digest('hex');

  // Timing-safe comparison prevents timing oracle attacks
  let signatureValid = false;
  try {
    signatureValid = timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    // Buffers differ in length → invalid signature (not a timing oracle risk here)
    signatureValid = false;
  }

  if (!signatureValid) {
    console.warn('[webhook] HMAC signature mismatch — rejecting request');
    return new Response('Unauthorized', { status: 401 });
  }

  // Parse body now that signature is verified
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request: Invalid JSON', { status: 400 });
  }

  // Return 200 immediately — Meta requires response within 5 seconds.
  // Message processing continues after response is sent.
  void handleIncomingMessage(body as Parameters<typeof handleIncomingMessage>[0]).catch((err: unknown) => {
    console.error('[webhook] handleIncomingMessage error:', err);
  });

  return new Response('OK', { status: 200 });
}
