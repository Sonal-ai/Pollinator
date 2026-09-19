import { prisma } from '@/lib/db';
import Link from 'next/link';
import { PackagingForm } from './packaging-form';
import { Package, ShieldCheck, QrCode, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProcessorPage() {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  
  const walletAddress = session?.walletAddress ?? null;
  const isAdmin = session?.role === 'admin';

  const processableBatches = await prisma.honeyBatch.findMany({
    where: {
      recalled: false,
      status: 'LAB_VERIFIED',
      ...(isAdmin ? {} : { current_custodian: walletAddress }),
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
      qrTokens: { some: {} },
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Package className="w-7 h-7 text-amber-400" />
          Packaging & QR Serialization
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Convert verified bulk batches into retail jars. This emits a packaging transaction on Polygon Amoy and mints unique HMAC-signed anti-clone QR codes.
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
        <div className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-6 sm:p-8 space-y-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-yellow-400" />
              Packaged Retail Batches & Serialized QR Codes
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {packagedBatches.length} batch{packagedBatches.length > 1 ? 'es' : ''} packaged
            </span>
          </div>

          <div className="space-y-4">
            {packagedBatches.map((b) => (
              <div key={b.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-yellow-400 font-bold text-xs">{b.batchCode}</span>
                    <span className="text-white text-xs ml-2 font-semibold">{b.honey_type}</span>
                    <span className="text-slate-400 text-xs ml-2">({(b.quantity_grams / 1000).toFixed(1)} kg)</span>
                  </div>
                  <Link
                    href={`/dashboard/batch/${b.batchCode}`}
                    className="text-xs text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
                  >
                    View Batch Details & All Jars <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                  {b.qrTokens.map((token) => (
                    <Link
                      key={token.id}
                      href={`/verify?b=${b.batchCode}&n=${token.nonce}&sig=${token.signature}`}
                      target="_blank"
                      className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-yellow-400/40 transition-all text-center group"
                    >
                      <div className="w-7 h-7 mx-auto rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <QrCode className="w-4 h-4 text-yellow-400" />
                      </div>
                      <p className="text-[11px] font-mono text-white font-bold mt-2">Jar #{token.jarIndex}</p>
                      <p className="text-[9px] font-mono text-slate-400">{token.jarSizeGrams}g</p>
                      <span className="text-[9px] text-emerald-400 font-mono font-bold block mt-1">
                        {token._count.scans} Scan{token._count.scans === 1 ? '' : 's'}
                      </span>
                      <span className="text-[9px] text-amber-300 font-semibold block mt-0.5 group-hover:underline">
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
