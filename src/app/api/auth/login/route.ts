import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// ============================================================
// POST /api/auth/login — Set session cookie
// ============================================================

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; role?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password, role } = body;

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }
  
  if (!password || password.length < 6) {
    return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const validRoles = ['admin', 'processor', 'lab', 'distributor', 'retailer', 'beekeeper'];
  if (!role || !validRoles.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Abstraction: Deterministically derive a custodial wallet from the user's email
  const { createHmac } = await import('crypto');
  const { ethers } = await import('ethers');
  const secret = process.env.JWT_SECRET || 'pollinator-fallback-secret';
  const privateKeyHex = '0x' + createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
  const walletAddress = new ethers.Wallet(privateKeyHex).address;

  const { createSessionToken } = await import('@/lib/auth');
  const token = await createSessionToken({ walletAddress, role });

  const cookieStore = await cookies();
  cookieStore.set('pollinator_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return Response.json({ success: true, role, walletAddress });
}

// ============================================================
// POST /api/auth/logout
// ============================================================

export async function DELETE(_request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete('pollinator_session');
  return Response.json({ success: true });
}
