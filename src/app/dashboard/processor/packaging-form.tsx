'use client';
import { useState } from 'react';

type ProcessableBatch = {
  batchCode: string;
  honey_type: string;
  quantity_grams: number;
};

export function PackagingForm({ processableBatches }: { processableBatches: ProcessableBatch[] }) {
  const [batchCode, setBatchCode] = useState(processableBatches[0]?.batchCode ?? '');
  const [jarCount, setJarCount] = useState<number | ''>('');
  const [jarSizeGrams, setJarSizeGrams] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    txHash?: string;
    polygonscanUrl?: string;
    error?: string;
    qrs?: Array<{ jarIndex: number; qrImageBase64: string; verifyUrl: string }>;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchCode || !jarCount || !jarSizeGrams) return;

    setLoading(true); setResult(null);

    try {
      // 1. Hit the Packaging API
      const packRes = await fetch(`/api/batch/${batchCode}/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jarCount: Number(jarCount), jarSizeGrams: Number(jarSizeGrams) }),
      });
      
      if (!packRes.ok) {
        const errData = await packRes.json();
        setResult({ error: errData.error ?? 'Packaging failed.' });
        return;
      }
      
      const packData = await packRes.json();

      // 2. Hit the QR Generation API
      const qrRes = await fetch('/api/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchCode, jarCount: Number(jarCount), jarSizeGrams: Number(jarSizeGrams) }),
      });

      if (!qrRes.ok) {
        const errData = await qrRes.json();
        setResult({ error: errData.error ?? 'QR generation failed, but batch was packaged.' });
        return;
      }

      const qrData = await qrRes.json();
      
      setResult({
        success: true,
        txHash: packData.txHash,
        polygonscanUrl: packData.polygonscanUrl,
        qrs: qrData.results,
      });

      // Clear form
      setBatchCode(''); setJarCount(''); setJarSizeGrams('');
    } catch {
      setResult({ error: 'Network error. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  }

  if (processableBatches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <p className="text-3xl mb-3">🏭</p>
        <h3 className="text-lg font-medium text-gray-900">No Batches Ready</h3>
        <p className="text-gray-500 mt-1">You do not currently possess any LAB_VERIFIED batches ready for packaging.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Batch for Packaging</label>
          <select
            value={batchCode} onChange={e => setBatchCode(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            required
          >
            <option value="" disabled>-- Choose a batch --</option>
            {processableBatches.map(b => (
              <option key={b.batchCode} value={b.batchCode}>
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg available)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Jars</label>
            <input type="number" min="1" max="10000" required
              value={jarCount} onChange={e => setJarCount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="e.g. 100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Jar Size (Grams)</label>
            <input type="number" min="1" max="5000" required
              value={jarSizeGrams} onChange={e => setJarSizeGrams(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="e.g. 500" />
          </div>
        </div>

        <button type="submit" disabled={loading || !batchCode}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white font-medium rounded-lg transition text-sm">
          {loading ? '⏳ Processing & Minting QRs...' : '🏭 Package Batch & Generate QRs'}
        </button>
      </form>

      {/* Result View */}
      {result && (
        <div className={`p-6 rounded-xl border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {result.success ? (
            <div>
              <h3 className="font-semibold text-green-800 text-lg mb-2">✅ Packaging Successful!</h3>
              <p className="text-sm text-green-700 mb-4">
                The batch was securely packaged on the Polygon blockchain. 
                {result.polygonscanUrl && (
                  <a href={result.polygonscanUrl} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                    View Transaction ↗
                  </a>
                )}
              </p>
              
              <h4 className="font-medium text-gray-900 mb-3">Generated QR Labels ({result.qrs?.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto p-2">
                {result.qrs?.map(qr => (
                  <div key={qr.jarIndex} className="bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
                    <img src={qr.qrImageBase64} alt={`QR for Jar ${qr.jarIndex}`} className="w-full h-auto mb-2 rounded" />
                    <span className="text-xs font-mono text-gray-500">Jar #{qr.jarIndex}</span>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => window.print()}
                className="mt-6 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition"
              >
                🖨️ Print Labels
              </button>
            </div>
          ) : (
            <p className="text-red-700 font-medium">{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
