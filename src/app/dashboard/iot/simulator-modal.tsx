'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function IotSimulatorModal({ devices }: { devices: string[] }) {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState(devices[0] || '');
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [temp, setTemp] = useState(35), [humidity, setHumidity] = useState(58), [weight, setWeight] = useState(40);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/iot/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, metrics: { tempC: temp, humidityPct: humidity, weightKg: weight, batteryPct: 90 } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Simulation failed');
      setMessage('Synthetic packet saved. It remains labelled SIMULATED in history.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Simulation unavailable'); }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" disabled={!devices.length} onClick={() => setOpen(true)} className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm disabled:opacity-50">Simulate a reading</button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="sim-heading" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-5">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-[var(--surface-solid)] p-6 text-foreground">
        <div className="flex justify-between gap-4"><h2 id="sim-heading" className="font-bold">Synthetic telemetry</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close simulation">Close</button></div>
        <p className="text-sm text-[var(--text-muted)]">Demonstration data. This cannot write to a physical device or establish colony health.</p>
        <label className="block text-sm">Enrolled simulation device<select value={deviceId} onChange={event => setDeviceId(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-solid)] p-2">{devices.map(id => <option key={id}>{id}</option>)}</select></label>
        {[{label:'Temperature (°C)',value:temp,set:setTemp,min:-20,max:70},{label:'Humidity (%)',value:humidity,set:setHumidity,min:0,max:100},{label:'Scale weight (kg)',value:weight,set:setWeight,min:0,max:500}].map(item => <label className="block text-sm" key={item.label}>{item.label}<input required type="number" step="0.1" min={item.min} max={item.max} value={item.value} onChange={event => item.set(event.target.valueAsNumber)} className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-solid)] p-2" /></label>)}
        <button disabled={busy || !deviceId} className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-50">{busy ? 'Saving…' : 'Save simulated packet'}</button>
        <p role="status" className="text-sm">{message}</p>
      </form>
    </div>}
  </div>;
}
