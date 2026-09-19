import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

export interface SessionPayload {
  walletAddress: string;
  role: string;
}

const DEFAULT_SECRET = 'pollinator_super_secure_jwt_secret_min_32_chars!';

function getJwtSecretKey(): Uint8Array {
  const secretStr = env.JWT_SECRET || process.env.JWT_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secretStr);
}

/**
 * Sign a cryptographic JWT session token with 24-hour expiration.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getJwtSecretKey();
  return new SignJWT({
    walletAddress: payload.walletAddress,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

/**
 * Verify a JWT session token and extract the payload.
 * Returns null if invalid or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secret = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    if (!payload.walletAddress || !payload.role) {
      return null;
    }

    return {
      walletAddress: String(payload.walletAddress),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

/**
 * Helper to retrieve and verify the active session from server cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('pollinator_session');
    if (!sessionCookie?.value) return null;
    return await verifySessionToken(sessionCookie.value);
  } catch {
    return null;
  }
}
