import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
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
    // Top 10 most-scanned QR tokens
    prisma.qRToken.findMany({
      orderBy: { scans: { _count: 'desc' } },
      take: 10,
      include: {
        batch: { select: { batchCode: true, honey_type: true, recalled: true } },
        _count: { select: { scans: true } },
      },
    }),
  ]);

  // Today's scan count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayScans = await prisma.qRScan.count({
    where: { timestamp: { gte: todayStart } },
  });

  // Geographic scan distribution
  const geoDistribution = await prisma.qRScan.groupBy({
    by: ['ipCountry', 'ipRegion'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
    where: { ipCountry: { not: null } },
  });

  const unresolvedCount = recentAlerts.length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🔍 Scan Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">QR scan patterns and anti-clone anomaly detection</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Scans', value: totalScans, icon: '📱', color: 'text-blue-600' },
          { label: 'Scans Today', value: todayScans, icon: '📅', color: 'text-green-600' },
          { label: 'Unresolved Alerts', value: unresolvedCount, icon: '🚨', color: 'text-red-600' },
          { label: 'Monitored Regions', value: geoDistribution.length, icon: '🌍', color: 'text-purple-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Unresolved Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
            🚨 Anomaly Alerts
            {unresolvedCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{unresolvedCount} unresolved</span>
            )}
          </h2>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              <p className="text-2xl mb-2">✅</p>
              No anomalies detected
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="border border-red-100 bg-red-50 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-red-800 text-xs">{alert.alertType.replace(/_/g, ' ')}</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        Batch: <span className="font-mono">{alert.batch?.batchCode ?? '—'}</span>
                      </p>
                      <p className="text-gray-400 text-xs">{new Date(alert.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                    <a href={`/dashboard/recall`}
                      className="shrink-0 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">
                      Review
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">🌍 Scan Geography</h2>
          {geoDistribution.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No geographic data yet</p>
          ) : (
            <div className="space-y-2">
              {geoDistribution.map((row, i) => {
                const maxCount = geoDistribution[0]._count.id;
                const pct = Math.round((row._count.id / maxCount) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-gray-600">{row.ipRegion ?? '—'}, {row.ipCountry}</span>
                      <span className="text-gray-500 font-medium">{row._count.id}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3 italic">
            Geolocation accuracy: ~50km. VPNs may show incorrect locations.
          </p>
        </div>

        {/* Most Scanned QRs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">📊 Most Scanned QR Tokens</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase border-b border-gray-100">
              <tr>
                <th className="pb-2 text-left">Batch Code</th>
                <th className="pb-2 text-left">Honey Type</th>
                <th className="pb-2 text-right">Scan Count</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topScannedBatches.map((token) => (
                <tr key={token.id} className="hover:bg-gray-50">
                  <td className="py-2.5 font-mono text-xs">{token.batch.batchCode}</td>
                  <td className="py-2.5 text-gray-600">{token.batch.honey_type}</td>
                  <td className={`py-2.5 text-right font-bold ${token._count.scans > 30 ? 'text-red-600' : 'text-gray-700'}`}>
                    {token._count.scans}
                    {token._count.scans > 30 && ' ⚠'}
                  </td>
                  <td className="py-2.5 text-right">
                    {token.batch.recalled
                      ? <span className="text-red-600 text-xs font-bold">RECALLED</span>
                      : <span className="text-green-600 text-xs">Active</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
