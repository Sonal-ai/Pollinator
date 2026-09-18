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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Honey Batch Registry</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} batches total</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/dashboard?status=RECALLED"
            className="text-sm px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
          >
            🚨 Recalled
          </a>
          <a
            href="/dashboard"
            className="text-sm px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            All Batches
          </a>
        </div>
      </div>

      {/* Batch Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Batch Code</th>
                <th className="px-5 py-3">Honey Type</th>
                <th className="px-5 py-3">Qty (kg)</th>
                <th className="px-5 py-3">Beekeeper</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Lab ✓</th>
                <th className="px-5 py-3">QRs</th>
                <th className="px-5 py-3">Alerts</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {batches.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                    No honey batches found. Register a harvest via WhatsApp to get started.
                  </td>
                </tr>
              )}
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-gray-700 font-medium">
                    {batch.batchCode}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{batch.honey_type}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {(batch.quantity_grams / 1000).toFixed(1)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {batch.beekeeper?.name ?? '—'}
                    {batch.beekeeper?.region && (
                      <span className="text-gray-400 text-xs block">{batch.beekeeper.region}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(batch.status)}`}>
                      {batch.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {batch.lab_verified ? (
                      <span className="text-green-600 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 text-center">
                    {batch._count.qrTokens > 0 ? batch._count.qrTokens : '—'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {batch._count.scanAlerts > 0 ? (
                      <span className="text-red-600 font-bold text-xs">⚠ {batch._count.scanAlerts}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/dashboard/batch/${batch.batchCode}`}
                      className="text-sm text-amber-600 hover:text-amber-800 font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <a href={`?page=${page - 1}${status ? `&status=${status}` : ''}`}
                  className="px-3 py-1.5 border rounded-lg hover:bg-gray-50">← Prev</a>
              )}
              {page < pages && (
                <a href={`?page=${page + 1}${status ? `&status=${status}` : ''}`}
                  className="px-3 py-1.5 border rounded-lg hover:bg-gray-50">Next →</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
