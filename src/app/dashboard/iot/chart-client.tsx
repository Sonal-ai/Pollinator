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
    <div>
      {/* Period Selector */}
      <div className="flex gap-2 mb-3">
        {(['24h', '7d', '30d'] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`text-xs px-2 py-1 rounded-md ${period === p ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-400">No readings for this period</div>
      ) : (
        <>
          {/* Summary badges */}
          {summary && (
            <div className="flex gap-3 text-xs mb-3 flex-wrap">
              {summary.avgTempC !== null && (
                <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                  Avg Temp: {summary.avgTempC.toFixed(1)}°C
                </span>
              )}
              {summary.weightGainKg !== null && (
                <span className={`px-2 py-0.5 rounded ${summary.weightGainKg > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  Weight Δ: {summary.weightGainKg > 0 ? '+' : ''}{summary.weightGainKg.toFixed(2)} kg
                </span>
              )}
              <span className="bg-gray-50 text-gray-500 px-2 py-0.5 rounded">
                {summary.readingCount} readings
              </span>
            </div>
          )}

          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="Temp °C" stroke="#f97316" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Humidity %" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Weight kg" stroke="#10b981" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
