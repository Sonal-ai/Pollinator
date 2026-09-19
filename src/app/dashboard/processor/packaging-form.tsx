'use client';

import { useState } from 'react';
import { Package, QrCode, Printer, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

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

    setLoading(true);
    setResult(null);

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
        qrs: qrData.qrTokens || qrData.results,
      });

      // Clear form
      setBatchCode('');
      setJarCount('');
      setJarSizeGrams('');
    } catch {
      setResult({ error: 'Network communication failure. Please check connection.' });
    } finally {
      setLoading(false);
    }
  }

  if (processableBatches.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-12 text-center text-slate-400 space-y-3 shadow-xl">
        <Package className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-white">No Batches Ready for Packaging</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Batches must be in custody and have their QA laboratory test verified on-chain before packaging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-6 sm:p-8 space-y-5 shadow-xl"
      >
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
            Select Lab-Verified Batch
          </label>
          <select
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
            required
          >
            <option value="" disabled className="bg-[#0d111a] text-slate-500">
              -- Choose a verified batch --
            </option>
            {processableBatches.map((b) => (
              <option key={b.batchCode} value={b.batchCode} className="bg-[#0d111a] text-white">
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg available)
              </option>
            ))}
          </select>
        </div>

        {/* Packaging Presets */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[10px] font-mono text-slate-400 self-center">Quick Packaging Presets:</span>
          <button
            type="button"
            onClick={() => {
              const selected = processableBatches.find(b => b.batchCode === batchCode) || processableBatches[0];
              const totalGrams = selected?.quantity_grams ?? 25000;
              setJarCount(1);
              setJarSizeGrams(totalGrams);
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-mono text-amber-300 transition-all"
          >
            🍯 1 Full Bulk Barrel / Container (Full Weight)
          </button>
          <button
            type="button"
            onClick={() => {
              const selected = processableBatches.find(b => b.batchCode === batchCode) || processableBatches[0];
              const totalGrams = selected?.quantity_grams ?? 25000;
              setJarSizeGrams(500);
              setJarCount(Math.max(1, Math.floor(totalGrams / 500)));
            }}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300 transition-all"
          >
            🫙 500g Consumer Jars
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
              Number of Jars / Containers
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              required
              value={jarCount}
              onChange={(e) => setJarCount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-amber-400 transition-colors"
              placeholder="e.g. 1"
            />
          </div>
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
              Jar / Container Size (Grams)
            </label>
            <input
              type="number"
              min="1"
              max="1000000"
              required
              value={jarSizeGrams}
              onChange={(e) => setJarSizeGrams(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-amber-400 transition-colors"
              placeholder="e.g. 50000"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !batchCode}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all active:scale-95 disabled:opacity-40"
        >
          {loading ? 'Processing & Minting Anti-Clone QRs...' : 'Package Batch & Mint Serialized QRs'}
        </button>
      </form>

      {/* Result View */}
      {result && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border ${
            result.success
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/20 border-red-500/40 text-red-400'
          } shadow-2xl space-y-4`}
        >
          {result.success ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Batch Successfully Packaged On-Chain!
              </div>
              <p className="text-xs text-slate-300">
                Packaging state updated on Polygon Amoy.
                {result.polygonscanUrl && (
                  <a
                    href={result.polygonscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-amber-400 hover:underline font-mono inline-flex items-center gap-1"
                  >
                    View Tx on Polygonscan <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </p>

              <div>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-3">
                  HMAC-Signed Anti-Clone Labels ({result.qrs?.length}) — Click to Open Verification
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
                  {result.qrs?.map((qr) => (
                    <a
                      key={qr.jarIndex}
                      href={qr.verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-black/60 hover:bg-black/80 border border-white/10 hover:border-amber-400/50 rounded-2xl p-3 text-center space-y-2 group transition-all"
                    >
                      <img
                        src={qr.qrImageBase64}
                        alt={`QR for Jar ${qr.jarIndex}`}
                        className="w-full h-auto rounded-lg bg-white p-1 group-hover:scale-105 transition-transform"
                      />
                      <p className="text-[11px] font-mono text-amber-400 font-bold">
                        Jar #{qr.jarIndex} ({jarSizeGrams}g)
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center justify-center gap-1">
                        Open & Verify →
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Tamper-Proof Labels
              </button>
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
