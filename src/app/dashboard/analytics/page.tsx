import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { 
  Radar, 
  ShieldAlert, 
  Smartphone, 
  Globe2, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  await requireSession(['admin']);
  const [totalScans, recentAlerts, topScannedBatches] = await Promise.all([
    prisma.qRScan.count(),
    prisma.scanAlert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        batch: { select: { batchCode: true, honey_type: true } },
      },
    }),
    prisma.qRToken.findMany({
      orderBy: { scans: { _count: 'desc' } },
      take: 10,
      include: {
        batch: { select: { batchCode: true, honey_type: true, recalled: true } },
        _count: { select: { scans: true } },
      },
    }),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayScans = await prisma.qRScan.count({
    where: { timestamp: { gte: todayStart } },
  });

  const geoDistribution = await prisma.qRScan.groupBy({
    by: ['ipCountry', 'ipRegion'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
    where: { ipCountry: { not: null } },
  });

  const unresolvedCount = recentAlerts.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <Radar className="w-7 h-7 text-[var(--accent-ink)]" />
            Anti-Clone QR Radar & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Real-time duplicate scan anomaly detection and consumer engagement telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Anti-Clone Engine: Guard Active</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Verified Scans', value: totalScans, icon: Smartphone, color: 'text-[var(--accent-ink)]', glow: 'border-amber-500/30' },
          { label: 'Scans Today', value: todayScans, icon: Calendar, color: 'text-cyan-400', glow: 'border-cyan-500/30' },
          { label: 'Unresolved Alerts', value: unresolvedCount, icon: ShieldAlert, color: 'text-red-400', glow: 'border-red-500/30' },
          { label: 'Monitored Regions', value: geoDistribution.length, icon: Globe2, color: 'text-emerald-400', glow: 'border-emerald-500/30' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`rounded-3xl border ${stat.glow} bg-[var(--surface-solid)] backdrop-blur-2xl p-5 space-y-2 shadow-xl`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] font-medium">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className={`text-2xl sm:text-3xl font-extrabold font-mono ${stat.color}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* 2 Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unresolved Alerts */}
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Anomaly Alerts ({unresolvedCount})
            </h2>
            <Link
              href="/dashboard/recall"
              className="text-xs text-[var(--text-muted)] hover:text-foreground transition-colors"
            >
              Manage Recalls →
            </Link>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)] space-y-2">
              <p className="text-2xl">🛡️</p>
              <p className="font-semibold text-foreground">No duplicate scan anomalies detected</p>
              <p className="text-[var(--text-muted)]">Every scanned QR is geographically coherent.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-2xl bg-red-950/20 border border-red-500/30 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-red-300 uppercase font-mono text-[11px]">
                      {alert.alertType.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[var(--text-muted)]">
                      Batch: <span className="font-mono text-foreground">{alert.batch?.batchCode}</span>
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono">
                      {new Date(alert.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/recall"
                    className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-[11px] font-semibold transition-colors shrink-0"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scan Geography */}
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Globe2 className="w-4 h-4" /> Scan Distribution by Region
            </h2>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">IP Geolocation</span>
          </div>

          {geoDistribution.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)]">
              Awaiting consumer QR scan events...
            </div>
          ) : (
            <div className="space-y-3">
              {geoDistribution.map((row, i) => {
                const maxCount = geoDistribution[0]._count.id;
                const pct = Math.round((row._count.id / maxCount) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{row.ipRegion ?? 'Unknown'}, {row.ipCountry}</span>
                      <span className="font-mono text-[var(--text-muted)] font-bold">{row._count.id} scans</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Scanned Tokens */}
        <div className="lg:col-span-2 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[var(--accent-ink)]" /> High-Velocity QR Tokens
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--surface-border)]">
                <tr>
                  <th className="py-2.5 px-3">Batch Code</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-center">Lifetime Scans</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topScannedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--text-muted)]">No token activity recorded yet.</td>
                  </tr>
                ) : (
                  topScannedBatches.map((token) => (
                    <tr key={token.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-foreground">{token.batch.batchCode}</td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)] font-sans">{token.batch.honey_type}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-[var(--accent-ink)]">
                        {token._count.scans}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {token.batch.recalled ? (
                          <span className="text-red-400 font-bold text-[10px]">RECALLED</span>
                        ) : (
                          <span className="text-emerald-400 text-[10px]">ACTIVE</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
