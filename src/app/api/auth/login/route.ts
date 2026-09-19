import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// ============================================================
// POST /api/auth/login — Set session cookie
// ============================================================

export async function POST(request: NextRequest) {
  let body: { walletAddress?: string; role?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { walletAddress, role } = body;

  if (!walletAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
    return Response.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const validRoles = ['admin', 'processor', 'lab', 'distributor', 'retailer', 'beekeeper'];
  if (!role || !validRoles.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }

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
