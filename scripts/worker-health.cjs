const fs = require('node:fs');
try {
  const state = JSON.parse(fs.readFileSync(process.env.WORKER_HEARTBEAT_FILE || '/run/honeychain/heartbeat.json', 'utf8'));
  const age = Date.now() - Date.parse(state.updatedAt);
  const maximum = Number(process.env.WORKER_HEARTBEAT_MAX_AGE_MS || 90000);
  if (!Number.isFinite(maximum) || maximum < 10000 || maximum > 180000 || state.ready !== true || !Number.isFinite(age) || age < -5000 || age > maximum) process.exitCode = 1;
} catch { process.exitCode = 1; }
