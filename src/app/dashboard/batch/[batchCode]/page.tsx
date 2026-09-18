import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getBatchFromChain } from '@/lib/blockchain';
import { verifyMetadataIntegrity } from '@/lib/ipfs';
import { notFound } from 'next/navigation';

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
  const { batchCode } = await params;

  const batch = await prisma.honeyBatch.findUnique({
    where: { batchCode },
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

  // Fetch blockchain and IPFS data in parallel (non-blocking)
  const [chainRecord, integrityCheck] = await Promise.allSettled([
    getBatchFromChain(batchCode),
    batch.metadataCID && batch.metadataHash
      ? verifyMetadataIntegrity(batch.metadataCID, batch.metadataHash)
      : Promise.resolve(null),
  ]);

  const chain = chainRecord.status === 'fulfilled' ? chainRecord.value : null;
  const integrity = integrityCheck.status === 'fulfilled' ? integrityCheck.value : null;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Back Nav */}
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Registry
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{batchCode}</h1>
          <p className="text-gray-500 text-sm mt-1">{batch.honey_type} · {(batch.quantity_grams / 1000).toFixed(1)} kg</p>
        </div>
        <div className="flex gap-2">
          {batch.recalled && (
            <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-bold">
              🚨 RECALLED
            </span>
          )}
          {batch.lab_verified && (
            <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              ✓ Lab Verified
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Batch Metadata ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">📋 Batch Information</h2>
          <dl className="space-y-2.5 text-sm">
            {[
              ['Batch Code', batch.batchCode],
              ['Honey Type', batch.honey_type],
              ['Quantity', `${(batch.quantity_grams / 1000).toFixed(2)} kg`],
              ['Hives Harvested', batch.hives_harvested],
              ['Harvest Date', batch.harvest_timestamp?.toLocaleDateString('en-IN') ?? '—'],
              ['Region', batch.region ?? '—'],
              ['Status', batch.status.replace('_', ' ')],
              ['Beekeeper', batch.beekeeper?.name ?? '—'],
              ['Current Custodian', batch.current_custodian ? `${batch.current_custodian.slice(0, 8)}...` : '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between items-start gap-4">
                <dt className="text-gray-500 shrink-0">{String(k)}</dt>
                <dd className="text-gray-800 font-medium text-right">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Blockchain Panel ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">⛓️ Blockchain Status</h2>
          {!chain ? (
            <div className="text-sm text-gray-400 text-center py-6">
              Blockchain unavailable — showing DB data only
            </div>
          ) : (
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">On-Chain Status</dt>
                <dd className="font-medium">{BATCH_STATUS_LABELS[chain.status] ?? 'Unknown'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Lab Verified</dt>
                <dd className={chain.labVerified ? 'text-green-600 font-bold' : 'text-gray-400'}>
                  {chain.labVerified ? '✓ Yes' : '✗ No'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Recalled</dt>
                <dd className={chain.recalled ? 'text-red-600 font-bold' : 'text-gray-400'}>
                  {chain.recalled ? '⚠ YES' : 'No'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Quantity (on-chain)</dt>
                <dd className="font-medium">{(chain.quantityGrams / 1000).toFixed(2)} kg</dd>
              </div>
            </dl>
          )}
          {batch.txHash && (
            <a
              href={`https://amoy.polygonscan.com/tx/${batch.txHash}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800"
            >
              View on Polygonscan ↗
            </a>
          )}
        </div>

        {/* ── IPFS Integrity ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">🔒 IPFS Data Integrity</h2>
          {!integrity ? (
            <p className="text-sm text-gray-400">No IPFS metadata available yet</p>
          ) : integrity.valid ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              ✓ IPFS metadata hash matches blockchain record — data is authentic
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠ Hash mismatch: {integrity.reason}
            </div>
          )}
          {batch.metadataCID && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1">IPFS CID</p>
              <a
                href={`https://gateway.pinata.cloud/ipfs/${batch.metadataCID}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-blue-600 hover:underline break-all"
              >
                {batch.metadataCID}
              </a>
            </div>
          )}
        </div>

        {/* ── Custody Timeline ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">🔄 Custody Timeline</h2>
          {batch.custodyEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No custody transfers yet</p>
          ) : (
            <ol className="relative border-l border-gray-200 ml-2 space-y-4">
              {batch.custodyEvents.map((event) => (
                <li key={event.id} className="ml-4">
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-white" />
                  <p className="text-xs font-medium text-gray-700">{event.stage.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-400">
                    {event.from.slice(0, 6)}… → {event.to.slice(0, 6)}…
                  </p>
                  <p className="text-xs text-gray-300">{new Date(event.createdAt).toLocaleString('en-IN')}</p>
                  {event.txHash && (
                    <a href={`https://amoy.polygonscan.com/tx/${event.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline">tx ↗</a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Lab Certificates ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">🧪 Lab Certificates</h2>
        {batch.certificates.length === 0 ? (
          <p className="text-sm text-gray-400">No certificates uploaded yet</p>
        ) : (
          <div className="space-y-3">
            {batch.certificates.map((cert) => (
              <div key={cert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <p className="font-mono text-xs text-gray-600">{cert.certificateHash.slice(0, 20)}...</p>
                  <p className="text-xs text-gray-400">{new Date(cert.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <a href={`https://gateway.pinata.cloud/ipfs/${cert.ipfsCID}`} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline">PDF ↗</a>
                  {cert.txHash && (
                    <a href={`https://amoy.polygonscan.com/tx/${cert.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-amber-500 hover:underline">tx ↗</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── QR Tokens ── */}
      {batch.qrTokens.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">
            📱 QR Tokens ({batch.qrTokens.length} jars)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-2 px-3">Jar #</th>
                  <th className="text-left py-2 px-3">Size</th>
                  <th className="text-left py-2 px-3">Scans</th>
                  <th className="text-left py-2 px-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batch.qrTokens.map((token) => (
                  <tr key={token.id}>
                    <td className="py-2 px-3 text-gray-700">#{token.jarIndex}</td>
                    <td className="py-2 px-3 text-gray-500">{token.jarSizeGrams}g</td>
                    <td className="py-2 px-3 text-gray-700">{token._count.scans}</td>
                    <td className="py-2 px-3">
                      {token.active
                        ? <span className="text-green-600 text-xs">✓ Active</span>
                        : <span className="text-red-500 text-xs">✗ Inactive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Scan Alerts ── */}
      {batch.scanAlerts.filter(a => !a.resolved).length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-5">
          <h2 className="font-semibold text-red-800 mb-3 text-sm uppercase tracking-wide">
            🚨 Active Scan Alerts
          </h2>
          <div className="space-y-2">
            {batch.scanAlerts.filter(a => !a.resolved).map((alert) => (
              <div key={alert.id} className="bg-white rounded-lg border border-red-100 p-3 text-sm">
                <p className="font-medium text-red-700">{alert.alertType.replace('_', ' ')}</p>
                <p className="text-gray-500 text-xs mt-0.5">{new Date(alert.createdAt).toLocaleString('en-IN')}</p>
                <Link href="/dashboard/recall" className="text-xs text-red-600 hover:underline mt-1 block">
                  → Review in Recall Management
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
