import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// Middleware — Rate Limiting + Dashboard Auth Guard
// ============================================================

// Simple in-memory rate limiter (per IP)
// In production: replace with Redis-backed rate limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return true;
  }

  return false;
}

// Clean up stale entries every 5 minutes (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1';

  // ── Auth guard: protect all /dashboard/* except /dashboard/login ──
  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/login')) {
    const session = request.cookies.get('pollinator_session');
    if (!session) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url));
    }
    // Basic session validity check (not cryptographic — prototype grade)
    try {
      JSON.parse(Buffer.from(session.value, 'base64').toString());
    } catch {
      const response = NextResponse.redirect(new URL('/dashboard/login', request.url));
      response.cookies.delete('pollinator_session');
      return response;
    }
  }

  // ── Rate limit: WhatsApp webhook (Meta sends bursts of up to 100/min) ──
  if (pathname.startsWith('/api/webhook/whatsapp')) {
    if (isRateLimited(ip, 200, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  // ── Rate limit: QR verify page (public, high traffic) ──
  if (pathname.startsWith('/verify')) {
    if (isRateLimited(ip, 60, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  // ── Rate limit: API routes (protect against abuse) ──
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhook')) {
    if (isRateLimited(ip, 100, 60_000)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except static files and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
