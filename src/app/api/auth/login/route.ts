import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { authenticatePassword, LoginSchema } from '@/lib/account-auth';
import { normalizeLoginIdentifier } from '@/lib/identity';
import { createSessionToken } from '@/lib/session-token';
import { consumeLoginAttempt } from '@/lib/login-rate-limit';
import { prisma } from '@/lib/db';
import { allowedRequestOrigin } from '@/lib/request-origin';

async function readLoginBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > 4096) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return null; }
      chunks.push(result.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export async function POST(request: NextRequest) {
  if (!allowedRequestOrigin(request)) return Response.json({ error: 'Forbidden origin' }, { status: 403 });
  let body: unknown;
  try {
    const raw = await readLoginBody(request);
    if (raw === null) return Response.json({ error: 'Request too large' }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Identifier and password are required.' }, { status: 400 });
  const identifier = normalizeLoginIdentifier(parsed.data.identifier);
  if (!identifier) return Response.json({ error: 'Invalid identifier or password.' }, { status: 401 });
  try {
    if (!await consumeLoginAttempt(identifier)) {
      return Response.json({ error: 'Too many sign-in attempts. Please try again later.' }, {
        status: 429, headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' },
      });
    }
    const account = await authenticatePassword(parsed.data, (value) =>
      prisma.dashboardAccount.findUnique({ where: { identifier: value } }));
    if (!account) return Response.json({ error: 'Invalid identifier or password.' }, { status: 401 });
    const token = await createSessionToken(account);
    (await cookies()).set('pollinator_session', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      maxAge: 8 * 60 * 60, path: '/',
    });
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Sign-in is temporarily unavailable. Contact the platform administrator.' }, { status: 503 });
  }
}
export async function DELETE() {
  (await cookies()).delete('pollinator_session');
  return Response.json({ success: true });
}
