import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { IotChartClient } from './chart-client';

export const dynamic = 'force-dynamic';

export default async function IoTPage() {
  // Get beekeeper from session
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('pollinator_session');
  let beekeeperId: string | null = null;
  let session: { walletAddress?: string; role?: string } | null = null;

  if (sessionCookie) {
    try {
      session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
      if (session?.walletAddress) {
        const bk = await prisma.beekeeper.findFirst({ where: { wallet: session.walletAddress } });
        beekeeperId = bk?.id ?? null;
      }
    } catch { /* session parse failed */ }
  }

  const isAdmin = session?.role === 'admin';
  
  // Admin sees all hives; beekeeper sees their own. If beekeeperId is null and not admin, fetch none.
  const whereClause = isAdmin ? undefined : (beekeeperId ? { beekeeperId } : { id: 'none' });

  const hives = await prisma.hive.findMany({
    where: whereClause,
    include: {
      beekeeper: { select: { name: true } },
      readings: {
        orderBy: { timestamp: 'desc' },
        take: 1,
        select: { tempC: true, humidityPct: true, weightKg: true, batteryPct: true, timestamp: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📡 IoT Hive Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{hives.length} hive{hives.length !== 1 ? 's' : ''} registered</p>
      </div>

      {hives.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-sm">No hives registered yet.</p>
          <p className="text-xs mt-1">Connect your ESP32 device and register a hive to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hives.map((hive) => {
            const latest = hive.readings[0];
            return (
              <div key={hive.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Hive Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{hive.deviceId}</p>
                    <p className="text-xs text-gray-400">{hive.beekeeper?.name} · {hive.region ?? 'Unknown region'}</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${latest ? 'bg-green-400' : 'bg-gray-300'}`} title={latest ? 'Data received' : 'No data'} />
                </div>

                {/* Latest Readings */}
                {latest ? (
                  <>
                    <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-gray-50">
                      <SensorCard icon="🌡️" label="Temperature" value={latest.tempC !== null ? `${latest.tempC.toFixed(1)}°C` : '—'} warn={latest.tempC !== null && latest.tempC > 37} />
                      <SensorCard icon="💧" label="Humidity" value={latest.humidityPct !== null ? `${latest.humidityPct.toFixed(0)}%` : '—'} warn={latest.humidityPct !== null && latest.humidityPct > 75} />
                      <SensorCard icon="⚖️" label="Weight" value={latest.weightKg !== null ? `${latest.weightKg.toFixed(2)} kg` : '—'} />
                      <SensorCard icon="🔋" label="Battery" value={latest.batteryPct !== null ? `${latest.batteryPct.toFixed(0)}%` : '—'} warn={latest.batteryPct !== null && latest.batteryPct < 20} />
                    </div>
                    <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                      Last update: {new Date(latest.timestamp).toLocaleString('en-IN')}
                    </div>
                    {/* Chart loaded client-side to avoid SSR issues with recharts */}
                    <div className="px-5 py-4">
                      <IotChartClient hiveId={hive.id} />
                    </div>
                  </>
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    No sensor data yet
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SensorCard({ icon, label, value, warn }: { icon: string; label: string; value: string; warn?: boolean }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xl mb-1">{icon}</p>
      <p className={`text-lg font-bold ${warn ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      {warn && <p className="text-xs text-red-500 mt-0.5">⚠ Elevated</p>}
    </div>
  );
}
