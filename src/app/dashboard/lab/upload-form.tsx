'use client';
import { useState } from 'react';

type PendingBatch = {
  id: string;
  batchCode: string;
  honey_type: string;
  quantity_grams: number;
};

export function LabUploadForm({ pendingBatches }: { pendingBatches: PendingBatch[] }) {
  const [batchId, setBatchId] = useState(pendingBatches[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{
    certificateHash?: string; ipfsCID?: string; txHash?: string; polygonscanUrl?: string; error?: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId || !file) return;

    setStatus('uploading');
    setResult(null);

    const formData = new FormData();
    formData.append('batchId', batchId);
    // labActorId is now automatically pulled from the session cookie in the backend!
    formData.append('file', file);

    try {
      const response = await fetch('/api/certificate', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json() as typeof result;
      if (response.ok) {
        setStatus('success');
        setResult(data);
        setBatchId(''); setFile(null);
      } else {
        setStatus('error');
        setResult(data);
      }
    } catch {
      setStatus('error');
      setResult({ error: 'Network error. Please try again.' });
    }
  }

  if (pendingBatches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <p className="text-3xl mb-3">🍯</p>
        <h3 className="text-lg font-medium text-gray-900">No Pending Batches</h3>
        <p className="text-gray-500 mt-1">There are currently no batches awaiting lab verification.</p>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Batch for Analysis</label>
          <select
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            required
          >
            <option value="" disabled>-- Choose a batch --</option>
            {pendingBatches.map(b => (
              <option key={b.id} value={b.id}>
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Certificate PDF</label>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-amber-300 transition-colors">
            <input
              type="file" accept=".pdf,application/pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="hidden" id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block">
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-700">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-sm text-gray-500">Click to select PDF</p>
                  <p className="text-xs text-gray-400 mt-1">Max 10MB</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'uploading' || !batchId || !file}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white font-medium rounded-lg transition text-sm"
        >
          {status === 'uploading' ? '⏳ Uploading & committing on blockchain...' : '📤 Upload & Commit to Blockchain'}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className={`mt-5 p-5 rounded-xl border ${status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {status === 'success' ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-green-700">✅ Certificate committed to blockchain!</p>
              <p className="text-gray-600">Hash: <span className="font-mono text-xs">{result.certificateHash}</span></p>
              <p className="text-gray-600">IPFS:
                <a href={`https://gateway.pinata.cloud/ipfs/${result.ipfsCID}`} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 ml-1 hover:underline">{result.ipfsCID?.slice(0, 20)}... ↗</a>
              </p>
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
