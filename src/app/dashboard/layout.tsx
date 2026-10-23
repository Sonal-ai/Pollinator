import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { LayoutDashboard, Package, FileCheck, Truck, Wifi, LineChart, AlertOctagon, LogOut, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Harvest & batches', icon: LayoutDashboard, roles: ['admin', 'beekeeper', 'processor', 'lab', 'distributor', 'retailer'] },
  { href: '/dashboard/operations', label: 'Approvals & receipts', icon: FileCheck, roles: ['admin', 'beekeeper', 'processor', 'lab', 'distributor', 'retailer'] },
  { href: '/dashboard/deploy', label: 'Contract deployment', icon: FileCheck, roles: ['admin'] },
  { href: '/dashboard/custody', label: 'Custody', icon: Truck, roles: ['admin', 'beekeeper', 'processor', 'lab', 'distributor', 'retailer'] },
  { href: '/dashboard/iot', label: 'Hive monitoring', icon: Wifi, roles: ['admin', 'beekeeper'] },
  { href: '/dashboard/health', label: 'Bee health', icon: ShieldAlert, roles: ['admin', 'beekeeper'] },
  { href: '/dashboard/processor', label: 'Packaging & labels', icon: Package, roles: ['admin', 'processor'] },
  { href: '/dashboard/lab', label: 'Lab evidence', icon: FileCheck, roles: ['admin', 'lab'] },
  { href: '/dashboard/analytics', label: 'Scan insights', icon: LineChart, roles: ['admin'] },
  { href: '/dashboard/recall', label: 'Recall management', icon: AlertOctagon, roles: ['admin'] },
];
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>;
  const items = NAV_ITEMS.filter(item => item.roles.includes(session.role));
  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <Link href="/" className="product-brand"><Image src="/logo-mark.png" width={31} height={31} alt="" /><span>pollinator<span className="brand-dot">.</span><small>HONEY CHAIN</small></span></Link>
      <p className="eyebrow">CLUSTER WORKSPACE</p>
      <nav aria-label="Workspace">{items.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href}><Icon size={17} /><span>{item.label}</span></Link>; })}</nav>
      <div className="dashboard-account"><span className="eyebrow">{session.role}</span><code>{session.walletAddress.slice(0, 8)}…{session.walletAddress.slice(-6)}</code><p>Account wallet reference</p></div>
      <form method="POST" action="/api/auth/logout"><button type="submit"><LogOut size={16} />Sign out</button></form>
    </aside>
    <div className="dashboard-content">
      <header className="dashboard-topbar"><Link href="/" className="dashboard-home">Honey Chain <ArrowUpRight size={15} /></Link><span className="dashboard-role">{session.role}</span><ThemeToggle /><form method="POST" action="/api/auth/logout" className="dashboard-mobile-logout"><button type="submit" aria-label="Sign out"><LogOut size={17} /></button></form></header>
      <nav className="dashboard-mobile-nav" aria-label="Mobile workspace">{items.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      <main className="dashboard-main">{children}</main>
    </div>
  </div>;
}
