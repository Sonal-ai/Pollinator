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
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
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

  const chartData = data.map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    'Temp °C': r.tempC,
    'Humidity %': r.humidityPct,
    'Weight kg': r.weightKg,
  }));

  return (
    <div className="space-y-3">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0c0e14',
                    borderColor: 'rgba(255, 210, 30, 0.3)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#fff',
                    fontFamily: 'monospace',
                  }}
                />
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
