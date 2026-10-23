import { requireSession } from '@/lib/auth';
import { hiveScope } from '@/lib/access-policy';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { IotChartClient } from './chart-client';
import { IotSimulatorModal } from './simulator-modal';
import { PhoneGateway } from './phone-gateway';
import { calculateHiveHealth } from '@/lib/iot-health-model';
import { Cpu, Wifi, Thermometer, Droplets, Scale, BatteryCharging, Sparkles, Bug, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function loadHiveSnapshot(whereClause: Prisma.HiveWhereInput) {
  const hives = await prisma.hive.findMany({
    where: whereClause,
    include: {
      beekeeper: { select: { name: true } },
      deviceCredential: { select: { source: true, active: true } },
      inferences: {
        orderBy: { inferredAt: 'desc' },
        take: 1,
      },
      readings: {
        orderBy: { timestamp: 'desc' },
        take: 2,
        select: { tempC: true, humidityPct: true, weightKg: true, batteryPct: true, timestamp: true, source: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return { hives, checkedAt: Date.now() };
}

export default async function IoTPage() {
  const session = await requireSession(['admin', 'beekeeper']);
  const { hives, checkedAt } = await loadHiveSnapshot(hiveScope(session));
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-cyan-400" />
            IoT Hive Telemetry Station
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Stored sensor readings • {hives.length} registered hive{hives.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <IotSimulatorModal devices={hives.filter(hive => hive.deviceCredential?.active && hive.deviceCredential.source === 'SIMULATED').map(hive => hive.deviceId)} />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Connection status not monitored</span>
          </div>
        </div>
      </div>

      <PhoneGateway key={session.accountId} accountId={session.accountId} devices={hives.filter(hive => hive.deviceCredential?.active && hive.deviceCredential.source !== 'LEGACY')
        .map(hive => ({ deviceId: hive.deviceId, source: hive.deviceCredential!.source }))} />

      {hives.length === 0 ? (
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl p-16 text-center text-[var(--text-muted)] space-y-3 shadow-xl">
          <Wifi className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
          <h3 className="text-base font-bold text-foreground">No Hive Microcontrollers Detected</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            A trusted operator must verify ownership and enroll a device credential before readings can be accepted.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hives.map((hive) => {
            const latest = hive.readings[0];
            const previous = hive.readings[1];
            const health = latest && latest.tempC !== null && latest.humidityPct !== null && latest.weightKg !== null
              ? calculateHiveHealth({
                  tempC: latest.tempC,
                  humidityPct: latest.humidityPct,
                  weightKg: latest.weightKg,
                  batteryPct: latest.batteryPct,
                  previousWeightKg: previous?.source === latest.source ? previous.weightKg : null,
                  timestamp: latest.timestamp, previousTimestamp: previous?.timestamp, source: latest.source,
                })
              : null;

            return (
              <div
                key={hive.id}
                className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl overflow-hidden shadow-2xl space-y-4"
              >
                {/* Hive Header */}
                <div className="px-6 py-4 border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground bg-[var(--surface-subtle)] px-2 py-0.5 rounded border border-[var(--surface-border)]">
                        {hive.deviceId}
                      </span>
                      <span className="text-xs text-cyan-400 font-semibold">{hive.region ?? 'Region not recorded'}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Beekeeper: {hive.beekeeper?.name ?? 'Name not recorded'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {health && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-subtle)]">
                        <span
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: health.statusColor }}
                        />
                        <span className="text-xs font-extrabold font-mono" style={{ color: health.statusColor }}>
                          {health.score ?? '—'}/100
                        </span>
                        <span className="text-[10px] uppercase font-mono text-foreground">
                          {health.status.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${latest && latest.source === 'DEVICE' && checkedAt - latest.timestamp.getTime() <= 1800000 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">{latest ? latest.source + (checkedAt - latest.timestamp.getTime() > 1800000 ? ' · STALE' : ' · RECENT') : 'NO DATA'}</span>
                    </div>
                  </div>
                </div>

                {/* Sensor Gauges Grid */}
                {latest ? (
                  <div className="px-6 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <SensorBox
                        icon={<Thermometer className="w-4 h-4 text-[var(--accent-ink)]" />}
                        label="Temperature"
                        value={latest.tempC !== null ? `${latest.tempC.toFixed(1)}°C` : '—'}
                        warn={latest.tempC !== null && (latest.tempC > 37 || latest.tempC < 33)}
                      />
                      <SensorBox
                        icon={<Droplets className="w-4 h-4 text-cyan-400" />}
                        label="Humidity"
                        value={latest.humidityPct !== null ? `${latest.humidityPct.toFixed(0)}%` : '—'}
                        warn={latest.humidityPct !== null && (latest.humidityPct > 70 || latest.humidityPct < 45)}
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

                    {/* AI Bio-Apiculture Health & Diagnostics Card */}
                    {health && (
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-black/60 border border-[var(--surface-border)] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[var(--accent-ink)]" />
                            <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                              Prototype inspection rules
                            </span>
                          </div>
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase"
                            style={{
                              backgroundColor: `${health.statusColor}20`,
                              color: health.statusColor,
                              border: `1px solid ${health.statusColor}40`,
                            }}
                          >
                            Rules index: {health.score ?? '—'}/100 • {health.metrics.tempStatus}
                          </span>
                        </div>

                        {/* Insights & Recommendations */}
                        {health.insights.length > 0 && (
                          <div className="space-y-1">
                            {health.insights.map((insight, idx) => (
                              <p key={idx} className="text-xs text-foreground flex items-start gap-2">
                                <span className="text-emerald-400 text-sm leading-none">•</span>
                                <span>{insight}</span>
                              </p>
                            ))}
                          </div>
                        )}

                        {health.recommendations.length > 0 && (
                          <div className="pt-1 border-t border-[var(--surface-border)] space-y-1">
                            {health.recommendations.map((rec, idx) => (
                              <p key={idx} className="text-[11px] text-[var(--accent-ink)]/90 flex items-start gap-2">
                                <span className="font-bold">⚡ Action:</span>
                                <span>{rec}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Latest Varroa Mite Scan Result */}
                    {hive.inferences?.[0] && (
                      <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Bug className="w-4 h-4 text-[var(--accent-ink)] shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-foreground">Latest Varroa AI Scan</p>
                            <p className="text-[10px] text-[var(--text-muted)] font-mono">
                              {new Date(hive.inferences[0].inferredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • Model {hive.inferences[0].modelVersion}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase border ${
                              hive.inferences[0].prediction === 'varroa_parasite_suspected'
                                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                                : 'bg-slate-500/15 border-slate-500/30 text-[var(--text-muted)]'
                            }`}
                          >
                            {hive.inferences[0].prediction === 'varroa_parasite_suspected' ? 'Varroa suspected · inspect' : 'Image result · review limits'}
                          </span>
                          <Link href="/dashboard/health" className="p-1.5 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-foreground transition-colors">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono py-1 border-t border-[var(--surface-border)]">
                      <span>Last Packet: {new Date(latest.timestamp).toLocaleTimeString('en-IN')}</span>
                      <span className="text-[var(--text-muted)]">{latest.source} • {checkedAt - latest.timestamp.getTime() > 1800000 ? 'Reading stale' : 'Recent reading'}</span>
                    </div>

                    {/* Chart Container */}
                    <div className="pt-2 pb-4">
                      <IotChartClient hiveId={hive.id} initialSource={latest.source} />
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center text-xs text-[var(--text-muted)]">
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
    <div className={`p-3 rounded-2xl bg-[var(--surface-subtle)] border ${
      warn ? 'border-red-500/40 bg-red-950/20' : 'border-[var(--surface-border)]'
    } space-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-muted)]">{icon}</span>
        {warn && <span className="text-[9px] font-mono text-red-400 font-bold uppercase">WARN</span>}
      </div>
      <p className={`text-sm font-extrabold font-mono ${warn ? 'text-red-400' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-[var(--text-muted)] truncate">{label}</p>
    </div>
  );
}
