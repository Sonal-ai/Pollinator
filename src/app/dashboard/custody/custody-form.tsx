'use client';

import { useState } from 'react';
import { Truck, ArrowRight, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'PROCESSED',       label: '⚙️ Processed' },
  { value: 'IN_DISTRIBUTION', label: '🚚 In Distribution' },
  { value: 'AT_RETAIL',       label: '🏪 At Retail' },
  { value: 'SOLD',            label: '✅ Sold' },
];

type OwnedBatch = {
  id: string;
  batchCode: string;
  honey_type: string;
  quantity_grams: number;
  status: string;
};

export function CustodyTransferForm({ myBatches }: { myBatches: OwnedBatch[] }) {
  const [batchId, setBatchId] = useState(myBatches[0]?.id ?? '');
  const [toAddress, setToAddress] = useState('');
  const [newStatus, setNewStatus] = useState('IN_DISTRIBUTION');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    txHash?: string;
    polygonscanUrl?: string;
    from?: string;
    to?: string;
    newStatus?: string;
    error?: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/custody', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, toAddress, newStatus }),
      });
      const data = await res.json() as typeof result;
      setResult(data);
      if (res.ok) {
        setBatchId('');
        setToAddress('');
      }
    } catch {
      setResult({ error: 'Network communication error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  if (myBatches.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0d1017]/80 backdrop-blur-2xl p-12 text-center text-slate-400 space-y-3 shadow-xl">
        <Truck className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-white">No Batches in Custody</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          You do not currently hold custody of any honey batches requiring transfer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-yellow-400/20 bg-[#0d1017]/85 backdrop-blur-2xl p-6 sm:p-8 space-y-5 shadow-xl"
      >
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
            Select Batch in Possession
          </label>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-yellow-400 transition-colors"
            required
          >
            <option value="" disabled className="bg-[#0d1017] text-slate-500">
              -- Choose a batch --
            </option>
            {myBatches.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#0d1017] text-white">
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg) · Stage: {b.status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
            Recipient EVM Wallet Address
          </label>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-yellow-300 placeholder-slate-600 focus:outline-none focus:border-yellow-400 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
            Next Supply Chain Stage
          </label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-yellow-400 transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0d1017] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !batchId || !toAddress}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-black text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? (
            'Committing Transfer to Polygon Amoy...'
          ) : (
            <>
              Transfer Custody On-Chain
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div
          className={`p-6 rounded-3xl border ${
            result.success
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/20 border-red-500/40 text-red-400'
          } shadow-2xl space-y-2 text-xs`}
        >
          {result.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Custody Handover Confirmed on Polygon Amoy!
              </div>
              <p className="text-slate-300 font-mono">
                From: {result.from?.slice(0, 10)}... → To: {result.to?.slice(0, 10)}...
              </p>
              {result.polygonscanUrl && (
                <a
                  href={result.polygonscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:underline font-mono inline-flex items-center gap-1 font-bold pt-1"
                >
                  View Transaction on Polygonscan <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
