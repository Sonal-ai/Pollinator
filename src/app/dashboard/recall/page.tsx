import { prisma } from '@/lib/db';
import Link from 'next/link';
import { RecallButton, ResolveButton } from './admin-actions';
import { AlertOctagon, ShieldAlert, CheckCircle2 } from 'lucide-react';

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <AlertOctagon className="w-7 h-7 text-red-400" />
          Recall & Anomaly Management
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Review cryptographic scan anomalies and trigger immutable batch recalls on Polygon Amoy.
        </p>
      </div>

      {/* Unresolved Alerts */}
      <section className="space-y-4">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Unresolved Alerts ({alerts.length})
        </h2>

        {alerts.length === 0 ? (
          <div className="p-8 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 text-center text-xs text-emerald-300 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="font-bold text-white text-sm">No Unresolved Anomalies</p>
            <p className="text-slate-400">All duplicate scan vectors and geographic anomalies are resolved.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-5 rounded-3xl border border-red-500/30 bg-[#0d1017]/85 backdrop-blur-2xl shadow-xl flex flex-col sm:flex-row items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-mono font-bold uppercase">
                      {alert.alertType.replace(/_/g, ' ')}
                    </span>
                    {alert.batch?.recalled && (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-mono">
                        ALREADY RECALLED
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    Batch:{' '}
                    <Link
                      href={`/dashboard/batch/${alert.batch?.batchCode}`}
                      className="font-mono text-yellow-400 hover:underline"
                    >
                      {alert.batch?.batchCode}
                    </Link>
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Logged: {new Date(alert.createdAt).toLocaleString('en-IN')}
                  </p>
                  <pre className="p-3 bg-black/60 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto border border-white/5">
                    {alert.details}
                  </pre>
                </div>

                <div className="shrink-0 flex sm:flex-col gap-2 w-full sm:w-auto">
                  {!alert.batch?.recalled && alert.batch && (
                    <RecallButton batchCode={alert.batch.batchCode} />
                  )}
                  <ResolveButton alertId={alert.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recalled Batches History */}
      <section className="space-y-4">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
          On-Chain Recalled Batches Archive ({recalledBatches.length})
        </h2>

        {recalledBatches.length === 0 ? (
          <div className="p-6 rounded-2xl border border-white/10 bg-[#0d1017]/80 text-xs text-slate-500 text-center">
            No batches have been recalled on the Polygon Amoy blockchain.
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-[#0d1017]/80 backdrop-blur-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-white/10 bg-black/40 text-[10px] text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Batch Code</th>
                  <th className="py-3 px-4">Honey Type</th>
                  <th className="py-3 px-4">Jars Locked</th>
                  <th className="py-3 px-4">Recall Date</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recalledBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-red-500/[0.04]">
                    <td className="py-3 px-4 font-bold text-red-400">{b.batchCode}</td>
                    <td className="py-3 px-4 text-slate-300 font-sans">{b.honey_type}</td>
                    <td className="py-3 px-4 text-slate-400">{b._count.qrTokens} Jars</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(b.updatedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/batch/${b.batchCode}`}
                        className="text-yellow-400 hover:underline font-semibold font-sans"
                      >
                        Inspect →
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
