import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { IotChartClient } from './chart-client';
import { Cpu, Wifi, Thermometer, Droplets, Scale, BatteryCharging } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function IoTPage() {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-cyan-400" />
            IoT Hive Telemetry Station
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time sensor arrays streaming from ESP32 edge nodes • {hives.length} active hive{hives.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>MQTT Broker: AWS Active</span>
        </div>
      </div>

      {hives.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-16 text-center text-slate-500 space-y-3 shadow-xl">
          <Wifi className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No Hive Microcontrollers Detected</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Flash an ESP32 with the Pollinator firmware and transmit telemetry over MQTT to start receiving real-time data.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hives.map((hive) => {
            const latest = hive.readings[0];
            return (
              <div
                key={hive.id}
                className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl overflow-hidden shadow-2xl space-y-4"
              >
                {/* Hive Header */}
                <div className="px-6 py-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        {hive.deviceId}
                      </span>
                      <span className="text-xs text-cyan-400 font-semibold">{hive.region ?? 'Wardha Cluster'}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Beekeeper: {hive.beekeeper?.name ?? 'KVIC Registered Farmer'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${latest ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-[10px] font-mono text-slate-400">{latest ? 'ONLINE' : 'OFFLINE'}</span>
                  </div>
                </div>

                {/* Sensor Gauges Grid */}
                {latest ? (
                  <div className="px-6 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <SensorBox
                        icon={<Thermometer className="w-4 h-4 text-amber-400" />}
                        label="Temperature"
                        value={latest.tempC !== null ? `${latest.tempC.toFixed(1)}°C` : '—'}
                        warn={latest.tempC !== null && latest.tempC > 37}
                      />
                      <SensorBox
                        icon={<Droplets className="w-4 h-4 text-cyan-400" />}
                        label="Humidity"
                        value={latest.humidityPct !== null ? `${latest.humidityPct.toFixed(0)}%` : '—'}
                        warn={latest.humidityPct !== null && latest.humidityPct > 75}
                      />
                      <SensorBox
                        icon={<Scale className="w-4 h-4 text-emerald-400" />}
                        label="Hive Weight"
                        value={latest.weightKg !== null ? `${latest.weightKg.toFixed(2)} kg` : '—'}
                      />
                      <SensorBox
                        icon={<BatteryCharging className="w-4 h-4 text-purple-400" />}
                        label="Battery"
                        value={latest.batteryPct !== null ? `${latest.batteryPct.toFixed(0)}%` : '—'}
                        warn={latest.batteryPct !== null && latest.batteryPct < 20}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono py-1 border-t border-white/5">
                      <span>Last Packet: {new Date(latest.timestamp).toLocaleTimeString('en-IN')}</span>
                      <span className="text-emerald-400">ESP32 Heartbeat OK</span>
                    </div>

                    {/* Chart Container */}
                    <div className="pt-2 pb-4">
                      <IotChartClient hiveId={hive.id} />
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center text-xs text-slate-500">
                    Awaiting initial sensor handshake packet...
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

function SensorBox({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={`p-3 rounded-2xl bg-black/40 border ${
      warn ? 'border-red-500/40 bg-red-950/20' : 'border-white/5'
    } space-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400">{icon}</span>
        {warn && <span className="text-[9px] font-mono text-red-400 font-bold uppercase">WARN</span>}
      </div>
      <p className={`text-sm font-extrabold font-mono ${warn ? 'text-red-400' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 truncate">{label}</p>
    </div>
  );
}
