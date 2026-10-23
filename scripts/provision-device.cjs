// Trusted operator enrollment. Never accept an arbitrary device ID as proof of ownership.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
require('dotenv').config({ path: process.env.POLLINATOR_ENV_FILE || '.env', quiet: true });
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { PrismaClient } = require('@prisma/client');
const { encryptDeviceSecret } = require('../src/lib/telemetry/secrets.ts');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const deviceId = option('device'), beekeeperId = option('beekeeper');
if (!deviceId || !/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(deviceId) || !beekeeperId) throw new Error('Use --device ID --beekeeper DATABASE_ID [--rotate | --revoke] [--source simulated | device --physical-verified]');
const physical = option('source') === 'device';
if (option('source') && !['device','simulated'].includes(option('source'))) throw new Error('Unknown source');
if (physical && !args.includes('--physical-verified')) throw new Error('Verify the physical label, owner and key installation before selecting device source.');
const db = new PrismaClient();
(async () => {
  try {
    const keeper = await db.beekeeper.findUnique({ where: { id: beekeeperId } });
    if (!keeper) throw new Error('The beekeeper must already be enrolled');
    const previous = await db.hive.findUnique({ where: { deviceId }, include: { deviceCredential: true } });
    if (previous && previous.beekeeperId !== keeper.id) throw new Error('Ownership differs; transfer must be reviewed separately');
    if (args.includes('--revoke')) {
      if (!previous?.deviceCredential) throw new Error('No credential to revoke');
      await db.deviceCredential.update({ where: { hiveId: previous.id }, data: { active: false } });
      console.log('Device credential revoked. Existing readings remain attributed.'); return;
    }
    if (previous?.deviceCredential && !args.includes('--rotate')) throw new Error('Device already enrolled. Use --rotate explicitly to invalidate its old key and epoch.');
    const secret = randomBytes(32).toString('hex'), epoch = randomUUID();
    const source = physical ? 'DEVICE' : 'SIMULATED';
    const data = { epoch, source, active: true, encryptedSecret: encryptDeviceSecret(secret, deviceId + ':' + epoch) };
    await db.$transaction(async tx => {
      const hive = previous || await tx.hive.create({ data: { deviceId, beekeeperId: keeper.id, region: keeper.region } });
      await tx.deviceCredential.upsert({ where: { hiveId: hive.id }, create: { hiveId: hive.id, ...data }, update: data });
    }, { isolationLevel: 'Serializable' });
    const dir = path.resolve('.local-data/devices'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, deviceId + '.json'), JSON.stringify({ version: 1, deviceId, epoch, secret, source, nextSequence: 0 }, null, 2), { mode: 0o600 });
    console.log('Enrollment saved. Transfer the private .local-data/devices/' + deviceId + '.json credential over a trusted local channel; it was not printed.');
  } finally { await db.$disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
