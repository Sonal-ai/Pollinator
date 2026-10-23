'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { custodyStageOptions } from '@/lib/batch-workflow';
import { useOperationRequest } from '@/components/use-operation-request';
import type { Role } from '@/lib/access-policy';

type Batch = { id: string; batchCode: string; honey_type: string; quantity_grams: number; status: string };
type Actor = { walletAddress: string; role: string };
type Result = { error: string };
export function CustodyTransferForm({ myBatches, role, actors }: { myBatches: Batch[]; role: Role; actors: Actor[] }) {
  const router = useRouter();
  const postOperation = useOperationRequest();
  const [batchId, setBatchId] = useState(myBatches[0]?.id ?? '');
  const [toAddress, setToAddress] = useState('');
  const [nextStage, setNextStage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const batch = myBatches.find(item => item.id === batchId);
  const options = batch ? custodyStageOptions(batch.status, role) : [];
  const newStatus = options.includes(nextStage) ? nextStage : options[0] ?? '';
  const field = 'w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-foreground focus:outline-none focus:border-amber-500';
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setResult(null);
    try {
      const response = await postOperation('/api/custody', { batchId, toAddress, newStatus });
      const data = await response.json() as { error?: string; operationId?: string };
      if (!response.ok || !data.operationId) throw new Error(data.error || 'Handover approval could not be prepared.');
      router.push('/dashboard/operations/' + data.operationId);
    } catch { setResult({ error: 'Could not reach the registry. Please try again.' }); }
    finally { setLoading(false); }
  }
  if (!myBatches.length) return <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-8"><h2 className="font-semibold">No batches ready for handover</h2><p className="mt-3 text-sm text-[var(--text-muted)]">Only active, registered batches held by your wallet can be handed over.</p></div>;
  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-6 sm:p-8">
    <div><label htmlFor="custody-batch" className="mb-2 block text-sm font-semibold">Batch in your custody</label><select id="custody-batch" className={field} value={batchId} onChange={event => { setBatchId(event.target.value); setNextStage(''); }} required>{myBatches.map(item => <option key={item.id} value={item.id}>{item.batchCode} · {item.status.replaceAll('_', ' ')}</option>)}</select></div>
    {batch && <p className="text-sm text-[var(--text-muted)]">Declared mass: {(batch.quantity_grams / 1000).toLocaleString()} kg · {batch.honey_type}</p>}
    <div><label htmlFor="custody-recipient" className="mb-2 block text-sm font-semibold">Recipient wallet</label><input id="custody-recipient" className={field} list="enrolled-custodians" value={toAddress} onChange={event => setToAddress(event.target.value)} placeholder="0x…" pattern="0x[a-fA-F0-9]{40}" required /><datalist id="enrolled-custodians">{actors.map(actor => <option key={actor.walletAddress} value={actor.walletAddress}>{actor.role}</option>)}</datalist><p className="mt-2 text-xs text-[var(--text-muted)]">Choose an enrolled actor. The contract checks the recipient’s role.</p></div>
    <div><label htmlFor="custody-stage" className="mb-2 block text-sm font-semibold">Stage after handover</label><select id="custody-stage" className={field} value={newStatus} onChange={event => setNextStage(event.target.value)} required>{options.map(stage => <option key={stage} value={stage}>{stage.replaceAll('_', ' ')}{stage === batch?.status ? ' · preserve current stage' : ''}</option>)}</select></div>
    <p className="text-xs leading-relaxed text-[var(--text-muted)]">Laboratory approval and packaging have dedicated workflows. The custodian changes only after a successful chain receipt. Actor authorization and a configured registry are required.</p>
    <button disabled={loading || !newStatus} className="flex items-center gap-3 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{loading ? 'Preparing handover approval…' : 'Review handover for approval'}<ArrowRight size={16} /></button>
    {result && <div role="alert" className="rounded-xl border border-[var(--surface-border)] p-4 text-sm"><AlertCircle size={18} className="mb-2" />{result.error}</div>}
  </form>;
}
