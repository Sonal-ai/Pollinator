import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  FileCheck, 
  Truck, 
  Wifi, 
  LineChart, 
  AlertOctagon, 
  LogOut,
  Hexagon
} from 'lucide-react';
import PageTransition from './PageTransition';

// ============================================================
// Dashboard Layout — Premium Glassmorphic Navigation
// ============================================================

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Batch Registry',       icon: LayoutDashboard, roles: ['admin', 'processor', 'lab', 'distributor', 'retailer'] },
  { href: '/dashboard/processor', label: 'Package & QR',         icon: Package,         roles: ['admin', 'processor'] },
  { href: '/dashboard/lab',       label: 'Lab Certificates',     icon: FileCheck,       roles: ['admin', 'lab'] },
  { href: '/dashboard/custody',   label: 'Custody Transfer',     icon: Truck,           roles: ['admin', 'processor', 'distributor', 'retailer'] },
  { href: '/dashboard/iot',       label: 'IoT Telemetry',        icon: Wifi,            roles: ['admin', 'beekeeper'] },
  { href: '/dashboard/analytics', label: 'Scan Analytics',       icon: LineChart,       roles: ['admin'] },
  { href: '/dashboard/recall',    label: 'Recall Management',    icon: AlertOctagon,    roles: ['admin'] },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Auth guard: check for session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('pollinator_session');

  if (!sessionCookie) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Parse session
  let session: { walletAddress?: string; role?: string; name?: string } = {};
  try {
    session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
  } catch {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const role = session.role ?? 'admin';
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans selection:bg-amber-200">
      
      {/* Background ambient gradient */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-br from-amber-100/40 via-orange-50/20 to-transparent -z-10" />

      {/* Floating Glass Sidebar */}
      <aside className="w-[280px] m-4 mr-0 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col z-10">
        {/* Logo */}
        <div className="px-8 py-8">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-all duration-300">
              <Hexagon className="w-6 h-6 fill-white/20" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg leading-tight tracking-tight">Pollinator</p>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Supply Chain</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-white hover:text-amber-600 hover:shadow-sm border border-transparent hover:border-slate-100 transition-all duration-200 group"
              >
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Info & Logout (Bottom Pinned) */}
        <div className="p-4 mt-auto">
          <div className="p-4 rounded-xl bg-white/80 border border-slate-100 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold border border-slate-200 shadow-inner">
                {role.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {session.walletAddress?.slice(0, 6)}...{session.walletAddress?.slice(-4)}
                </p>
                <p className="text-[11px] text-amber-600 uppercase tracking-wider font-bold">{role}</p>
              </div>
            </div>
            
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative z-0">
        <div className="p-8 max-w-6xl mx-auto h-full">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
