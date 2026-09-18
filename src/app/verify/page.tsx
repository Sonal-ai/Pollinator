import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { verifyMetadataIntegrity } from '@/lib/ipfs';
import { getBatchFromChain } from '@/lib/blockchain';
import { processQRScan } from '@/lib/qr';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

// QR verification result display
type VerifyStatus = 'OK' | 'RECALLED' | 'NOT_FOUND' | 'INVALID_SIGNATURE' | 'DEACTIVATED' | 'INTEGRITY_FAIL' | 'ERROR';

interface VerifyPageProps {
  searchParams: Promise<{ b?: string; n?: string; sig?: string }>;
}

const BATCH_STATUS_LABELS: Record<number, string> = {
  0: 'Created', 1: 'Harvested', 2: 'Processed', 3: 'Lab Verified',
  4: 'Packaged', 5: 'In Distribution', 6: 'At Retail', 7: 'Sold', 8: 'Recalled',
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const sp = await searchParams;
  const batchCode = sp.b;
  const nonce     = sp.n;
  const signature = sp.sig;

  // Missing params — invalid URL
  if (!batchCode || !nonce || !signature) {
    return <VerifyResult status="INVALID_SIGNATURE" message="Invalid QR code — missing required parameters." />;
  }

  // Get IP from request headers
  const headerStore = await headers();
  const forwardedFor = headerStore.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : null;
  const userAgent = headerStore.get('user-agent');

  // Process the scan (signature check + DB lookup + geolocation + anomaly check)
  const scanResult = await processQRScan({
    batchCode,
    nonce,
    signature,
    ipAddress,
    userAgent,
  });

  if (!scanResult.valid) {
    return <VerifyResult status={scanResult.status as VerifyStatus} message={scanResult.reason} />;
  }

  // Fetch batch data
  const batch = await prisma.honeyBatch.findUnique({
    where: { batchCode },
    include: {
      beekeeper: { select: { name: true, region: true, kvicId: true } },
      certificates: { orderBy: { createdAt: 'desc' }, take: 1 },
      custodyEvents: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!batch) return <VerifyResult status="NOT_FOUND" message="Batch data not found." />;

  if (batch.recalled) {
    return <VerifyResult status="RECALLED" message="This honey batch has been recalled. Do not consume." batchCode={batchCode} />;
  }

  // Fetch blockchain record and IPFS integrity in parallel
  const [chainRecord, integrityCheck] = await Promise.allSettled([
    getBatchFromChain(batchCode),
    batch.metadataCID && batch.metadataHash
      ? verifyMetadataIntegrity(batch.metadataCID, batch.metadataHash)
      : Promise.resolve(null),
  ]);

  const chain = chainRecord.status === 'fulfilled' ? chainRecord.value : null;
  const integrity = integrityCheck.status === 'fulfilled' ? integrityCheck.value : null;

  // Check blockchain-level recall
  if (chain?.recalled) {
    return <VerifyResult status="RECALLED" message="Blockchain confirms this batch has been recalled." batchCode={batchCode} />;
  }

  // Check IPFS integrity
  if (integrity && !integrity.valid) {
    return <VerifyResult status="INTEGRITY_FAIL" message={integrity.reason} batchCode={batchCode} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <div className="bg-green-600 text-white px-5 py-6 text-center">
        <div className="text-4xl mb-2">✅</div>
        <h1 className="text-xl font-bold">Genuine Honey — Verified</h1>
        <p className="text-green-100 text-sm mt-1">Blockchain-backed provenance proof</p>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-5">

        {/* Key Info Cards */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-amber-50 px-5 py-4 border-b border-amber-100">
            <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Batch Code</p>
            <p className="font-mono font-bold text-gray-900 text-lg mt-0.5">{batch.batchCode}</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <InfoRow label="Honey Type" value={batch.honey_type} />
            <InfoRow label="Harvest Region" value={batch.beekeeper?.region ?? batch.region ?? '—'} />
            <InfoRow label="Harvest Date" value={batch.harvest_timestamp?.toLocaleDateString('en-IN') ?? '—'} />
            <InfoRow label="Quantity" value={`${(batch.quantity_grams / 1000).toFixed(1)} kg batch`} />
            <InfoRow
              label="Lab Verified"
              value={batch.lab_verified ? '✓ Yes — Certificate on-chain' : 'Pending verification'}
              highlight={batch.lab_verified ? 'green' : 'gray'}
            />
          </div>
        </div>

        {/* Beekeeper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">🐝 Beekeeper</h2>
          <InfoRow label="Producer" value={batch.beekeeper?.name ?? 'KVIC Registered Beekeeper'} />
          <InfoRow label="Region" value={batch.beekeeper?.region ?? '—'} />
          {batch.beekeeper?.kvicId && <InfoRow label="KVIC ID" value={batch.beekeeper.kvicId} />}
        </div>

        {/* Custody Timeline */}
        {batch.custodyEvents.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🔄 Supply Chain Journey</h2>
            <ol className="relative border-l-2 border-amber-200 ml-2 space-y-3">
              {/* Origin */}
              <li className="ml-4">
                <div className="absolute -left-2 mt-1 h-3 w-3 rounded-full bg-amber-400" />
                <p className="text-xs font-medium text-gray-700">🐝 Harvested by Beekeeper</p>
                <p className="text-xs text-gray-400">{batch.harvest_timestamp?.toLocaleDateString('en-IN')}</p>
              </li>
              {batch.custodyEvents.map((event) => (
                <li key={event.id} className="ml-4">
                  <div className="absolute -left-2 mt-1 h-3 w-3 rounded-full bg-amber-300 border-2 border-amber-400" />
                  <p className="text-xs font-medium text-gray-700">{event.stage.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{new Date(event.createdAt).toLocaleDateString('en-IN')}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Blockchain Proof */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">⛓️ Blockchain Proof</h2>
          {chain ? (
            <div className="space-y-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
                ✓ Record found on Polygon blockchain — cannot be altered
              </div>
              <InfoRow label="Supply Chain Status" value={BATCH_STATUS_LABELS[chain.status] ?? '—'} />
            </div>
          ) : (
            <p className="text-xs text-gray-400">Blockchain data temporarily unavailable</p>
          )}
          {batch.txHash && (
            <a href={`https://amoy.polygonscan.com/tx/${batch.txHash}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 text-xs text-amber-600 hover:underline block">
              View creation transaction on Polygonscan ↗
            </a>
          )}
        </div>

        {/* IPFS Integrity */}
        {integrity && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🔒 Data Integrity</h2>
            {integrity.valid ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
                ✓ All provenance data matches blockchain record — no tampering detected
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                ⚠ {integrity.reason}
              </div>
            )}
          </div>
        )}

        {/* What This Means */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">ℹ️ What this verification proves:</p>
          <p>• The honey batch details (origin, date, quantity) were recorded and cannot be changed.</p>
          {batch.lab_verified && <p>• A certified lab tested this batch and their certificate is on the blockchain.</p>}
          <p>• The QR code you scanned is genuine and was not modified.</p>
          <p className="text-amber-600 mt-2">
            Blockchain proves data <strong>integrity</strong>, not physical honey purity.
            Look for the lab certificate for purity assurance.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by <strong>Pollinator</strong> · Polygon Blockchain · IPFS
        </p>
      </div>
    </div>
  );
}

// Helpers
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'gray' }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm py-0.5">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right font-medium ${highlight === 'green' ? 'text-green-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

function VerifyResult({
  status, message, batchCode,
}: {
  status: VerifyStatus; message?: string; batchCode?: string;
}) {
  const configs: Record<VerifyStatus, { bg: string; icon: string; title: string; color: string }> = {
    OK:                { bg: 'from-green-500',  icon: '✅', title: 'Verified',       color: 'text-green-600' },
    RECALLED:          { bg: 'from-red-600',    icon: '🚨', title: 'RECALLED',       color: 'text-red-600' },
    NOT_FOUND:         { bg: 'from-gray-500',   icon: '❌', title: 'Not Found',      color: 'text-gray-600' },
    INVALID_SIGNATURE: { bg: 'from-red-500',    icon: '⛔', title: 'Invalid QR',     color: 'text-red-600' },
    DEACTIVATED:       { bg: 'from-orange-500', icon: '⚠️', title: 'Deactivated',    color: 'text-orange-600' },
    INTEGRITY_FAIL:    { bg: 'from-red-600',    icon: '🔴', title: 'Data Tampered',  color: 'text-red-600' },
    ERROR:             { bg: 'from-gray-500',   icon: '⚠️', title: 'Error',          color: 'text-gray-600' },
  };

  const cfg = configs[status];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className={`w-full max-w-sm bg-gradient-to-b ${cfg.bg} to-white rounded-2xl overflow-hidden shadow-lg`}>
        <div className="text-white text-center py-8 px-6">
          <div className="text-5xl mb-3">{cfg.icon}</div>
          <h1 className="text-xl font-bold">{cfg.title}</h1>
        </div>
        <div className="bg-white px-6 py-5 text-center">
          <p className="text-sm text-gray-600">{message}</p>
          {batchCode && (
            <p className="text-xs text-gray-400 mt-2 font-mono">{batchCode}</p>
          )}
          {status === 'RECALLED' && (
            <div className="mt-4 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
              ⚠ <strong>DO NOT CONSUME</strong> this product. Contact the retailer for a refund.
            </div>
          )}
          <Link href="/" className="mt-4 block text-sm text-gray-400 hover:text-gray-600">
            ← Go to Pollinator
          </Link>
        </div>
      </div>
    </div>
  );
}
