import { requireSession } from '@/lib/auth';
import { batchScope } from '@/lib/access-policy';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getBatchFromChain, getActiveNetworkName, isLocalChain } from '@/lib/blockchain';
import { RecallButton } from '../../recall/admin-actions';
import { verifyMetadataIntegrity } from '@/lib/ipfs';
import { notFound } from 'next/navigation';
import { 
  ArrowLeft, 
  ExternalLink, 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  Layers, 
  CheckCircle2, 
  Clock, 
  QrCode,
  MapPin,
  Calendar,
  Scale
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const BATCH_STATUS_LABELS: Record<number, string> = {
  0: 'Created', 1: 'Harvested', 2: 'Processed', 3: 'Lab Verified',
  4: 'Packaged', 5: 'In Distribution', 6: 'At Retail', 7: 'Sold', 8: 'Recalled',
};

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchCode: string }>;
}) {
  const session = await requireSession();
  const { batchCode } = await params;
  const isLocal = isLocalChain();

  const batch = await prisma.honeyBatch.findFirst({
    where: { AND: [{ batchCode }, batchScope(session)] },
    include: {
      beekeeper: true,
      certificates: { orderBy: { createdAt: 'desc' } },
      custodyEvents: { orderBy: { createdAt: 'asc' } },
      qrTokens: {
        orderBy: { jarIndex: 'asc' },
        include: { _count: { select: { scans: true } } },
      },
      scanAlerts: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!batch) notFound();

  // Fetch blockchain and IPFS data in parallel
  const [chainRecord, integrityCheck] = await Promise.allSettled([
    getBatchFromChain(batchCode),
    batch.metadataCID && batch.metadataHash
      ? verifyMetadataIntegrity(batch.metadataCID, batch.metadataHash)
      : Promise.resolve(null),
  ]);

  const chain = chainRecord.status === 'fulfilled' ? chainRecord.value : null;
  const integrity = integrityCheck.status === 'fulfilled' ? integrityCheck.value : null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent-ink)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Batch Registry
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all text-2xl sm:text-3xl font-extrabold text-foreground font-mono tracking-tight">
              {batchCode}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-[var(--accent-ink)] border border-amber-500/30">
              {batch.honey_type}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {(batch.quantity_grams / 1000).toFixed(1)} kg • Harvested {batch.harvest_timestamp ? new Date(batch.harvest_timestamp).toLocaleDateString('en-IN') : '—'} • {batch.region ?? 'India'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {session.role === 'admin' && !batch.recalled && <RecallButton batchCode={batch.batchCode} />}
          {batch.recalled && (
            <span className="px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold">
              🚨 BATCH RECALLED
            </span>
          )}
          {batch.lab_verified && (
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Lab Verified
            </span>
          )}
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metadata Card */}
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--accent-ink)] flex items-center gap-2">
            📋 Batch Dossier
          </h2>

          <div className="space-y-3 text-xs">
            {[
              ['Honey Type', batch.honey_type],
              ['Quantity', `${(batch.quantity_grams / 1000).toFixed(2)} kg`],
              ['Hives Harvested', batch.hives_harvested],
              ['Harvest Region', batch.region ?? '—'],
              ['Status', batch.status.replace(/_/g, ' ')],
              ['Beekeeper Name', batch.beekeeper?.name ?? '—'],
              ['KVIC ID', batch.beekeeper?.kvicId ?? '—'],
              ['Current Custodian', batch.current_custodian ? `${batch.current_custodian.slice(0, 8)}...` : '—'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-[var(--surface-border)]">
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className="font-semibold text-foreground font-mono">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blockchain Status Card */}
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Blockchain status · {getActiveNetworkName()}
          </h2>

          {!chain ? (
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] text-[var(--text-muted)] text-xs text-center">
              Contract query temporarily unavailable — displaying cached database records.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[var(--surface-border)]">
                <span className="text-[var(--text-muted)]">On-Chain State</span>
                <span className="font-bold text-foreground font-mono">{BATCH_STATUS_LABELS[chain.status] ?? 'Unknown'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--surface-border)]">
                <span className="text-[var(--text-muted)]">Lab Signature</span>
                <span className={chain.labVerified ? 'text-emerald-400 font-bold' : 'text-[var(--text-muted)]'}>
                  {chain.labVerified ? '✓ Validated' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--surface-border)]">
                <span className="text-[var(--text-muted)]">Recall Flag</span>
                <span className={chain.recalled ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                  {chain.recalled ? '⚠ RECALLED' : 'Clean'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--surface-border)]">
                <span className="text-[var(--text-muted)]">Quantity (Smart Contract)</span>
                <span className="font-mono text-foreground">{(chain.quantityGrams / 1000).toFixed(2)} kg</span>
              </div>
            </div>
          )}

          {batch.txHash && (
            isLocal ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-bold">Mined on Local Hive Node</span>
                <span className="text-[10px] text-[var(--text-muted)]">({batch.txHash.slice(0, 10)}...)</span>
              </div>
            ) : (
              <a
                href={`https://amoy.polygonscan.com/tx/${batch.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-ink)] hover:text-[var(--accent-ink)] font-mono"
              >
                View on Polygonscan <ExternalLink className="w-3 h-3" />
              </a>
            )
          )}
        </div>
      </div>

      {/* Custody Timeline */}
      <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--accent-ink)]" /> Custody Handoff History
        </h2>

        {batch.custodyEvents.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No multi-hop custody transfers logged yet.</p>
        ) : (
          <div className="space-y-4 pl-4 border-l border-amber-500/30">
            {batch.custodyEvents.map((evt) => (
              <div key={evt.id} className="relative space-y-1">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-black" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground uppercase font-mono">{evt.stage.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--text-muted)]">{new Date(evt.createdAt).toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                  From: {evt.from.slice(0, 8)}... → To: {evt.to.slice(0, 8)}...
                </p>
                {evt.txHash && (
                  isLocal ? (
                    <span className="text-[10px] font-mono text-emerald-400/80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Local Tx: {evt.txHash.slice(0, 12)}...
                    </span>
                  ) : (
                    <a
                      href={`https://amoy.polygonscan.com/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-[var(--accent-ink)] hover:underline inline-flex items-center gap-1"
                    >
                      Tx: {evt.txHash.slice(0, 12)}... <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Tokens serialized */}
      {batch.qrTokens.length > 0 && (
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <QrCode className="w-4 h-4 text-teal-400" /> Serialized Retail Jars ({batch.qrTokens.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--surface-border)]">
                <tr>
                  <th className="py-2.5 px-3">Jar Index</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Scans</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Verification Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {batch.qrTokens.map((token) => (
                  <tr key={token.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 text-foreground font-bold">#{token.jarIndex}</td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{token.jarSizeGrams}g</td>
                    <td className="py-2.5 px-3 text-[var(--accent-ink)]">{token._count.scans}</td>
                    <td className="py-2.5 px-3">
                      {token.active ? (
                        <span className="text-emerald-400 text-[10px]">✓ Active</span>
                      ) : (
                        <span className="text-red-400 text-[10px]">✗ Deactivated</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/verify?b=${batch.batchCode}&n=${token.nonce}&sig=${token.signature}`}
                        target="_blank"
                        className="text-[var(--accent-ink)] hover:text-[var(--accent-ink)] text-[11px] inline-flex items-center gap-1 font-sans font-semibold"
                      >
                        Verify Jar <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
