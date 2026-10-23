'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ProductivityEstimate } from '@/lib/productivity';

interface Reading {
  timestamp: string;
  tempC: number | null;
  humidityPct: number | null;
  weightKg: number | null;
}

interface ApiResponse {
  productivity: ProductivityEstimate;
  readings: Reading[];
  summary: {
    avgTempC: number | null;
    avgHumidityPct: number | null;
    weightGainKg: number | null;
    readingCount: number;
    source: string;
    truncated: boolean;
  };
}

export function IotChartClient({ hiveId, initialSource = 'DEVICE' }: { hiveId: string; initialSource?: string }) {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [source, setSource] = useState(initialSource);
  const [showTooltip, setShowTooltip] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${hiveId}:${period}:${source}:${attempt}`;
  const [result, setResult] = useState<{ key: string; response?: ApiResponse; error?: string }>({ key: '' });
  const loading = result.key !== requestKey;
  const data = loading ? [] : result.response?.readings ?? [];
  const summary = loading ? null : result.response?.summary ?? null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/iot/${encodeURIComponent(hiveId)}?period=${period}&source=${source}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('Sensor history is temporarily unavailable.'); return r.json() as Promise<ApiResponse>; })
      .then((d) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, response: d });
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ key: requestKey, error: 'Sensor history is temporarily unavailable. Please retry.' }); });
    return () => controller.abort();
  }, [hiveId, period, source, requestKey]);

  const chartData = data.map((r, idx) => {
    const d = new Date(r.timestamp);
    const timeFormatted = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const dateFormatted = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

    return {
      key: `${r.timestamp}_${idx}`,
      time: timeFormatted,
      fullLabel: `${dateFormatted} ${timeFormatted}`,
      'Temp °C': r.tempC !== null ? Number(r.tempC.toFixed(1)) : null,
      'Humidity %': r.humidityPct !== null ? Number(r.humidityPct.toFixed(1)) : null,
      'Weight kg': r.weightKg !== null ? Number(r.weightKg.toFixed(2)) : null,
    };
  });

  return (
    <div className="space-y-3">
      <label className="block text-xs text-[var(--text-muted)]">Reading source (kept separate)
        <select value={source} onChange={event => setSource(event.target.value)} className="ml-2 rounded border border-[var(--surface-border)] bg-[var(--surface-solid)] p-1 text-foreground">
          <option value="DEVICE">Device-signed</option><option value="SIMULATED">Simulated</option><option value="LEGACY">Legacy / unverified</option>
        </select>
      </label>
      {result.response?.productivity && !loading && <div className="rounded-xl border border-[var(--surface-border)] p-3 text-xs space-y-1">
        <p className="font-semibold">Scale trend scenario · {result.response.productivity.status.replaceAll('_', ' ')}</p>
        <p>{result.response.productivity.message}</p>
        {result.response.productivity.sevenDayChangeKg !== null && <p>Projected 7-day gross-scale change: {result.response.productivity.sevenDayChangeKg} kg · sensitivity band {result.response.productivity.scenarioRangeKg?.join(' to ')} kg</p>}
        <p className="text-[var(--text-muted)]">{result.response.productivity.dailySamples} daily medians · {result.response.productivity.modelVersion}</p>
      </div>}
      {/* Period Selector & Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
            {(['24h', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg transition-all ${
                  period === p
                    ? 'bg-yellow-400 text-black shadow-md shadow-yellow-500/20'
                    : 'text-[var(--text-muted)] hover:text-foreground'
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
                ? 'bg-amber-400/20 text-[var(--accent-ink)] border-amber-400/40 hover:bg-amber-400/30'
                : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
            }`}
            title="Toggle floating board on or off"
          >
            {showTooltip ? 'Floating Board: ON' : 'Floating Board: HIDDEN'}
          </button>
        </div>

        {summary && (
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {summary.source} · {summary.readingCount} telemetry frames{summary.truncated ? ' (latest 5,000 only)' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-44 flex items-center justify-center text-xs font-mono text-[var(--text-muted)]">
          Loading telemetry stream...
        </div>
      ) : result.error ? (
        <div role="status" className="py-12 text-center text-sm text-[var(--text-muted)]">{result.error}<button type="button" className="ml-3 underline" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>
      ) : data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs font-mono text-[var(--text-muted)]">
          No telemetry logged for this interval
        </div>
      ) : (
        <>
          {/* Summary tags */}
          {summary && (
            <div className="flex gap-2 text-[10px] font-mono flex-wrap">
              {summary.avgTempC !== null && (
                <span className="bg-yellow-400/10 text-[var(--accent-ink)] border border-yellow-400/20 px-2 py-0.5 rounded-md font-bold">
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

          <div className="p-3 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2233" />
                <XAxis
                  dataKey="key"
                  tickFormatter={(val) => {
                    const item = chartData.find((d) => d.key === val);
                    return item ? item.time : '';
                  }}
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  stroke="#334155"
                  interval="preserveStartEnd"
                  minTickGap={25}
                />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} stroke="#334155" />
                {showTooltip && (
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="rounded-xl border border-yellow-400/40 bg-[var(--surface-solid)] backdrop-blur-md p-2.5 text-xs font-mono shadow-2xl space-y-1.5 min-w-[150px]">
                          <p className="text-[10px] text-[var(--accent-ink)] font-bold border-b border-[var(--surface-border)] pb-1 flex items-center justify-between">
                            <span>⏰ {item.fullLabel}</span>
                          </p>
                          <div className="space-y-0.5 pt-0.5 text-[11px]">
                            {payload.map((entry, index) => (
                              <div key={index} className="flex items-center justify-between gap-3" style={{ color: entry.color }}>
                                <span className="text-[10px] text-[var(--text-muted)]">{entry.name}:</span>
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
