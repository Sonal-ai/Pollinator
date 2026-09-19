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

  const rawIdentifier = (body.email || (body as { identifier?: string }).identifier || '').trim();
  const password = (body.password || '').trim();
  let role = body.role || 'admin';

  if (!rawIdentifier) {
    return Response.json({ error: 'Please provide an email address or phone number' }, { status: 400 });
  }

  const isPhone = /^\+?[0-9\s-]{7,15}$/.test(rawIdentifier);
  let walletAddress: string;

  const { createHmac } = await import('crypto');
  const { ethers } = await import('ethers');
  const { prisma } = await import('@/lib/db');
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.JWT_SECRET || 'pollinator-fallback-secret';

  if (isPhone) {
    // Phone Number Login (WhatsApp Beekeeper Direct Access - No Password Required)
    const normalizedPhone = rawIdentifier.replace(/[\s-]/g, '');
    let beekeeper = await prisma.beekeeper.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: normalizedPhone.replace(/^\+/, '') },
          { phone: `+${normalizedPhone.replace(/^\+/, '')}` },
        ],
      },
    });

    // Derive deterministic wallet from phone number (matching WhatsApp onboarding)
    const privateKeyHex = '0x' + createHmac('sha256', secret).update(normalizedPhone).digest('hex');
    const derivedWallet = new ethers.Wallet(privateKeyHex).address;

    if (!beekeeper) {
      // Auto-register beekeeper if first time visiting web dashboard via phone
      beekeeper = await prisma.beekeeper.create({
        data: {
          phone: normalizedPhone,
          name: `Farmer (${normalizedPhone.slice(-4)})`,
          region: 'India Regional Cluster',
          wallet: derivedWallet,
        },
      });
    }

    walletAddress = beekeeper.wallet || derivedWallet;
    role = 'beekeeper';
  } else {
    // Standard Enterprise Email Login (requires password)
    if (!rawIdentifier.includes('@')) {
      return Response.json({ error: 'Invalid email address or phone number' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters for email login' }, { status: 400 });
    }

    const validRoles = ['admin', 'processor', 'lab', 'distributor', 'retailer', 'beekeeper'];
    if (!role || !validRoles.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const privateKeyHex = '0x' + createHmac('sha256', secret).update(rawIdentifier.toLowerCase()).digest('hex');
    walletAddress = new ethers.Wallet(privateKeyHex).address;
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

  return Response.json({ success: true, role, walletAddress, isPhone });
}

// ============================================================
// POST /api/auth/logout
// ============================================================

export async function DELETE(_request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete('pollinator_session');
  return Response.json({ success: true });
}
