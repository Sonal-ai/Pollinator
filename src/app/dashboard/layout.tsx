import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

// ============================================================
// Dashboard Layout — Sidebar Navigation + Auth Guard
// ============================================================

const NAV_ITEMS = [
  { href: '/dashboard',           label: '📋 Batch Registry',    roles: ['admin', 'processor', 'lab', 'distributor', 'retailer'] },
  { href: '/dashboard/processor', label: '🏭 Package & QR',      roles: ['admin', 'processor'] },
  { href: '/dashboard/lab',       label: '🧪 Lab Certificates',  roles: ['admin', 'lab'] },
  { href: '/dashboard/custody',   label: '🔄 Custody Transfer',  roles: ['admin', 'processor', 'distributor', 'retailer'] },
  { href: '/dashboard/iot',       label: '📡 IoT Dashboard',     roles: ['admin', 'beekeeper'] },
  { href: '/dashboard/analytics', label: '🔍 Scan Analytics',    roles: ['admin'] },
  { href: '/dashboard/recall',    label: '🚨 Recall Management', roles: ['admin'] },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Auth guard: check for session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('pollinator_session');

  if (!sessionCookie) {
    redirect('/dashboard/login');
  }

  // Parse session (basic JWT-like; in production use jose or similar)
  let session: { walletAddress?: string; role?: string; name?: string } = {};
  try {
    session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
  } catch {
    redirect('/dashboard/login');
  }

  const role = session.role ?? 'admin';
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🐝</span>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">Pollinator</p>
              <p className="text-xs text-gray-500">Supply Chain Portal</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-xs">
              {role.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">
                {session.walletAddress?.slice(0, 8)}...{session.walletAddress?.slice(-4)}
              </p>
              <p className="text-xs text-gray-500 capitalize">{role}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="POST" className="mt-3">
            <button type="submit" className="w-full text-xs text-gray-500 hover:text-red-600 text-left">
              Sign out →
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
