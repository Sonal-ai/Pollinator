'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, CheckCircle2, ArrowRight, X } from 'lucide-react';

interface BeekeeperOption {
  id: string;
  name: string;
  region: string;
}

export function NewHarvestModal({ beekeepers }: { beekeepers: BeekeeperOption[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [beekeeperId, setBeekeeperId] = useState(beekeepers[0]?.id ?? '');
  const [honeyType, setHoneyType] = useState('Raw Multiflora Blossom Honey');
  const [quantityKg, setQuantityKg] = useState('50.0');
  const [hivesHarvested, setHivesHarvested] = useState('4');
  const [region, setRegion] = useState(beekeepers[0]?.region ?? 'Wardha, Maharashtra');
  const [result, setResult] = useState<{ success?: boolean; batchCode?: string; txHash?: string; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const quantityGrams = Math.round(parseFloat(quantityKg) * 1000);
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beekeeperId,
          honeyType,
          quantityGrams,
          hivesHarvested: parseInt(hivesHarvested, 10) || 1,
          harvestDate: new Date().toISOString(),
          region,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          batchCode: data.batchCode,
          txHash: data.txHash,
        });
        router.refresh();
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
        onClick={() => {
          setIsOpen(true);
          setResult(null);
        }}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-black text-xs font-extrabold shadow-md shadow-yellow-500/20 transition-all active:scale-95 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Log New Harvest</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-yellow-400/30 bg-[#0d1017] p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌾</span>
                <h3 className="text-base font-extrabold text-white">Log Fresh Honey Harvest</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {result?.success ? (
              <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-sm font-bold text-white">Harvest Anchored to Blockchain!</h4>
                <p className="text-xs text-slate-300 font-mono">
                  Batch Code: <strong className="text-yellow-400">{result.batchCode}</strong>
                </p>
                {result.txHash && (
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    Tx: {result.txHash}
                  </p>
                )}
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push('/dashboard/custody');
                    }}
                    className="px-4 py-2 rounded-xl bg-yellow-400 text-black text-xs font-bold hover:bg-yellow-300 transition-colors"
                  >
                    Transfer Custody Now →
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs font-mono">
                {result?.error && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-[11px]">
                    ⚠️ {result.error}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Select Beekeeper
                  </label>
                  <select
                    value={beekeeperId}
                    onChange={(e) => {
                      setBeekeeperId(e.target.value);
                      const selected = beekeepers.find((b) => b.id === e.target.value);
                      if (selected) setRegion(selected.region);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-yellow-400"
                    required
                  >
                    {beekeepers.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#0d1017] text-white">
                        {b.name} ({b.region})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Honey Variety
                    </label>
                    <input
                      type="text"
                      value={honeyType}
                      onChange={(e) => setHoneyType(e.target.value)}
                      placeholder="e.g. Mustard, Multiflora"
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Harvest Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={quantityKg}
                      onChange={(e) => setQuantityKg(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Hives Harvested
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={hivesHarvested}
                      onChange={(e) => setHivesHarvested(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Origin Region
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-yellow-400"
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
                        <span>Minting On Polygon Amoy...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Harvest to Blockchain</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
