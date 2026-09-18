import { prisma } from '@/lib/db';
import Link from 'next/link';
import { RecallButton, ResolveButton } from './admin-actions';

export const dynamic = 'force-dynamic';

export default async function RecallPage() {
  const [alerts, recalledBatches] = await Promise.all([
    prisma.scanAlert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      include: {
        batch: { select: { id: true, batchCode: true, honey_type: true, status: true, recalled: true } },
      },
    }),
    prisma.honeyBatch.findMany({
      where: { recalled: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { qrTokens: true } },
      },
    }),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🚨 Recall Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review anomaly alerts and initiate batch recalls</p>
      </div>

      {/* Unresolved Alerts */}
      <section>
        <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4">
          ⚠️ Unresolved Anomaly Alerts ({alerts.length})
        </h2>
        {alerts.length === 0 ? (
          <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center text-sm text-green-700">
            ✅ No unresolved alerts — system is clean
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-white border border-red-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        {alert.alertType.replace(/_/g, ' ')}
                      </span>
                      {alert.batch?.recalled && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Already Recalled</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800">
                      Batch: <Link href={`/dashboard/batch/${alert.batch?.batchCode}`} className="font-mono text-amber-600 hover:underline">
                        {alert.batch?.batchCode}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(alert.createdAt).toLocaleString('en-IN')}</p>
                    {/* Details */}
                    <pre className="mt-2 text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-600 max-h-24">
                      {JSON.stringify(alert.details, null, 2)}
                    </pre>
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    {!alert.batch?.recalled && alert.batch && (
                      <RecallButton batchCode={alert.batch.batchCode} />
                    )}
                    <ResolveButton alertId={alert.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recalled Batches History */}
      <section>
        <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4">
          📋 Recalled Batches ({recalledBatches.length})
        </h2>
        {recalledBatches.length === 0 ? (
          <p className="text-sm text-gray-400">No recalled batches</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Batch Code</th>
                  <th className="px-5 py-3 text-left">Honey Type</th>
                  <th className="px-5 py-3 text-left">Recalled At</th>
                  <th className="px-5 py-3 text-left">QRs Deactivated</th>
                  <th className="px-5 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recalledBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-red-50/30">
                    <td className="px-5 py-4 font-mono text-xs text-red-700">{batch.batchCode}</td>
                    <td className="px-5 py-4 text-gray-600">{batch.honey_type}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{new Date(batch.updatedAt).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-gray-600">{batch._count.qrTokens}</td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/batch/${batch.batchCode}`} className="text-xs text-amber-600 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
