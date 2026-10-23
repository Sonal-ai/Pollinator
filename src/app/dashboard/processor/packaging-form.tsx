'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOperationRequest } from '@/components/use-operation-request';
import { Package, AlertCircle } from 'lucide-react';

type ProcessableBatch = {
  batchCode: string;
  honey_type: string;
  quantity_grams: number;
};

export function PackagingForm({ processableBatches }: { processableBatches: ProcessableBatch[] }) {
  const router = useRouter();
  const postOperation = useOperationRequest();
  const [batchCode, setBatchCode] = useState(processableBatches[0]?.batchCode ?? '');
  const [jarCount, setJarCount] = useState<number | ''>('');
  const [jarSizeGrams, setJarSizeGrams] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ error: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchCode || !jarCount || !jarSizeGrams) return;

    setLoading(true);
    setResult(null);

    try {
      const packRes = await postOperation('/api/batch/' + encodeURIComponent(batchCode) + '/package', { jarCount: Number(jarCount), jarSizeGrams: Number(jarSizeGrams) });
      const data = await packRes.json() as { operationId?: string; error?: string };
      if (!packRes.ok || !data.operationId) { setResult({ error: data.error || 'Packaging could not be prepared.' }); return; }
      router.push('/dashboard/operations/' + data.operationId);
    } catch {
      setResult({ error: 'Network communication failure. Please check connection.' });
    } finally {
      setLoading(false);
    }
  }

  if (processableBatches.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-12 text-center text-[var(--text-muted)] space-y-3 shadow-xl">
        <Package className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
        <h3 className="text-base font-bold text-foreground">No Batches Ready for Packaging</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
          Batches must be in custody and have their QA laboratory test verified on-chain before packaging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 sm:p-8 space-y-5 shadow-xl"
      >
        <div>
          <label htmlFor="packaging-batch" className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground mb-2">
            Select Lab-Verified Batch
          </label>
          <select
            id="packaging-batch"
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-foreground focus:outline-none focus:border-amber-400 transition-colors"
            required
          >
            <option value="" disabled className="bg-[var(--surface-solid)] text-[var(--text-muted)]">
              -- Choose a verified batch --
            </option>
            {processableBatches.map((b) => (
              <option key={b.batchCode} value={b.batchCode} className="bg-[var(--surface-solid)] text-foreground">
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg available)
              </option>
            ))}
          </select>
        </div>

        {/* Packaging Presets */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] self-center">Quick Packaging Presets:</span>
          <button
            type="button"
            onClick={() => {
              const selected = processableBatches.find(b => b.batchCode === batchCode) || processableBatches[0];
              const totalGrams = selected?.quantity_grams ?? 25000;
              setJarCount(1);
              setJarSizeGrams(totalGrams);
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-mono text-[var(--accent-ink)] transition-all"
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
            className="px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[10px] font-mono text-foreground transition-all"
          >
            🫙 500g Consumer Jars
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="packaging-count" className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground mb-2">
              Number of Jars / Containers
            </label>
            <input
              id="packaging-count"
              type="number"
              min="1"
              max="10000"
              required
              value={jarCount}
              onChange={(e) => setJarCount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs font-mono text-foreground focus:outline-none focus:border-amber-400 transition-colors"
              placeholder="e.g. 1"
            />
          </div>
          <div>
            <label htmlFor="packaging-size" className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground mb-2">
              Jar / Container Size (Grams)
            </label>
            <input
              id="packaging-size"
              type="number"
              min="1"
              max="1000000"
              required
              value={jarSizeGrams}
              onChange={(e) => setJarSizeGrams(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs font-mono text-foreground focus:outline-none focus:border-amber-400 transition-colors"
              placeholder="e.g. 50000"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !batchCode}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-foreground text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all active:scale-95 disabled:opacity-40"
        >
          {loading ? 'Preparing Packaging Approval...' : 'Review Packaging for Approval'}
        </button>
      </form>

      {result && (
        <div role="alert" className="flex items-center gap-2 rounded-3xl border border-red-500/40 p-5 text-xs text-red-400 shadow-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}
    </div>
  );
}
