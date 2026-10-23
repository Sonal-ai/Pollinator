const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ path: '.env.integration', override: true, quiet: true });
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/lib/password.ts');
const url = new URL(process.env.DATABASE_URL || '');
if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/pollinator_integration') throw new Error('Local demo fixtures require the dedicated integration database.');
const db = new PrismaClient();
const manifest = JSON.parse(fs.readFileSync('.local-data/integration-chain.json'));
const file = '.local-data/local-demo-accounts.json';
const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
(async () => {
  const result = {};
  try {
    for (const role of ['beekeeper','processor','lab','distributor','retailer','admin']) {
      const walletAddress = role === 'admin' ? manifest.admin : manifest.actors[role];
      const identifier = 'local-demo-' + role + '@example.test';
      const password = previous[role]?.password || randomBytes(18).toString('base64url');
      let beekeeperId = null;
      if (role === 'beekeeper') beekeeperId = (await db.beekeeper.upsert({ where: { phone: '+999000000001' }, create: { phone: '+999000000001', name: 'Local demo producer', region: 'Local prototype', wallet: walletAddress }, update: { wallet: walletAddress } })).id;
      const passwordHash = await hashPassword(password);
      await db.dashboardAccount.upsert({ where: { identifier }, create: { identifier, role, walletAddress, beekeeperId, passwordHash }, update: { role, walletAddress, beekeeperId, passwordHash, active: true, sessionVersion: { increment: 1 } } });
      result[role] = { identifier, password, walletAddress, beekeeperId };
    }
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    const config = require('dotenv').parse(fs.readFileSync('.env.integration'));
    config.LOCAL_TEST_SIGNING = 'true';
    config.APP_ORIGIN = 'http://127.0.0.1:3100';
    config.DEPLOYMENT_ADMIN_ADDRESS = manifest.admin;
    if (!config.ADMIN_API_KEY || /^(change_me|your_|placeholder)/i.test(config.ADMIN_API_KEY)) config.ADMIN_API_KEY = randomBytes(32).toString('hex');
    if (!config.IOT_CREDENTIAL_KEY) config.IOT_CREDENTIAL_KEY = randomBytes(32).toString('hex');
    process.env.IOT_CREDENTIAL_KEY = config.IOT_CREDENTIAL_KEY;
    fs.writeFileSync('.env.integration', Object.entries(config).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n');
    const { encryptDeviceSecret } = require('../src/lib/telemetry/secrets.ts');
    const deviceId = 'SIM-DEMO-001';
    const hive = await db.hive.upsert({ where: { deviceId }, create: { deviceId, beekeeperId: result.beekeeper.beekeeperId, region: 'Synthetic local fixture' }, update: {} });
    if (hive.beekeeperId !== result.beekeeper.beekeeperId) throw new Error('Demo device ownership conflict');
    if (!await db.deviceCredential.findUnique({ where: { hiveId: hive.id } })) {
      const epoch = require('node:crypto').randomUUID(), secret = randomBytes(32).toString('hex');
      await db.deviceCredential.create({ data: { hiveId: hive.id, epoch, source: 'SIMULATED', encryptedSecret: encryptDeviceSecret(secret, deviceId + ':' + epoch) } });
      fs.mkdirSync('.local-data/devices', { recursive: true });
      fs.writeFileSync('.local-data/devices/' + deviceId + '.json', JSON.stringify({ version: 1, deviceId, epoch, secret, source: 'SIMULATED', nextSequence: 0 }, null, 2));
    }
    fs.writeFileSync('.env.integration', Object.entries(config).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n');
    console.log('Created isolated local demo accounts. Their generated passwords remain in .local-data/local-demo-accounts.json; fixture signing is development-only.');
  } finally { await db.$disconnect(); }
})().catch(() => { console.error('Local demo setup failed; existing non-demo account data was not reset.'); process.exitCode = 1; });
