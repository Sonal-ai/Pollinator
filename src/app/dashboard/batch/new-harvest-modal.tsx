'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useOperationRequest } from '@/components/use-operation-request';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, ArrowRight, X } from 'lucide-react';

interface BeekeeperOption {
  id: string;
  name: string;
  region: string;
}

export function NewHarvestModal({
  beekeepers,
  defaultBeekeeperId,
}: {
  beekeepers: BeekeeperOption[];
  defaultBeekeeperId?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const initialBeekeeper = (defaultBeekeeperId && beekeepers.find(b => b.id === defaultBeekeeperId)) || beekeepers[0];
  const [beekeeperId, setBeekeeperId] = useState(initialBeekeeper?.id ?? '');
  const [honeyType, setHoneyType] = useState('Raw Multiflora Blossom Honey');
  const [quantityKg, setQuantityKg] = useState('50.0');
  const [hivesHarvested, setHivesHarvested] = useState('4');
  const [region, setRegion] = useState(initialBeekeeper?.region ?? 'Wardha, Maharashtra');
  const [result, setResult] = useState<{ error: string } | null>(null);
  const postOperation = useOperationRequest();
  const harvestTime = useRef('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const formId = useId();

  useEffect(() => {
    if (!isOpen || !dialog.current) return;
    const focusTarget = trigger.current;
    dialog.current.showModal();
    return () => { focusTarget?.focus(); };
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const quantityGrams = Math.round(parseFloat(quantityKg) * 1000);
      if (!harvestTime.current) harvestTime.current = new Date().toISOString();
      const res = await postOperation('/api/batch', {
          beekeeperId,
          honeyType,
          quantityGrams,
          hivesHarvested: parseInt(hivesHarvested, 10) || 1,
          harvestDate: harvestTime.current,
          region,
      });

      const data = await res.json();
      if (res.ok) {
        if (!data.operationId) throw new Error('Prepared operation was not returned');
        setIsOpen(false);
        router.push('/dashboard/operations/' + data.operationId);
      } else {
        setResult({ error: data.error || 'Failed to create batch' });
      }
    } catch {
      setResult({ error: 'Network error submitting harvest' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        onClick={() => {
          setIsOpen(true);
          harvestTime.current = '';
          setResult(null);
        }}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-black text-xs font-extrabold shadow-md shadow-yellow-500/20 transition-all active:scale-95 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Log New Harvest</span>
      </button>

      {isOpen && (
          <dialog ref={dialog} aria-labelledby={formId + '-title'} onClose={() => setIsOpen(false)} onCancel={event => { if (loading) event.preventDefault(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-yellow-400/30 bg-[var(--surface-solid)] p-6 sm:p-7 text-foreground shadow-2xl space-y-4 backdrop:bg-black/80 backdrop:backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌾</span>
                <h3 id={formId + '-title'} className="text-base font-extrabold text-foreground">Log Fresh Honey Harvest</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                aria-label="Close harvest form"
                disabled={loading}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--surface-subtle)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs font-mono">
                {result?.error && (
                  <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-[11px]">
                    ⚠️ {result.error}
                  </div>
                )}

                <div>
                  <label htmlFor={formId + '-beekeeper'} className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                    Select Beekeeper
                  </label>
                  <select
                    id={formId + '-beekeeper'}
                    value={beekeeperId}
                    onChange={(e) => {
                      setBeekeeperId(e.target.value);
                      const selected = beekeepers.find((b) => b.id === e.target.value);
                      if (selected) setRegion(selected.region);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-foreground focus:outline-none focus:border-yellow-400"
                    required
                  >
                    {beekeepers.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[var(--surface-solid)] text-foreground">
                        {b.name} ({b.region})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={formId + '-honey'} className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                      Honey Variety
                    </label>
                    <input
                      id={formId + '-honey'}
                      type="text"
                      value={honeyType}
                      onChange={(e) => setHoneyType(e.target.value)}
                      placeholder="e.g. Mustard, Multiflora"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-foreground focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor={formId + '-weight'} className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                      Harvest Weight (kg)
                    </label>
                    <input
                      id={formId + '-weight'}
                      type="number"
                      step="0.5"
                      min="1"
                      value={quantityKg}
                      onChange={(e) => setQuantityKg(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-[var(--accent-ink)] font-bold focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={formId + '-hives'} className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                      Hives Harvested
                    </label>
                    <input
                      id={formId + '-hives'}
                      type="number"
                      min="1"
                      value={hivesHarvested}
                      onChange={(e) => setHivesHarvested(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-foreground focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor={formId + '-region'} className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                      Origin Region
                    </label>
                    <input
                      id={formId + '-region'}
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-foreground focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-black text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Preparing harvest for approval...</span>
                      </>
                    ) : (
                      <>
                        <span>Review Harvest for Approval</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
          </dialog>
      )}
    </>
  );
}
