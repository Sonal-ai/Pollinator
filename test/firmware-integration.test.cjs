const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { FirmwareDriver } = require('./helpers/firmware-driver.cjs');
require('dotenv').config({ path: '.env.integration', override: true, quiet: true });
const databaseUrl = new URL(process.env.DATABASE_URL || '');
if (databaseUrl.hostname !== '127.0.0.1' || databaseUrl.port !== '55432' || databaseUrl.pathname !== '/pollinator_integration') {
  throw new Error('Dedicated local integration database required');
}
const certificates = path.resolve('.local-data/clusters/qa-cluster-a/secrets');
process.env.APP_ORIGIN = 'https://firmware.example.test';
process.env.IOT_CREDENTIAL_KEY = randomBytes(32).toString('hex');
process.env.IOT_GATEWAY_MQTT_URL = 'mqtts://127.0.0.1:18883';
for (const [name, file] of [['CA', 'mqtt_ca.crt'], ['CERT', 'mqtt_gateway.crt'], ['KEY', 'mqtt_gateway.key']]) {
  process.env['IOT_GATEWAY_MQTT_' + name] = path.join(certificates, file);
}
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const mqtt = require('mqtt');
const { PrismaClient } = require('@prisma/client');
const { IDBFactory } = require('fake-indexeddb');
const { createGatewayHandler } = require('../src/lib/telemetry/gateway-handler.ts');
const { publishGatewayPacket } = require('../src/lib/telemetry/gateway-publisher.ts');
const { TelemetryService } = require('../src/lib/telemetry/service.ts');
const { installTelemetryHandler } = require('../src/lib/telemetry/mqtt-bridge.ts');
const { encryptDeviceSecret } = require('../src/lib/telemetry/secrets.ts');
const { LocalGatewayQueue } = require('../src/lib/telemetry/local-queue.ts');
const { syncPhoneQueue } = require('../src/lib/telemetry/phone-sync.ts');

test('shared C++ hive journal deletes only after phone queue, real TLS MQTT and PostgreSQL return its exact receipt', { timeout: 45000 }, async t => {
  const db = new PrismaClient(), driver = new FirmwareDriver();
  let bridge, queue;
  t.after(async () => {
    if (queue) queue.close();
    if (bridge) await bridge.endAsync(true);
    await driver.close();
    await db.$disconnect();
  });
  const deviceId = 'SIM-FW-IT-' + randomUUID().slice(0, 8).toUpperCase();
  const epoch = randomUUID(), secret = randomBytes(32).toString('hex');
  const keeper = await db.beekeeper.create({ data: { name: 'Synthetic C++ firmware integration', phone: '+996' + Date.now() } });
  const hive = await db.hive.create({ data: { deviceId, beekeeperId: keeper.id } });
  await db.deviceCredential.create({ data: { hiveId: hive.id, epoch, source: 'SIMULATED', encryptedSecret: encryptDeviceSecret(secret, deviceId + ':' + epoch) } });
  const identity = { accountId: 'firmware-it-' + randomUUID(), role: 'beekeeper', beekeeperId: keeper.id, walletAddress: '0x' + 'a'.repeat(40) };
  const post = statusOnly => createGatewayHandler({ db, session: async () => identity, statusOnly, publish: publishGatewayPacket });
  function request(envelope) {
    return new Request('https://firmware.example.test/api/iot/gateway', { method: 'POST', headers: {
      Origin: process.env.APP_ORIGIN, 'Content-Type': 'application/json', 'X-Gateway-Account': identity.accountId,
    }, body: JSON.stringify(envelope) });
  }
  assert.equal((await driver.call('boot')).error, 'UNPROVISIONED');
  assert.equal((await driver.call('provision', { identity: { version: 1, deviceId, epoch, secret, source: 'SIMULATED' } })).ok, true);
  assert.equal((await driver.call('capture', { metrics: { tempC: 35, weightKg: 42 }, observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') })).ok, true);
  const envelope = (await driver.call('next', { rewind: true })).frame;
  // Model reboot between BLE collection and network availability. The original bytes remain.
  assert.equal((await driver.call('crash')).pending, 1);
  assert.deepEqual((await driver.call('next', { rewind: true })).frame, envelope);
  queue = await LocalGatewayQueue.open(identity.accountId, new IDBFactory());
  await queue.put(envelope, deviceId);
  const accepted = await post(false)(request(envelope));
  assert.equal(accepted.status, 202);
  assert.equal((await accepted.json()).state, 'BROKER_ACCEPTED');
  assert.equal((await post(true)(request(envelope))).status, 202);
  assert.equal((await driver.call('ack', { receipt: { payload: 'uploaded', signature: 'saved' } })).ok, false);
  assert.equal((await driver.call('status')).pending, 1);
  assert.equal(await db.sensorReading.count({ where: { hiveId: hive.id } }), 0);
  bridge = mqtt.connect(process.env.IOT_GATEWAY_MQTT_URL, { manualConnect: true, reconnectPeriod: 0, connectTimeout: 5000, clean: true,
    clientId: 'fw-it-' + randomUUID(), rejectUnauthorized: true, ca: fs.readFileSync(path.join(certificates, 'mqtt_ca.crt')),
    cert: fs.readFileSync(path.join(certificates, 'mqtt_bridge.crt')), key: fs.readFileSync(path.join(certificates, 'mqtt_bridge.key')) });
  bridge.on('error', () => {});
  installTelemetryHandler(bridge, new TelemetryService(db), () => {}, () => {});
  const connected = new Promise((resolve, reject) => { bridge.once('connect', resolve); bridge.once('error', () => reject(new Error('QA TLS MQTT connection failed'))); });
  bridge.connect(); await connected;
  await bridge.subscribeAsync('honeychain/v1/devices/' + deviceId + '/telemetry', { qos: 1 });
  let receipt;
  const result = await syncPhoneQueue(queue, { deviceId, signal: new AbortController().signal,
    request: async (value, statusOnly) => { const response = await post(statusOnly)(request(value)); assert.ok([200, 202].includes(response.status)); return response.json(); },
    acknowledge: async (_record, value) => {
      assert.equal(await db.sensorReading.count({ where: { hiveId: hive.id } }), 1);
      assert.equal((await driver.call('status')).pending, 1);
      receipt = value;
      assert.equal((await driver.call('ack', { receipt })).pending, 0);
      return true;
    }, updated: async () => {}, delay: ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 300))),
  });
  assert.equal(result.receiptsSent, 1);
  assert.equal((await queue.list()).length, 0);
  assert.equal((await driver.call('crash')).pending, 0);
  assert.equal((await driver.call('ack', { receipt })).ok, true);
  const duplicate = await post(false)(request(envelope));
  assert.equal(duplicate.status, 200);
  assert.deepEqual((await duplicate.json()).receipt, receipt);
  const readings = await db.sensorReading.findMany({ where: { hiveId: hive.id } });
  assert.equal(readings.length, 1); assert.equal(readings[0].source, 'SIMULATED');
});
