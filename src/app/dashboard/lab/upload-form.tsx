'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';

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
        setBatchId('');
        setFile(null);
      } else {
        setStatus('error');
        setResult(data);
      }
    } catch {
      setStatus('error');
      setResult({ error: 'Network communication failure. Please retry.' });
    }
  }

  if (pendingBatches.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-12 text-center text-slate-400 space-y-3 shadow-xl">
        <p className="text-3xl">🍯</p>
        <h3 className="text-base font-bold text-white">All Batches Verified</h3>
        <p className="text-xs text-slate-500">There are currently no raw harvest batches awaiting lab certification.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-6 sm:p-8 space-y-5 shadow-xl"
      >
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
            Select Harvest Batch
          </label>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
            required
          >
            <option value="" disabled className="bg-[#0d111a] text-slate-500">
              -- Choose a pending batch --
            </option>
            {pendingBatches.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#0d111a] text-white">
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
            Laboratory Certificate PDF
          </label>
          <div className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center hover:border-amber-400/50 transition-colors bg-black/30">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block space-y-2">
              {file ? (
                <div>
                  <FileText className="w-8 h-8 text-amber-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-white font-mono">{file.name}</p>
                  <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(0)} KB · Ready to hash</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-300">Click to select lab certificate PDF</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Maximum size: 10MB</p>
                </div>
              )}
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-500">Presentation Demo:</span>
            <button
              type="button"
              onClick={() => {
                const samplePdfContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`;
                const blob = new Blob([samplePdfContent], { type: 'application/pdf' });
                const sampleFile = new File([blob], `NABL-Purity-Report-${batchId ? batchId.slice(-6) : 'Demo'}.pdf`, { type: 'application/pdf' });
                setFile(sampleFile);
              }}
              className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
            >
              📄 Auto-Generate Sample NABL Certificate
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'uploading' || !batchId || !file}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all active:scale-95 disabled:opacity-40"
        >
          {status === 'uploading'
            ? 'Anchoring to IPFS & Committing On-Chain...'
            : 'Commit Certificate to Blockchain'}
        </button>
      </form>

      {/* Result feedback */}
      {result && (
        <div
          className={`p-5 rounded-3xl border ${
            status === 'success'
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/20 border-red-500/40 text-red-400'
          } shadow-xl`}
        >
          {status === 'success' ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Certificate successfully anchored on Polygon Amoy!
              </div>
              <p className="text-slate-300">
                SHA-256 Hash:{' '}
                <span className="font-mono text-amber-300 break-all">{result.certificateHash}</span>
              </p>
              {result.ipfsCID && (
                <p className="text-slate-300">
                  IPFS CID:{' '}
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${result.ipfsCID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline font-mono inline-flex items-center gap-1 ml-1"
                  >
                    {result.ipfsCID.slice(0, 16)}... <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              )}
              {result.polygonscanUrl && (
                <a
                  href={result.polygonscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-amber-400 hover:underline font-semibold mt-1"
                >
                  View on Polygonscan Amoy <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
