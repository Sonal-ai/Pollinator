// ============================================================
// Pollinator IoT Hive Health & Diagnostic Intelligence Model
// Evaluates Brood Thermoregulation, Humidity Equilibrium & Nectar Weight
// ============================================================

export interface HiveTelemetry {
  tempC: number;
  humidityPct: number;
  weightKg: number;
  batteryPct?: number | null;
  previousWeightKg?: number | null;
}

export interface HiveHealthAssessment {
  score: number; // 0 to 100
  status: 'OPTIMAL' | 'MODERATE_STRESS' | 'HIGH_RISK' | 'CRITICAL';
  statusColor: string;
  metrics: {
    tempScore: number;
    tempStatus: 'OPTIMAL' | 'CHILLED' | 'OVERHEATED' | 'CRITICAL_COLD';
    humidityScore: number;
    humidityStatus: 'OPTIMAL' | 'TOO_DRY' | 'DAMP_FUNGAL_RISK';
    weightDeltaKg: number;
    weightStatus: 'STEADY' | 'ACTIVE_NECTAR_FLOW' | 'RAPID_WEIGHT_LOSS_SWARM';
  };
  insights: string[];
  recommendations: string[];
}

/**
 * Evaluates raw sensor data against biological apiculture thresholds.
 * Honeybee brood nests naturally regulate at 34.5°C - 35.5°C and 50% - 65% RH.
 */
export function calculateHiveHealth(telemetry: HiveTelemetry): HiveHealthAssessment {
  const { tempC, humidityPct, weightKg, previousWeightKg } = telemetry;

  // 1. Thermoregulation Scoring (Weight: 45%)
  let tempScore = 100;
  let tempStatus: 'OPTIMAL' | 'CHILLED' | 'OVERHEATED' | 'CRITICAL_COLD' = 'OPTIMAL';

  if (tempC >= 34.0 && tempC <= 36.0) {
    tempScore = 100;
    tempStatus = 'OPTIMAL';
  } else if (tempC > 36.0 && tempC <= 38.0) {
    tempScore = Math.max(40, 100 - (tempC - 36.0) * 25);
    tempStatus = 'OVERHEATED';
  } else if (tempC >= 31.0 && tempC < 34.0) {
    tempScore = Math.max(40, 100 - (34.0 - tempC) * 18);
    tempStatus = 'CHILLED';
  } else if (tempC < 31.0) {
    tempScore = Math.max(10, 40 - (31.0 - tempC) * 10);
    tempStatus = 'CRITICAL_COLD';
  } else {
    tempScore = 20;
    tempStatus = 'OVERHEATED';
  }

  // 2. Humidity Equilibrium Scoring (Weight: 30%)
  let humidityScore = 100;
  let humidityStatus: 'OPTIMAL' | 'TOO_DRY' | 'DAMP_FUNGAL_RISK' = 'OPTIMAL';

  if (humidityPct >= 50 && humidityPct <= 65) {
    humidityScore = 100;
    humidityStatus = 'OPTIMAL';
  } else if (humidityPct > 65) {
    humidityScore = Math.max(25, 100 - (humidityPct - 65) * 2.5);
    humidityStatus = 'DAMP_FUNGAL_RISK';
  } else {
    humidityScore = Math.max(30, 100 - (50 - humidityPct) * 2.5);
    humidityStatus = 'TOO_DRY';
  }

  // 3. Weight Stability & Nectar Dynamics (Weight: 25%)
  const prevWeight = previousWeightKg ?? weightKg;
  const weightDeltaKg = Number((weightKg - prevWeight).toFixed(2));
  let weightScore = 95;
  let weightStatus: 'STEADY' | 'ACTIVE_NECTAR_FLOW' | 'RAPID_WEIGHT_LOSS_SWARM' = 'STEADY';

  if (weightDeltaKg < -1.5) {
    weightScore = 30;
    weightStatus = 'RAPID_WEIGHT_LOSS_SWARM';
  } else if (weightDeltaKg > 0.4) {
    weightScore = 100;
    weightStatus = 'ACTIVE_NECTAR_FLOW';
  } else {
    weightScore = 95;
    weightStatus = 'STEADY';
  }

  // Composite Score
  const compositeScore = Math.round(
    tempScore * 0.45 + humidityScore * 0.3 + weightScore * 0.25
  );

  let status: 'OPTIMAL' | 'MODERATE_STRESS' | 'HIGH_RISK' | 'CRITICAL' = 'OPTIMAL';
  let statusColor = '#10b981';

  if (compositeScore >= 85) {
    status = 'OPTIMAL';
    statusColor = '#10b981';
  } else if (compositeScore >= 70) {
    status = 'MODERATE_STRESS';
    statusColor = '#f59e0b';
  } else if (compositeScore >= 50) {
    status = 'HIGH_RISK';
    statusColor = '#f97316';
  } else {
    status = 'CRITICAL';
    statusColor = '#ef4444';
  }

  const insights: string[] = [];
  const recommendations: string[] = [];

  if (tempStatus === 'OPTIMAL') {
    insights.push('Optimal brood thermoregulation (34.5°C - 35.5°C). Strong nurse bee population.');
  } else if (tempStatus === 'OVERHEATED') {
    insights.push('Elevated internal temperature. Risk of comb melting or excessive fanning fatigue.');
    recommendations.push('Provide afternoon shade or open top ventilation.');
  } else if (tempStatus === 'CHILLED') {
    insights.push('Brood nest chilled below 34°C. Elevated risk of pupal mortality.');
    recommendations.push('Reduce entrance reducer size and inspect cluster density.');
  } else {
    insights.push('Severe low temperature. Potential colony absconding or freezing risk.');
    recommendations.push('Urgent manual hive inspection needed.');
  }

  if (humidityStatus === 'DAMP_FUNGAL_RISK') {
    insights.push('High moisture levels (>65%). High condensation risk favorable to Chalkbrood.');
    recommendations.push('Elevate bottom board and verify upper ventilation quilt.');
  } else if (humidityStatus === 'TOO_DRY') {
    insights.push('Low relative humidity (<50%). Uncapped brood susceptible to desiccation.');
    recommendations.push('Place clean water source near apiary.');
  }

  if (weightStatus === 'RAPID_WEIGHT_LOSS_SWARM') {
    insights.push(`Sudden weight drop of ${Math.abs(weightDeltaKg)} kg detected. Swarm departure suspected.`);
    recommendations.push('Scan nearby branches for swarms and check for emergency queen cells.');
  } else if (weightStatus === 'ACTIVE_NECTAR_FLOW') {
    insights.push(`Consistent weight gain (+${weightDeltaKg} kg) indicating active local nectar flow.`);
    recommendations.push('Ensure sufficient super space to prevent honey-bound broodnest.');
  }

  return {
    score: compositeScore,
    status,
    statusColor,
    metrics: {
      tempScore: Math.round(tempScore),
      tempStatus,
      humidityScore: Math.round(humidityScore),
      humidityStatus,
      weightDeltaKg,
      weightStatus,
    },
    insights,
    recommendations,
  };
}
