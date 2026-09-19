'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Zap, AlertTriangle, CheckCircle2, Flame, Wind, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

interface SimulatorModalProps {
  deviceId: string;
}

export function IotSimulatorModal({ deviceId }: SimulatorModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const [temp, setTemp] = useState(35.0);
  const [humidity, setHumidity] = useState(58.0);
  const [weight, setWeight] = useState(46.5);
  const [battery, setBattery] = useState(92);

  async function sendTelemetry(t: number, h: number, w: number, b: number, presetName: string) {
    setLoading(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/sensor-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer pollinator-iot-device-secret',
        },
        body: JSON.stringify({
          hiveId: deviceId,
          deviceId: deviceId,
          temperatureC: t,
          humidityPct: h,
          weightKg: w,
          batteryPct: b,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastResult(`✅ Transmitted ${presetName}: Score ${data.healthAssessment?.score}% (${data.healthAssessment?.status})`);
        router.refresh();
      } else {
        setLastResult('❌ Failed to transmit packet');
      }
    } catch {
      setLastResult('❌ Network error during transmission');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-400/40 text-xs font-mono text-cyan-300 hover:border-cyan-400 hover:text-white transition-all shadow-lg shadow-cyan-500/10 active:scale-95"
      >
        <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span>⚡ Simulate ESP32 Telemetry</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d111a] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-400" />
                  ESP32 Hive Telemetry Simulator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inject synthetic sensor packets into Edge Node <code className="text-cyan-300 font-mono">{deviceId}</code>
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white text-lg font-mono p-1"
              >
                ✕
              </button>
            </div>

            {/* Quick Diagnostic Presets */}
            <div className="space-y-3">
              <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                1-Click Apiculture Simulation Presets
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => sendTelemetry(35.1, 57.0, 47.8, 95, 'Optimal Nectar Flow')}
                  className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 100% Optimal
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">+0.8 kg</span>
                  </div>
                  <p className="text-[10px] text-slate-400">35.1°C • 57% RH • Steady Nectar Flow</p>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => sendTelemetry(38.4, 76.0, 45.9, 86, 'Heat Stress')}
                  className="p-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" /> Overheating
                    </span>
                    <span className="text-[10px] font-mono text-amber-300">38.4°C</span>
                  </div>
                  <p className="text-[10px] text-slate-400">76% RH • Fungal & Heat Shock Risk</p>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => sendTelemetry(34.8, 60.0, 43.5, 90, 'Swarm Departure')}
                  className="p-3 rounded-2xl border border-red-500/30 bg-red-950/20 hover:bg-red-900/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Swarm Alarm
                    </span>
                    <span className="text-[10px] font-mono text-red-300">-2.5 kg</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Sudden weight crash: Swarm left</p>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => sendTelemetry(30.4, 49.0, 46.0, 88, 'Chilled Brood')}
                  className="p-3 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-900/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5" /> Chilled Brood
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300">30.4°C</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Sub-optimal temp: Brood mortality</p>
                </button>
              </div>
            </div>

            {/* Custom Sliders */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Manual Fine-Tuning
              </label>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Temperature: <strong className="text-white font-mono">{temp}°C</strong></span>
                  <input
                    type="range"
                    min="25"
                    max="45"
                    step="0.5"
                    value={temp}
                    onChange={(e) => setTemp(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 mt-1"
                  />
                </div>

                <div>
                  <span className="text-slate-400">Humidity: <strong className="text-white font-mono">{humidity}%</strong></span>
                  <input
                    type="range"
                    min="20"
                    max="95"
                    step="1"
                    value={humidity}
                    onChange={(e) => setHumidity(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 mt-1"
                  />
                </div>

                <div>
                  <span className="text-slate-400">Weight: <strong className="text-white font-mono">{weight} kg</strong></span>
                  <input
                    type="range"
                    min="30"
                    max="60"
                    step="0.2"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 mt-1"
                  />
                </div>

                <div>
                  <span className="text-slate-400">Battery: <strong className="text-white font-mono">{battery}%</strong></span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={battery}
                    onChange={(e) => setBattery(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-400 mt-1"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => sendTelemetry(temp, humidity, weight, battery, 'Manual Packet')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Transmit Custom Packet
              </button>
            </div>

            {/* Status output */}
            {lastResult && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-center text-slate-200 animate-fade-in">
                {lastResult}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
