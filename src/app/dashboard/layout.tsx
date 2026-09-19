import Link from 'next/link';
import Image from 'next/image';
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
  Hexagon,
  ExternalLink,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import PageTransition from './PageTransition';
import { NetworkBadge } from '@/components/ui/network-badge';

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Batch Registry',       icon: LayoutDashboard, roles: ['admin', 'processor', 'lab', 'distributor', 'retailer'] },
  { href: '/dashboard/processor', label: 'Package & QR',         icon: Package,         roles: ['admin', 'processor'] },
  { href: '/dashboard/lab',       label: 'Lab Certificates',     icon: FileCheck,       roles: ['admin', 'lab'] },
  { href: '/dashboard/custody',   label: 'Custody Transfer',     icon: Truck,           roles: ['admin', 'processor', 'distributor', 'retailer'] },
  { href: '/dashboard/iot',       label: 'IoT Telemetry',        icon: Wifi,            roles: ['admin', 'beekeeper'] },
  { href: '/dashboard/health',    label: 'Bee Health AI',        icon: ShieldAlert,     roles: ['admin', 'beekeeper'] },
  { href: '/dashboard/analytics', label: 'Scan Analytics',       icon: LineChart,       roles: ['admin'] },
  { href: '/dashboard/recall',    label: 'Recall Management',    icon: AlertOctagon,    roles: ['admin'] },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();

  if (!session) {
    return <div className="min-h-screen bg-[#07090e] text-slate-100">{children}</div>;
  }

  const role = session.role ?? 'admin';
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const shortWallet = session.walletAddress
    ? `${session.walletAddress.slice(0, 6)}...${session.walletAddress.slice(-4)}`
    : '0x06a7...4607';

  return (
    <div className="flex h-screen overflow-hidden bg-[#07090e] text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-64 w-[600px] h-[300px] bg-amber-500/10 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-orange-600/5 blur-[150px] pointer-events-none -z-10" />

      {/* Floating Glass Sidebar */}
      <aside className="w-[280px] m-4 mr-0 rounded-3xl bg-[#0d111a]/85 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col z-20">
        {/* Brand Logo */}
        <div className="px-6 py-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 shadow-lg shadow-yellow-500/25 group-hover:scale-105 transition-transform duration-300 p-1.5">
              <Image
                src="/logo-mark.png"
                alt="Pollinators Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="font-extrabold text-white text-base tracking-tight group-hover:text-yellow-400 transition-colors">
                Pollinators
              </p>
              <p className="text-[10px] font-mono font-bold text-yellow-400/80 uppercase tracking-widest">
                SUPPLY CHAIN
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-200 group"
              >
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Web3 Wallet Badge */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-500">Connected Wallet</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {role}
              </span>
            </div>
            <p className="font-mono text-xs text-white font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              {shortWallet}
            </p>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 rounded-xl transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative z-10 flex flex-col">
        {/* Top Floating Utility Bar */}
        <header className="px-8 pt-6 pb-2 flex items-center justify-between">
          <NetworkBadge />
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            Public Gateway <ExternalLink className="w-3 h-3" />
          </Link>
        </header>

        <div className="p-8 max-w-6xl w-full mx-auto flex-1">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
