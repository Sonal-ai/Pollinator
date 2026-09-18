'use client';
import { useState } from 'react';

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
  const [result, setResult] = useState<{ success?: boolean; txHash?: string; polygonscanUrl?: string; from?: string; to?: string; newStatus?: string; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null);

    try {
      const res = await fetch('/api/custody', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, toAddress, newStatus }),
      });
      const data = await res.json() as typeof result;
      setResult(data);
      if (res.ok) { setBatchId(''); setToAddress(''); }
    } catch {
      setResult({ error: 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  if (myBatches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <p className="text-3xl mb-3">🚚</p>
        <h3 className="text-lg font-medium text-gray-900">No Batches in Custody</h3>
        <p className="text-gray-500 mt-1">You do not currently possess any honey batches that need transferring.</p>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Batch in your Possession</label>
          <select
            value={batchId} onChange={e => setBatchId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            required
          >
            <option value="" disabled>-- Choose a batch --</option>
            {myBatches.map(b => (
              <option key={b.id} value={b.id}>
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg) - Current: {b.status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Wallet Address (Next Custodian)</label>
          <input value={toAddress} onChange={e => setToAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New Supply Chain Status</label>
          <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading || !batchId || !toAddress}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white font-medium rounded-lg transition text-sm">
          {loading ? '⏳ Processing...' : '📤 Transfer Custody'}
        </button>
      </form>

      {result && (
        <div className={`mt-5 p-5 rounded-xl border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {result.success ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-green-700">✅ Custody Transferred!</p>
              <p className="text-gray-600">From: <span className="font-mono text-xs">{result.from}</span></p>
              <p className="text-gray-600">To: <span className="font-mono text-xs">{result.to}</span></p>
              <p className="text-gray-600">Status updated to: <span className="font-medium">{result.newStatus}</span></p>
              {result.polygonscanUrl && (
                <a href={result.polygonscanUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-1 text-amber-600 hover:underline">View on Polygonscan ↗</a>
              )}
            </div>
          ) : (
            <p className="text-red-700 text-sm font-medium">{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
