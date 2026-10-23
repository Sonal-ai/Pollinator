'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bluetooth, CloudUpload, Smartphone, Unplug } from 'lucide-react';
import { HiveBleConnection, phoneBluetooth } from '@/lib/telemetry/bluetooth';
import { LocalGatewayQueue, type GatewayRecord } from '@/lib/telemetry/local-queue';
import { requestGateway, syncPhoneQueue } from '@/lib/telemetry/phone-sync';

type Device = { deviceId: string; source: 'DEVICE' | 'SIMULATED' | 'LEGACY' };
const subscribeNetwork = (notify: () => void) => {
  window.addEventListener('online', notify); window.addEventListener('offline', notify);
  return () => { window.removeEventListener('online', notify); window.removeEventListener('offline', notify); };
};
const networkSnapshot = () => navigator.onLine;
const browserSnapshot = () => window.isSecureContext && Boolean(phoneBluetooth());
const subscribeBrowser = () => () => {};
export function PhoneGateway({ accountId, devices }: { accountId: string; devices: Device[] }) {
  const [selected, setSelected] = useState(devices[0]?.deviceId || '');
  const [rows, setRows] = useState<GatewayRecord[]>([]);
  const [ready, setReady] = useState(false), [connected, setConnected] = useState(false);
  const online = useSyncExternalStore<boolean | null>(subscribeNetwork, networkSnapshot, () => null);
  const supported = useSyncExternalStore(subscribeBrowser, browserSnapshot, () => false);
  const [connecting, setConnecting] = useState(false), [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('Opening this account’s phone queue…');
  const [error, setError] = useState(''), [discard, setDiscard] = useState<string | null>(null);
  const queue = useRef<LocalGatewayQueue | null>(null), connection = useRef<HiveBleConnection | null>(null);
  const busy = useRef(false), alive = useRef(false), syncAbort = useRef<AbortController | null>(null);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(async () => {
    const items = await queue.current?.list();
    if (alive.current && items) setRows(items);
  }, []);

  useEffect(() => {
    alive.current = true;
    const network = () => { setError(''); };
    window.addEventListener('online', network);
    let local: LocalGatewayQueue | undefined, cancelled = false;
    void LocalGatewayQueue.open(accountId).then(async opened => {
      local = opened;
      if (cancelled) { opened.close(); return; }
      queue.current = opened; setReady(true); await refresh();
      setMessage('Phone queue ready. Choose an enrolled hive to collect readings.');
    }).catch(() => { if (!cancelled) setError('Local storage is unavailable. Readings must stay on the hive.'); });
    return () => {
      cancelled = true; alive.current = false; syncAbort.current?.abort(); connection.current?.disconnect(); connection.current = null;
      if (nextTimer.current) clearTimeout(nextTimer.current);
      queue.current = null; local?.close();
      window.removeEventListener('online', network);
    };
  }, [accountId, refresh]);

  const synchronize = useCallback(async () => {
    const local = queue.current;
    if (!local || busy.current || !selected || !navigator.onLine) return;
    busy.current = true; setSyncing(true); setError('');
    const controller = new AbortController(); syncAbort.current = controller;
    try {
      const result = await syncPhoneQueue(local, {
        deviceId: selected, signal: controller.signal,
        request: (envelope, statusOnly) => requestGateway(accountId, envelope, statusOnly, controller.signal),
        acknowledge: async (record, receipt) => {
          const hive = connection.current;
          if (!hive || record.deviceId !== selected) return false;
          await hive.acknowledge(receipt); return true;
        },
        updated: refresh,
      });
      if (alive.current) setMessage(result.receiptsSent ? `${result.receiptsSent} storage receipt(s) sent to the hive. Firmware must verify each receipt.`
        : result.stored ? `${result.stored} reading(s) stored. Reconnect this hive to return its receipts.` : 'Saved readings checked. Receipts stay on this phone until the hive reconnects.');
    } catch (failure) {
      if (alive.current) setError(controller.signal.aborted ? 'Sync stopped. Saved readings remain on this phone.' : failure instanceof Error ? failure.message : 'Cannot sync now. Saved readings were kept.');
    } finally {
      busy.current = false; syncAbort.current = null;
      if (alive.current) setSyncing(false);
    }
  }, [accountId, selected, refresh]);

  // Batches are bounded and spaced. Network errors stop retries until a user action or reconnect.
  useEffect(() => {
    if (!ready || !online || syncing || error || !rows.some(row => row.deviceId === selected && (!row.receipt || connected))) return;
    const timer = setTimeout(() => { void synchronize(); }, 10000);
    return () => clearTimeout(timer);
  }, [ready, online, syncing, error, rows, selected, connected, synchronize]);

  async function connectHive() {
    const adapter = phoneBluetooth(), local = queue.current, deviceId = selected;
    if (!adapter || !local || connecting || connected || !deviceId) return;
    setConnecting(true); setError('');
    let received = 0;
    try {
      const hive = await HiveBleConnection.connect(adapter, {
        frame: async frame => {
          if (!alive.current) return;
          if ('event' in frame) {
            setMessage('Hive journal caught up. Waiting for new readings.');
            if (nextTimer.current) clearTimeout(nextTimer.current);
            nextTimer.current = setTimeout(() => { void connection.current?.next().catch(() => {}); }, 15000);
            return;
          }
          if (++received > 10000) throw new Error('Collection limit reached. Review the queue before reconnecting.');
          await local.put(frame, deviceId); // Commit local storage before asking for the next journal entry.
          await refresh(); setMessage('Signed packet saved on this phone. The hive keeps its copy until it verifies a storage receipt.');
          await connection.current?.next();
        },
        disconnected: () => { connection.current = null; if (nextTimer.current) clearTimeout(nextTimer.current); if (alive.current) { setConnected(false); setMessage('Hive disconnected. Saved packets remain in the phone queue.'); } },
        error: failure => { if (alive.current) { setConnected(false); setError(failure.message); } connection.current = null; },
      });
      if (!alive.current) { hive.disconnect(); return; }
      connection.current = hive; setConnected(true); setMessage(`Connected to ${hive.name}. Collecting this hive’s journal.`);
      await hive.rewind();
    } catch (failure) {
      connection.current?.disconnect(); connection.current = null;
      if (alive.current) { setConnected(false); setError(failure instanceof Error ? failure.message : 'Cannot connect to this hive.'); }
    } finally { if (alive.current) setConnecting(false); }
  }
  function disconnectHive() {
    connection.current?.disconnect(); connection.current = null; setConnected(false);
    if (nextTimer.current) clearTimeout(nextTimer.current);
    setMessage('Disconnected. Stored readings and pending receipts remain on this phone.');
  }
  async function discardPacket(id: string) {
    try { await queue.current?.discardFromPhone(id); setDiscard(null); await refresh(); }
    catch { setError('Cannot remove the local copy. Retry after storage is available.'); }
  }
  const visible = rows.filter(row => row.deviceId === selected), waiting = visible.filter(row => !row.receipt).length;
  return <section aria-labelledby="phone-gateway-heading" className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-5 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="phone-gateway-heading" className="text-lg font-bold flex items-center gap-2"><Smartphone size={21} />Phone gateway</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Collect nearby hive readings, then sync them when internet returns.</p></div>
      <span className="text-sm font-semibold">{online === null ? 'Checking connection…' : online ? 'Internet available' : 'Offline collection'} · {connected ? 'Hive connected' : 'Hive disconnected'}</span>
    </div>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="flex-1 min-w-52 text-sm font-semibold">Enrolled hive
        <select aria-label="Enrolled hive for phone gateway" value={selected} disabled={connecting || connected || syncing || !devices.length}
          onChange={event => { setSelected(event.target.value); setError(''); setDiscard(null); }}
          className="block w-full mt-2 p-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-foreground">
          {!devices.length && <option value="">No active enrolled devices</option>}
          {devices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.deviceId} · {device.source}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => { void connectHive(); }} disabled={!supported || !ready || !selected || connecting || connected}
        className="button-primary disabled:opacity-50 disabled:cursor-not-allowed"><Bluetooth size={17} />{connecting ? 'Connecting…' : 'Connect nearby hive'}</button>
      {connected && <button type="button" onClick={disconnectHive} className="p-3 rounded-lg border border-[var(--surface-border)] text-sm font-semibold inline-flex gap-2 items-center"><Unplug size={16} />Disconnect</button>}
    </div>
    {!supported && <p className="text-sm text-[var(--text-muted)]">Bluetooth collection needs HTTPS and a browser with Web Bluetooth support. You can still sync packets already saved on this phone.</p>}
    <p className="text-sm text-[var(--text-muted)]">Compatible Honey Chain firmware is required. Keep this page open while collecting offline. Saved packets stay in this browser for your account. There is no background collection.</p>
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--surface-border)] py-4">
      <p className="text-sm"><strong>{waiting}</strong> waiting for storage · <strong>{visible.length - waiting}</strong> waiting to return a receipt{rows.length > visible.length ? ` · ${rows.length - visible.length} saved for other hives` : ''}</p>
      <div className="flex gap-3"><button type="button" onClick={() => { void synchronize(); }} disabled={!ready || !online || syncing || !visible.length}
        className="text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"><CloudUpload size={18} />{syncing ? 'Syncing…' : 'Sync saved readings'}</button>
        {syncing && <button type="button" className="text-sm underline" onClick={() => syncAbort.current?.abort()}>Stop sync</button>}</div>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-[var(--text-muted)]">{message}</p>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    {!!visible.length && <ul className="divide-y divide-[var(--surface-border)]">
      {visible.slice(0, 12).map(row => <li key={row.id} className="py-3 text-sm space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><span>Sequence {row.sequence} · {new Date(row.observedAt).toLocaleString()}</span>
          <strong>{row.receipt ? 'Database receipt saved' : 'Queued on phone'}</strong></div>
        {row.lastError && <p className="text-[var(--text-muted)]">{row.lastError}</p>}
        {discard === row.id ? <div className="space-y-2"><p>Remove this phone’s copy? Hive and server records stay unchanged. Unconfirmed readings may exist only on the hive afterward.</p>
          <button type="button" disabled={syncing} className="text-red-500 font-bold mr-4" onClick={() => { void discardPacket(row.id); }}>Remove local copy</button>
          <button type="button" className="underline" onClick={() => setDiscard(null)}>Keep it</button></div>
          : <button type="button" disabled={syncing} className="text-xs underline text-[var(--text-muted)]" onClick={() => setDiscard(row.id)}>Discard from this phone</button>}
      </li>)}
      {visible.length > 12 && <li className="pt-3 text-sm text-[var(--text-muted)]">Showing the first 12 of {visible.length} saved packets.</li>}
    </ul>}
  </section>;
}
