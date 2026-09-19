'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertOctagon, CheckCircle } from 'lucide-react';

export function RecallButton({ batchCode }: { batchCode: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRecall() {
    if (!confirm(`Are you sure you want to recall batch ${batchCode}? This action will be committed to the blockchain and cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/batch/${batchCode}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Recalled due to scan anomaly' }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to recall batch.');
      }
    } catch {
      alert('Network communication error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button 
      onClick={handleRecall}
      disabled={loading}
      className="px-3 py-1.5 bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition shadow-lg shadow-red-600/20 whitespace-nowrap flex items-center justify-center gap-1.5"
    >
      <AlertOctagon className="w-3.5 h-3.5" />
      {loading ? 'Recalling On-Chain...' : 'Recall Batch'}
    </button>
  );
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
      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-white/10 disabled:opacity-50 transition whitespace-nowrap flex items-center justify-center gap-1.5"
    >
      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
      {loading ? 'Resolving...' : 'Dismiss Alert'}
    </button>
  );
}
