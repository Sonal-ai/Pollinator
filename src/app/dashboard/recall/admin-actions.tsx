'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
        body: JSON.stringify({ reason: 'Recalled due to scan anomaly' })
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to recall batch.');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button 
      onClick={handleRecall}
      disabled={loading}
      className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition whitespace-nowrap"
    >
      {loading ? '⏳ Recalling...' : '🚨 Recall Batch'}
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
    } catch (e) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button 
      onClick={handleResolve}
      disabled={loading}
      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition whitespace-nowrap"
    >
      {loading ? '⏳ Resolving...' : '✓ Resolve'}
    </button>
  );
}
