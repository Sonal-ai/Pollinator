import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Status badge styling
function statusBadge(status: string) {
  const map: Record<string, string> = {
    HARVESTED:       'bg-blue-100 text-blue-700',
    PROCESSED:       'bg-purple-100 text-purple-700',
    LAB_VERIFIED:    'bg-green-100 text-green-700',
    PACKAGED:        'bg-teal-100 text-teal-700',
    IN_DISTRIBUTION: 'bg-orange-100 text-orange-700',
    AT_RETAIL:       'bg-yellow-100 text-yellow-700',
    SOLD:            'bg-gray-100 text-gray-700',
    RECALLED:        'bg-red-100 text-red-700',
    PENDING_CHAIN:   'bg-amber-100 text-amber-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const page   = Math.max(1, parseInt(sp.page ?? '1', 10));
  const status = sp.status;
  const limit  = 20;

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('pollinator_session');
  
  let walletAddress: string | null = null;
  let role = 'admin';

  if (sessionCookie) {
    try {
      const session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
      walletAddress = session.walletAddress ?? null;
      role = session.role ?? 'admin';
    } catch { /* ignore */ }
  }

  // Filter based on role
  const where: any = status ? { status } : {};
  if (role === 'beekeeper' && walletAddress) {
    where.beekeeper = { walletAddress: { equals: walletAddress, mode: 'insensitive' } };
  }

  const [batches, total] = await Promise.all([
    prisma.honeyBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        beekeeper: { select: { name: true, region: true } },
        _count: { select: { qrTokens: true, scanAlerts: { where: { resolved: false } } } },
      },
    }),
    prisma.honeyBatch.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 tracking-tight">
            Batch Registry
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage and track your honey supply chain • {total} records</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/dashboard?status=RECALLED"
            className="flex items-center gap-2 text-sm px-4 py-2 bg-white/50 backdrop-blur-md border border-red-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            View Recalled
          </a>
          <a
            href="/dashboard"
            className="text-sm font-medium px-5 py-2 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all"
          >
            All Batches
          </a>
        </div>
      </div>

      {/* Batch Table / Grid */}
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 overflow-hidden flex-1">
        <div className="overflow-x-auto h-full">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-100/60">
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4">Batch Code</th>
                <th className="px-6 py-4">Origin & Type</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Alerts</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-4xl mb-3">🍯</span>
                      <p className="font-medium">No batches found.</p>
                      <p className="text-xs mt-1">Wait for a Beekeeper to log a harvest.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-amber-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-bold text-slate-800 bg-slate-100/50 w-fit px-2 py-1 rounded-md border border-slate-200/50">
                        {b.batchCode}
                      </div>
                      <div className="text-xs text-slate-400 mt-1.5 font-medium truncate max-w-[150px]" title={b.id}>
                        id: {b.id.slice(-8)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-800">{b.honey_type}</div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        {b.beekeeper?.name ?? 'Unknown'} • {(b as any).region ?? b.beekeeper?.region}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800">
                        {(b.quantity_grams / 1000).toFixed(1)} <span className="text-slate-400 text-xs">KG</span>
                      </div>
                      {b._count.qrTokens > 0 && (
                        <div className="text-[10px] uppercase font-bold tracking-wider text-teal-600 mt-1 bg-teal-50 w-fit px-1.5 py-0.5 rounded">
                          {b._count.qrTokens} Jars
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${statusBadge(
                          b.status
                        )}`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {b._count.scanAlerts > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold ring-4 ring-red-50">
                          {b._count.scanAlerts}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/batch/${b.batchCode}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View
                        <span className="text-[10px]">→</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6 px-2">
          <p className="text-sm font-medium text-slate-500">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <Link
              href={`/dashboard?page=${page - 1}${status ? `&status=${status}` : ''}`}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                page <= 1 
                  ? 'bg-slate-100 text-slate-400 pointer-events-none' 
                  : 'bg-white text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-200'
              }`}
            >
              Previous
            </Link>
            <Link
              href={`/dashboard?page=${page + 1}${status ? `&status=${status}` : ''}`}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                page >= pages 
                  ? 'bg-slate-100 text-slate-400 pointer-events-none' 
                  : 'bg-white text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-200'
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
