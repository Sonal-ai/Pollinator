/**
 * Pollinator ESP32 IoT Microcontroller Simulator
 * 
 * Usage:
 *   node scripts/simulate-iot.js [preset]
 * 
 * Presets:
 *   healthy     - Optimal thermoregulation & steady nectar flow (Score: 100)
 *   heat        - Heat stress & high humidity (Score: ~55)
 *   swarm       - Sudden weight drop / swarm alarm (Score: ~50)
 *   chilled     - Low brood temp (Score: ~60)
 *   stream      - Continuously stream realistic packets every 5 seconds
 */

const PRESETS = {
  healthy: {
    hiveId: 'ESP32-001',
    deviceId: 'ESP32-001',
    temperatureC: 35.1,
    humidityPct: 57.5,
    weightKg: 47.4,
    batteryPct: 95,
  },
  heat: {
    hiveId: 'ESP32-001',
    deviceId: 'ESP32-001',
    temperatureC: 38.6,
    humidityPct: 76.0,
    weightKg: 46.1,
    batteryPct: 86,
  },
  swarm: {
    hiveId: 'ESP32-001',
    deviceId: 'ESP32-001',
    temperatureC: 34.9,
    humidityPct: 61.0,
    weightKg: 43.6, // Sudden drop of ~2.5kg
    batteryPct: 90,
  },
  chilled: {
    hiveId: 'ESP32-001',
    deviceId: 'ESP32-001',
    temperatureC: 30.2,
    humidityPct: 48.0,
    weightKg: 46.2,
    batteryPct: 89,
  },
};

const arg = (process.argv[2] || 'healthy').toLowerCase();

async function sendPacket(payload, label) {
  try {
    const res = await fetch('http://localhost:3000/api/sensor-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer pollinator-iot-device-secret',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`\n📡 [ESP32-001] Transmission OK (${label})`);
      console.log(`📊 Health Score: ${data.healthAssessment.score}% [${data.healthAssessment.status}]`);
      console.log(`🌡️  Temp: ${payload.temperatureC}°C (${data.healthAssessment.metrics.tempStatus})`);
      console.log(`💧 Humidity: ${payload.humidityPct}% (${data.healthAssessment.metrics.humidityStatus})`);
      console.log(`⚖️  Weight: ${payload.weightKg} kg (Delta: ${data.healthAssessment.metrics.weightDeltaKg} kg)`);
      if (data.healthAssessment.insights.length) {
        console.log(`💡 Insights:`, data.healthAssessment.insights);
      }
      if (data.healthAssessment.recommendations.length) {
        console.log(`⚡ Action:`, data.healthAssessment.recommendations);
      }
    } else {
      console.error('❌ Server returned error:', data);
    }
  } catch (err) {
    console.error('❌ Could not connect to http://localhost:3000:', err.message);
  }
}

async function main() {
  if (arg === 'stream') {
    console.log('🐝 Starting continuous ESP32 telemetry stream (Ctrl+C to stop)...\n');
    let currentWeight = 46.5;
    setInterval(async () => {
      // Small realistic random walk around optimal values
      const temp = Number((34.8 + Math.random() * 0.8).toFixed(1));
      const humidity = Number((54 + Math.random() * 8).toFixed(1));
      currentWeight = Number((currentWeight + (Math.random() * 0.1 - 0.03)).toFixed(2));
      const battery = Math.round(90 + Math.random() * 8);

      await sendPacket({
        hiveId: 'ESP32-001',
        deviceId: 'ESP32-001',
        temperatureC: temp,
        humidityPct: humidity,
        weightKg: currentWeight,
        batteryPct: battery,
      }, 'Streaming Telemetry');
    }, 2000);
  } else {
    const selected = PRESETS[arg] || PRESETS.healthy;
    await sendPacket(selected, `Preset: ${arg}`);
  }
}

main();
