'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOperationRequest } from '@/components/use-operation-request';
import { Upload, FileText, AlertCircle } from 'lucide-react';

type PendingBatch = {
  id: string;
  batchCode: string;
  honey_type: string;
  quantity_grams: number;
};

export function LabUploadForm({ pendingBatches }: { pendingBatches: PendingBatch[] }) {
  const router = useRouter();
  const postOperation = useOperationRequest();
  const [batchId, setBatchId] = useState(pendingBatches[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [result, setResult] = useState<{ error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId || !file) return;
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setStatus('error');
      setResult({ error: 'Choose a nonempty PDF no larger than 10 MB.' });
      return;
    }

    setStatus('uploading');
    setResult(null);

    const formData = new FormData();
    formData.append('batchId', batchId);
    formData.append('file', file);

    try {
      const fileHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(byte => byte.toString(16).padStart(2, '0')).join('');
      const response = await postOperation('/api/certificate', formData, batchId + ':' + fileHash);
      const data = await response.json() as NonNullable<typeof result> & { operationId?: string };
      if (response.ok) {
        if (!data.operationId) throw new Error('Prepared operation was not returned');
        router.push('/dashboard/operations/' + data.operationId);
      } else {
        setStatus('error');
        setResult({ error: data.error || 'The certificate could not be prepared.' });
      }
    } catch {
      setStatus('error');
      setResult({ error: 'Network communication failure. Please retry.' });
    }
  }

  if (pendingBatches.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-12 text-center text-[var(--text-muted)] space-y-3 shadow-xl">
        <p className="text-3xl">🍯</p>
        <h3 className="text-base font-bold text-foreground">No Batches Awaiting Your Report</h3>
        <p className="text-xs text-[var(--text-muted)]">A processed batch must be assigned to your laboratory before you can prepare its certificate approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-6 sm:p-8 space-y-5 shadow-xl"
      >
        <div>
          <label htmlFor="certificate-batch" className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground mb-2">
            Select Harvest Batch
          </label>
          <select
            id="certificate-batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-foreground focus:outline-none focus:border-amber-400 transition-colors"
            required
          >
            <option value="" disabled className="bg-[var(--surface-solid)] text-[var(--text-muted)]">
              -- Choose a pending batch --
            </option>
            {pendingBatches.map((b) => (
              <option key={b.id} value={b.id} className="bg-[var(--surface-solid)] text-foreground">
                {b.batchCode} — {b.honey_type} ({(b.quantity_grams / 1000).toFixed(1)} kg)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pdf-upload" className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground mb-2">
            Laboratory Certificate PDF
          </label>
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">The report will be published to content-addressed storage for consumer verification. Remove personal details that do not belong in a public report before uploading.</p>
          <div className="border-2 border-dashed border-[var(--surface-border)] rounded-2xl p-8 text-center hover:border-amber-400/50 transition-colors bg-[var(--surface-subtle)]">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only peer"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block space-y-2 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-amber-400">
              {file ? (
                <div>
                  <FileText className="w-8 h-8 text-[var(--accent-ink)] mx-auto mb-1" />
                  <p className="text-xs font-bold text-foreground font-mono">{file.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{(file.size / 1024).toFixed(0)} KB · Ready to hash</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">Click to select lab certificate PDF</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Maximum size: 10MB</p>
                </div>
              )}
            </label>
          </div>

        </div>

        <button
          type="submit"
          disabled={status === 'uploading' || !batchId || !file}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-foreground text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all active:scale-95 disabled:opacity-40"
        >
          {status === 'uploading'
            ? 'Uploading PDF & Preparing Approval...'
            : 'Review Certificate for Approval'}
        </button>
      </form>

      {result?.error && (
        <div role="alert" className="flex items-center gap-2 rounded-3xl border border-red-500/40 p-5 text-xs text-red-400 shadow-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}
    </div>
  );
}
