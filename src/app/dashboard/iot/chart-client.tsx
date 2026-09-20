'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Reading {
  timestamp: string;
  tempC: number | null;
  humidityPct: number | null;
  weightKg: number | null;
}

interface ApiResponse {
  readings: Reading[];
  summary: {
    avgTempC: number | null;
    avgHumidityPct: number | null;
    weightGainKg: number | null;
    readingCount: number;
  };
}

export function IotChartClient({ hiveId }: { hiveId: string }) {
  const [data, setData] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [showTooltip, setShowTooltip] = useState(true);
  const [summary, setSummary] = useState<ApiResponse['summary'] | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/iot/${hiveId}?period=${period}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((d) => {
        setData(d.readings ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hiveId, period]);

  const chartData = data.map((r) => {
    const d = new Date(r.timestamp);
    const timeLabel =
      period === '24h'
        ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    return {
      time: timeLabel,
      'Temp °C': r.tempC !== null ? Number(r.tempC.toFixed(1)) : null,
      'Humidity %': r.humidityPct !== null ? Number(r.humidityPct.toFixed(1)) : null,
      'Weight kg': r.weightKg !== null ? Number(r.weightKg.toFixed(2)) : null,
    };
  });

  return (
    <div className="space-y-3">
      {/* Period Selector & Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 p-1 rounded-xl bg-black/50 border border-white/5">
            {(['24h', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg transition-all ${
                  period === p
                    ? 'bg-yellow-400 text-black shadow-md shadow-yellow-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Toggle to easily show or remove floating hover card */}
          <button
            type="button"
            onClick={() => setShowTooltip(!showTooltip)}
            className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
              showTooltip
                ? 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title="Toggle floating hover board"
          >
            {showTooltip ? '📊 Tooltip: ON' : '🚫 Tooltip: OFF'}
          </button>
        </div>

        {summary && (
          <span className="text-[10px] font-mono text-slate-500">
            {summary.readingCount} telemetry frames
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-44 flex items-center justify-center text-xs font-mono text-slate-500">
          Loading telemetry stream...
        </div>
      ) : data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs font-mono text-slate-500">
          No telemetry logged for this interval
        </div>
      ) : (
        <>
          {/* Summary tags */}
          {summary && (
            <div className="flex gap-2 text-[10px] font-mono flex-wrap">
              {summary.avgTempC !== null && (
                <span className="bg-yellow-400/10 text-yellow-300 border border-yellow-400/20 px-2 py-0.5 rounded-md font-bold">
                  Avg Temp: {summary.avgTempC.toFixed(1)}°C
                </span>
              )}
              {summary.avgHumidityPct !== null && (
                <span className="bg-sky-400/10 text-sky-300 border border-sky-400/20 px-2 py-0.5 rounded-md font-bold">
                  Avg Humidity: {summary.avgHumidityPct.toFixed(1)}%
                </span>
              )}
              {summary.weightGainKg !== null && (
                <span
                  className={`px-2 py-0.5 rounded-md font-bold border ${
                    summary.weightGainKg > 0
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-300 border-red-500/20'
                  }`}
                >
                  Weight Δ: {summary.weightGainKg > 0 ? '+' : ''}
                  {summary.weightGainKg.toFixed(2)} kg
                </span>
              )}
            </div>
          )}

          <div className="p-3 rounded-2xl bg-black/50 border border-white/5">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2233" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} stroke="#334155" />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} stroke="#334155" />
                {showTooltip && (
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="rounded-xl border border-yellow-400/30 bg-[#0d1017]/95 backdrop-blur-md p-2.5 text-xs font-mono shadow-2xl space-y-1 min-w-[140px]">
                          <p className="text-[10px] text-slate-400 font-bold border-b border-white/10 pb-1">
                            ⏰ {label}
                          </p>
                          <div className="space-y-0.5 pt-0.5 text-[11px]">
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center justify-between gap-3" style={{ color: entry.color }}>
                                <span className="text-[10px] text-slate-400">{entry.name}:</span>
                                <span className="font-extrabold">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                )}
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: '6px' }} />
                <Line
                  type="monotone"
                  dataKey="Temp °C"
                  stroke="#ffd21e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Humidity %"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Weight kg"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
