import { SignJWT, jwtVerify } from 'jose';
const ISSUER = 'pollinator';
const AUDIENCE = 'pollinator-dashboard';
function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || secret.startsWith('change_me') ||
      secret === 'pollinator_super_secure_jwt_secret_min_32_chars!') {
    throw new Error('Configure a unique JWT_SECRET of at least 32 bytes before enabling dashboard login.');
  }
  return new TextEncoder().encode(secret);
}
export async function createSessionToken(account: { id: string; sessionVersion: number }): Promise<string> {
  return new SignJWT({ version: 2, sessionVersion: account.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(account.id).setIssuer(ISSUER)
    .setAudience(AUDIENCE).setIssuedAt().setExpirationTime('8h').sign(secretKey());
}
/** Proxy check only. Privileged code must reload the active database account. */
export async function verifySessionToken(token: string): Promise<{ accountId: string; sessionVersion: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
    });
    if (payload.version !== 2 || typeof payload.sub !== 'string' || !payload.sub ||
        !Number.isInteger(payload.sessionVersion) || Number(payload.sessionVersion) < 0) return null;
    return { accountId: payload.sub, sessionVersion: Number(payload.sessionVersion) };
  } catch { return null; }
}
