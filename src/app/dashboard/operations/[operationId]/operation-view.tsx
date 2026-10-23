'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrowserProvider, type Eip1193Provider, type TypedDataField } from 'ethers';
import { CheckCircle2, Clock, ShieldAlert, Wallet, ArrowUpRight } from 'lucide-react';
import type { OperationPayload, ForwardAuthorization } from '@/lib/chain/protocol';
import type { publicOperation } from '@/lib/chain/http';

type View = ReturnType<typeof publicOperation>;
const labels: Record<string, string> = { AWAITING_SIGNATURE: 'Waiting for actor approval', READY: 'Approved. Waiting for the gas relayer.', SIGNED: 'Transaction stored. Sending to the chain.', SUBMITTED: 'Waiting for chain confirmations.', CONFIRMED: 'Confirmed on-chain and applied to the registry.', FAILED: 'The operation failed.', NEEDS_REVIEW: 'This operation needs reconciliation.' };
export function OperationView({ initial, payload, accountWallet, allowFixture = false }: { initial: View; payload: OperationPayload; accountWallet: string; allowFixture?: boolean }) {
  const [op, setOp] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receiptHash, setReceiptHash] = useState('');
  const router = useRouter();
  const ownsWallet = accountWallet.toLowerCase() === op.actorAddress.toLowerCase();
  useEffect(() => {
    if (['CONFIRMED','FAILED','NEEDS_REVIEW'].includes(op.state)) return;
    const controller = new AbortController();
    let fetching = false;
    const timer = setInterval(async () => {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch('/api/operations/' + op.id, { signal: controller.signal });
        if (!response.ok) return;
        const body = await response.json() as { operation: View };
        if (!controller.signal.aborted) setOp(body.operation);
      } catch { /* Keep the last known state; never turn a poll failure into confirmation. */ }
      finally { fetching = false; }
    }, 3000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [op.id, op.state]);
  async function approve() {
    setBusy(true); setError('');
    try {
      const prepared = await fetch('/api/operations/' + op.id + '/authorization', { method: 'POST' });
      const auth = await prepared.json() as ForwardAuthorization & { types: Record<string, TypedDataField[]>; error?: string };
      if (!prepared.ok) throw new Error(auth.error || 'Approval could not be prepared.');
      const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
      if (!injected) throw new Error('Open this operation in a browser with an Ethereum-compatible wallet such as MetaMask. Your prepared request has been saved.');
      const provider = new BrowserProvider(injected, 'any');
      await provider.send('eth_requestAccounts', []);
      if ((await provider.getNetwork()).chainId !== BigInt(auth.domain.chainId)) await provider.send('wallet_switchEthereumChain', [{ chainId: '0x' + auth.domain.chainId.toString(16) }]);
      const signer = await provider.getSigner();
      if ((await signer.getAddress()).toLowerCase() !== op.actorAddress.toLowerCase()) throw new Error('Select the enrolled actor wallet shown on this page.');
      const signature = await signer.signTypedData(auth.domain, auth.types, auth.message);
      const response = await fetch('/api/operations/' + op.id + '/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signature }) });
      const result = await response.json() as { operation?: View; error?: string };
      if (!response.ok || !result.operation) throw new Error(result.error || 'Approval was not accepted.');
      setOp(result.operation);
    } catch (cause) { setError(cause instanceof Error ? cause.message.slice(0, 400) : 'Wallet approval was not completed.'); }
    finally { setBusy(false); }
  }
  async function reconcile(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/operations/' + op.id + '/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txHash: receiptHash }) });
      const result = await response.json() as { operation?: View; error?: string };
      if (!response.ok || !result.operation) throw new Error(result.error || 'Could not reconcile this transaction.');
      setOp(result.operation);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reconciliation failed.'); }
    finally { setBusy(false); }
  }
  async function approveFixture() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/operations/' + op.id + '/approve-fixture', { method: 'POST' });
      const result = await response.json() as { operation?: View; error?: string };
      if (!response.ok || !result.operation) throw new Error(result.error || 'Local fixture approval failed.');
      setOp(result.operation);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Local fixture approval failed.'); }
    finally { setBusy(false); }
  }
  async function retry() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/operations/' + op.id + '/retry', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } });
      const result = await response.json() as { operationId?: string; error?: string };
      if (!response.ok || !result.operationId) throw new Error(result.error || 'Retry could not be prepared.');
      router.push('/dashboard/operations/' + result.operationId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Retry failed.'); }
    finally { setBusy(false); }
  }
  const facts = [['Batch', payload.batchCode], ['Action', payload.kind.replaceAll('_', ' ')], ['Approving wallet', op.actorAddress], ['Network', op.chainId === 31337 ? 'Local development chain · 31337' : 'Polygon Amoy testnet · 80002']];
  if (payload.kind === 'CREATE_BATCH') facts.push(['Declared harvest', (payload.quantityGrams / 1000).toLocaleString() + ' kg · ' + payload.honeyType], ['Origin', payload.region]);
  if (payload.kind === 'TRANSFER_CUSTODY') facts.push(['Recipient', payload.toAddress], ['Resulting stage', payload.newStatus.replaceAll('_', ' ')]);
  if (payload.kind === 'VERIFY_LAB') facts.push(['Report SHA-256', payload.certificateHash], ['Report CID', payload.ipfsCID]);
  if (payload.kind === 'PACKAGE_BATCH') facts.push(['Packaging', payload.jarCount + ' jars × ' + payload.jarSizeGrams + ' g']);
  if (payload.kind === 'RECALL_BATCH') facts.push(['Reason', payload.reason]);
  return <div className="mx-auto max-w-3xl space-y-7"><Link href="/dashboard/operations" className="text-xs text-[var(--text-muted)]">← All operations</Link><div><p className="eyebrow">REVIEW BEFORE APPROVING</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{payload.kind.replaceAll('_', ' ')}</h1></div>
    <div role="status" className="flex gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-5">{op.state === 'CONFIRMED' ? <CheckCircle2 className="shrink-0" /> : ['FAILED','NEEDS_REVIEW'].includes(op.state) ? <ShieldAlert className="shrink-0" /> : <Clock className="shrink-0" />}<div><h2 className="text-sm font-semibold">{labels[op.state]}</h2><p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{op.lastError || (op.state === 'AWAITING_SIGNATURE' ? 'Your signature approves this exact action. A separate relayer pays the network fee.' : 'The status updates when a stored receipt has been checked and applied.')}</p>{payload.kind === 'RECALL_BATCH' && <p className="mt-2 text-xs">The local safety recall remains active. The operation status above shows whether the chain recall is confirmed.</p>}</div></div>
    <dl className="divide-y divide-[var(--surface-border)]">{facts.map(([label, value]) => <div key={label} className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]"><dt className="text-xs text-[var(--text-muted)]">{label}</dt><dd className="break-all text-sm">{value}</dd></div>)}</dl>
    {error && <p role="alert" className="rounded-xl border border-red-500/40 p-4 text-sm">{error}</p>}
    {op.state === 'AWAITING_SIGNATURE' && (ownsWallet ? <button type="button" disabled={busy} onClick={approve} className="flex items-center gap-3 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"><Wallet size={17} />{busy ? 'Waiting for wallet…' : 'Review and approve with wallet'}</button> : <p className="text-sm text-[var(--text-muted)]">The enrolled actor must sign from their own account. Preparing a request does not grant approval authority.</p>)}
    {op.state === 'AWAITING_SIGNATURE' && ownsWallet && allowFixture && <div className="rounded-xl border border-[var(--surface-border)] p-4"><p className="text-xs leading-relaxed text-[var(--text-muted)]">Local test account: the Hardhat node holds this fixture key. This is a software demonstration, not a real farmer or laboratory approval.</p><button type="button" onClick={approveFixture} disabled={busy} className="mt-3 text-sm underline">Approve with local test wallet</button></div>}
    {op.state === 'FAILED' && ownsWallet && <button type="button" disabled={busy} onClick={retry} className="rounded-xl border border-[var(--surface-border)] px-5 py-3 text-sm">Prepare a new approval for this failed operation</button>}
    {op.txHash && <div className="rounded-xl border border-[var(--surface-border)] p-4"><p className="text-xs text-[var(--text-muted)]">Transaction</p><p className="mt-2 break-all font-mono text-xs">{op.txHash}</p>{op.chainId === 80002 && <a href={'https://amoy.polygonscan.com/tx/' + op.txHash} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-xs underline">Inspect receipt <ArrowUpRight size={14} /></a>}</div>}
    {op.state === 'NEEDS_REVIEW' && <form onSubmit={reconcile} className="space-y-3 rounded-xl border border-[var(--surface-border)] p-5"><label htmlFor="receipt-hash" className="block text-sm font-semibold">Recover a matching chain transaction</label><p className="text-xs leading-relaxed text-[var(--text-muted)]">Use a transaction that executed this exact approval. The server checks its target, signed action, actor and receipt before changing the batch.</p><input id="receipt-hash" className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-xs" placeholder="0x… transaction hash" pattern="0x[0-9a-fA-F]{64}" required value={receiptHash} onChange={event => setReceiptHash(event.target.value)} /><button disabled={busy} className="text-sm underline">Check transaction and reconcile</button></form>}
    <details className="rounded-xl border border-[var(--surface-border)] p-5"><summary className="cursor-pointer text-xs">Contract and operation reference</summary><p className="mt-4 break-all font-mono text-xs">Registry: {op.registryAddress}<br />Forwarder: {op.forwarderAddress}<br />Operation: {op.id}</p></details>
  </div>;
}
