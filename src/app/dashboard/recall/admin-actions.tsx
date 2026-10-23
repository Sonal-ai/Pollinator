'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOperationRequest } from '@/components/use-operation-request';
import { AlertOctagon, CheckCircle } from 'lucide-react';

export function RecallButton({ batchCode }: { batchCode: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const postOperation = useOperationRequest();
  async function recall(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await postOperation('/api/batch/' + encodeURIComponent(batchCode) + '/recall', { reason });
      const body = await response.json() as { operationId?: string; error?: string };
      if (!response.ok || !body.operationId) throw new Error(body.error || 'Chain recall could not be prepared.');
      router.push('/dashboard/operations/' + body.operationId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Recall preparation failed.'); router.refresh(); }
    finally { setLoading(false); }
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"><AlertOctagon size={14} />Prepare recall</button>;
  return <form onSubmit={recall} className="max-w-sm space-y-3 rounded-xl border border-red-500/40 p-4"><label className="block text-xs font-semibold">Reason for recalling {batchCode}<textarea required minLength={3} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-sm" /></label><p className="text-xs leading-relaxed text-[var(--text-muted)]">Submitting activates the local safety warning and withdraws labels immediately. The chain recall then requires your administrator wallet approval.</p>{error && <p role="alert" className="text-xs">{error}</p>}<button disabled={loading} className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white">{loading ? 'Preparing…' : 'Activate warning and prepare approval'}</button><button type="button" onClick={() => setOpen(false)} className="ml-3 text-xs underline">Cancel</button></form>;
}

export function ResolveButton({ alertId }: { alertId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleResolve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to resolve alert.');
      }
    } catch {
      alert('Network communication error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleResolve}
      disabled={loading}
      className="px-3 py-1.5 bg-[var(--surface-subtle)] hover:bg-white/20 text-foreground hover:text-foreground text-xs font-semibold rounded-xl border border-[var(--surface-border)] disabled:opacity-50 transition whitespace-nowrap flex items-center justify-center gap-1.5"
    >
      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
      {loading ? 'Resolving...' : 'Dismiss Alert'}
    </button>
  );
}
