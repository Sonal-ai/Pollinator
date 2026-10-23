import { requireSession } from '@/lib/auth';
import { batchScope } from '@/lib/access-policy';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { PackagingForm } from './packaging-form';
import { BatchLabels } from './labels';
import { Package, ShieldCheck, QrCode, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProcessorPage() {
  const session = await requireSession(['admin', 'processor']);
  const walletAddress = session.walletAddress;
  const isAdmin = session.role === 'admin';

  const processableBatches = await prisma.honeyBatch.findMany({
    where: {
      recalled: false,
      lab_verified: true,
      status: 'LAB_VERIFIED',
      pendingOperationId: null,
      AND: [batchScope(session)],
    },
    select: {
      batchCode: true,
      honey_type: true,
      quantity_grams: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const packagedBatches = await prisma.honeyBatch.findMany({
    where: {
      recalled: false,
      status: 'PACKAGED',
      packagingTxHash: { not: null },
      AND: [batchScope(session)],
    },
    include: {
      qrTokens: {
        take: 6,
        orderBy: { jarIndex: 'asc' },
        include: {
          _count: { select: { scans: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
          <Package className="w-7 h-7 text-[var(--accent-ink)]" />
          Packaging & QR Serialization
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
          Prepare jar inventory, approve it with the processor wallet, then issue serialized labels after chain confirmation.
        </p>
      </div>

      {!walletAddress && !isAdmin ? (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs">
          Please log in as a Processor or Admin to package honey batches.
        </div>
      ) : (
        <PackagingForm processableBatches={processableBatches} />
      )}

      {/* Packaged Retail Batches & Verified QR Jars */}
      {packagedBatches.length > 0 && (
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 sm:p-8 space-y-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[var(--accent-ink)]" />
              Packaged Retail Batches & Serialized QR Codes
            </h2>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {packagedBatches.length} batch{packagedBatches.length > 1 ? 'es' : ''} packaged
            </span>
          </div>

          <div className="space-y-4">
            {packagedBatches.map((b) => (
              <div key={b.id} className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[var(--accent-ink)] font-bold text-xs">{b.batchCode}</span>
                    <span className="text-foreground text-xs ml-2 font-semibold">{b.honey_type}</span>
                    <span className="text-[var(--text-muted)] text-xs ml-2">({(b.quantity_grams / 1000).toFixed(1)} kg)</span>
                  </div>
                  <Link
                    href={`/dashboard/batch/${b.batchCode}`}
                    className="text-xs text-[var(--accent-ink)] hover:text-[var(--accent-ink)] font-mono flex items-center gap-1"
                  >
                    View Batch Details & All Jars <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                <BatchLabels batchCode={b.batchCode} jarCount={b.jarCount} jarSizeGrams={b.jarSizeGrams} />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                  {b.qrTokens.map((token) => (
                    <Link
                      key={token.id}
                      href={`/verify?b=${b.batchCode}&n=${token.nonce}&sig=${token.signature}`}
                      target="_blank"
                      className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-[var(--surface-border)] hover:border-yellow-400/40 transition-all text-center group"
                    >
                      <div className="w-7 h-7 mx-auto rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <QrCode className="w-4 h-4 text-[var(--accent-ink)]" />
                      </div>
                      <p className="text-[11px] font-mono text-foreground font-bold mt-2">Jar #{token.jarIndex}</p>
                      <p className="text-[9px] font-mono text-[var(--text-muted)]">{token.jarSizeGrams}g</p>
                      <span className="text-[9px] text-emerald-400 font-mono font-bold block mt-1">
                        {token._count.scans} Scan{token._count.scans === 1 ? '' : 's'}
                      </span>
                      <span className="text-[9px] text-[var(--accent-ink)] font-semibold block mt-0.5 group-hover:underline">
                        Test QR →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
