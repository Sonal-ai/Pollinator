// Versioned engineering rules. These are configurable inspection prompts, not disease diagnoses.
export interface HiveTelemetry {
  tempC?: number | null; humidityPct?: number | null; weightKg?: number | null;
  batteryPct?: number | null; previousWeightKg?: number | null;
  timestamp?: Date | string; previousTimestamp?: Date | string; source?: string;
}
export interface HiveHealthAssessment {
  ruleVersion: string; score: number | null;
  status: 'WITHIN_RANGE' | 'ATTENTION' | 'INSPECT' | 'INSUFFICIENT_DATA'; statusColor: string;
  metrics: { tempScore: number | null; tempStatus: string; humidityScore: number | null; humidityStatus: string; weightDeltaKg: number | null; weightStatus: string };
  insights: string[]; recommendations: string[];
}
export function calculateHiveHealth(t: HiveTelemetry, now = new Date()): HiveHealthAssessment {
  const currentTime = t.timestamp ? new Date(t.timestamp).getTime() : NaN;
  const age = now.getTime() - currentTime;
  const usable = Number.isFinite(t.tempC) && Number.isFinite(t.humidityPct) && Number.isFinite(age) && age >= -300000 && age <= 1800000 && ['DEVICE','SIMULATED'].includes(t.source || '');
  const tempStatus = t.tempC == null ? 'MISSING' : t.tempC < 34 ? 'BELOW_CONFIGURED_BAND' : t.tempC > 36 ? 'ABOVE_CONFIGURED_BAND' : 'IN_CONFIGURED_BAND';
  const humidityStatus = t.humidityPct == null ? 'MISSING' : t.humidityPct < 50 ? 'BELOW_CONFIGURED_BAND' : t.humidityPct > 65 ? 'ABOVE_CONFIGURED_BAND' : 'IN_CONFIGURED_BAND';
  const previousTime = t.previousTimestamp ? new Date(t.previousTimestamp).getTime() : NaN;
  const interval = currentTime - previousTime;
  const delta = Number.isFinite(t.weightKg) && Number.isFinite(t.previousWeightKg) && interval >= 60000 && interval <= 86400000
    ? Number((t.weightKg! - t.previousWeightKg!).toFixed(2)) : null;
  const tempScore = t.tempC == null ? null : tempStatus === 'IN_CONFIGURED_BAND' ? 100 : Math.max(0, 100 - Math.abs(t.tempC - 35) * 15);
  const humidityScore = t.humidityPct == null ? null : humidityStatus === 'IN_CONFIGURED_BAND' ? 100 : Math.max(0, 100 - Math.abs(t.humidityPct - 57.5) * 2);
  const score = usable ? Math.round(tempScore! * 0.6 + humidityScore! * 0.4) : null;
  const status = score == null ? 'INSUFFICIENT_DATA' : score < 50 ? 'INSPECT' : score < 85 ? 'ATTENTION' : 'WITHIN_RANGE';
  const insights = score == null ? ['Fresh, attributed temperature and humidity readings are required. Missing or stale data is not a healthy result.']
    : ['Sensor readings were compared with prototype configuration bands. This does not establish colony health, disease or nectar flow.'];
  if (delta != null) insights.push('Observed weight change: ' + delta + ' kg over ' + Math.round(interval / 60000) + ' minutes. Harvests, rain and handling can change scale weight.');
  if (t.source === 'SIMULATED') insights.unshift('Synthetic readings: demonstration only.');
  return { ruleVersion: 'inspection-rules-v2', score, status, statusColor: score == null ? '#94a3b8' : score < 50 ? '#ef4444' : score < 85 ? '#f59e0b' : '#10b981',
    metrics: { tempScore, tempStatus, humidityScore, humidityStatus, weightDeltaKg: delta, weightStatus: delta == null ? 'INSUFFICIENT_COMPARABLE_DATA' : 'OBSERVED_CHANGE' },
    insights, recommendations: score == null ? ['Check device enrollment, placement, clock, connectivity and sensor calibration.'] : status === 'WITHIN_RANGE' ? [] : ['Check sensor placement and calibration, then inspect the hive with a trained beekeeper. Sensor rules do not prescribe treatment.'] };
}
