'use client';
import { useState } from 'react';
import Image from 'next/image';
type Label = { jarIndex: number; verifyUrl: string; qrImageBase64: string };
export function BatchLabels({ batchCode, jarCount, jarSizeGrams }: { batchCode: string; jarCount: number; jarSizeGrams: number }) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchCode, jarCount, jarSizeGrams }) });
      const body = await response.json() as { qrTokens?: Label[]; error?: string };
      if (!response.ok || !body.qrTokens) throw new Error(body.error || 'Could not load serialized labels.');
      setLabels(body.qrTokens);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load labels.'); }
    finally { setLoading(false); }
  }
  return <div className="mt-4 space-y-4"><button type="button" disabled={loading || !jarCount} onClick={load} className="rounded-lg border border-[var(--surface-border)] px-4 py-2 text-xs disabled:opacity-50">{loading ? 'Preparing labels…' : 'Generate or reprint ' + jarCount + ' serialized labels'}</button>{error && <p role="alert" className="text-xs">{error}</p>}{labels.length > 0 && <><button type="button" onClick={() => window.print()} className="ml-3 text-xs underline">Print labels</button><p className="text-xs text-[var(--text-muted)]">Reprints retain the same jar serials. A printed QR can be copied; it is not proof of physical purity.</p><div className="label-print-sheet grid grid-cols-2 gap-3 sm:grid-cols-3">{labels.map(label => <div key={label.jarIndex} className="label-print-card rounded-xl border border-[var(--surface-border)] bg-white p-3 text-center text-black"><Image unoptimized src={label.qrImageBase64} alt={'QR for ' + batchCode + ' jar ' + label.jarIndex} width={180} height={180} className="mx-auto" /><p className="break-all font-mono text-[9px]">{batchCode} · jar {label.jarIndex}/{jarCount}</p><p className="mt-1 text-[9px]">{jarSizeGrams} g · Honey Chain</p><a href={label.verifyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] underline print:hidden">Inspect signed link</a></div>)}</div></>}</div>;
}
