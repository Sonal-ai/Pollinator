require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHmac } = require('node:crypto');
const { createStoredReceipt, verifyStoredReceipt } = require('../src/lib/telemetry/acknowledgement.ts');
const { packetHash, signPacket } = require('../src/lib/telemetry/protocol.ts');
const { encryptDeviceSecret } = require('../src/lib/telemetry/secrets.ts');
const { TelemetryService } = require('../src/lib/telemetry/service.ts');
const secret = 'ab'.repeat(32);
const packet = { version: 1, deviceId: 'DEVICE-ACK', epoch: randomUUID(), sequence: 7,
  observedAt: new Date().toISOString(), metrics: { weightKg: 42 } };
const bytes = Buffer.from(JSON.stringify(packet));
const expected = { deviceId: packet.deviceId, epoch: packet.epoch, sequence: packet.sequence, packetHash: packetHash(bytes) };
const row = { id: 'reading-committed', packetHash: expected.packetHash, epoch: packet.epoch, sequence: packet.sequence };

test('a storage receipt authenticates exact bytes and the complete packet identity', () => {
  const receipt = createStoredReceipt(bytes, row, secret);
  assert.equal(verifyStoredReceipt(receipt, secret, expected), true);
  for (const change of [{ deviceId: 'DEVICE-OTHER' }, { epoch: randomUUID() }, { sequence: 8 }, { packetHash: '00'.repeat(32) }]) {
    assert.equal(verifyStoredReceipt(receipt, secret, { ...expected, ...change }), false);
  }
  assert.equal(verifyStoredReceipt(receipt, 'cd'.repeat(32), expected), false);
  assert.equal(verifyStoredReceipt({ ...receipt, payload: Buffer.concat([Buffer.from(receipt.payload, 'base64'), Buffer.from(' ')]).toString('base64') }, secret, expected), false);
});

test('a telemetry signature cannot serve as a storage receipt and the phone cannot forge success', () => {
  assert.equal(verifyStoredReceipt({ payload: bytes.toString('base64'), signature: signPacket(bytes, secret) }, secret, expected), false);
  const receipt = createStoredReceipt(bytes, row, secret);
  assert.equal(verifyStoredReceipt({ ...receipt, signature: signPacket(Buffer.from(receipt.payload, 'base64'), secret) }, secret, expected), false);
  assert.equal(verifyStoredReceipt({ ...receipt, signature: 'saved' }, secret, expected), false);
});

test('receipt creation refuses a row belonging to a different packet', () => {
  for (const change of [{ packetHash: null }, { epoch: randomUUID() }, { sequence: 8 }]) {
    assert.throws(() => createStoredReceipt(bytes, { ...row, ...change }, secret), error => error.status === 503);
  }
});

test('authenticated malformed receipt schemas and noncanonical base64 still fail closed', () => {
  const receipt = createStoredReceipt(bytes, row, secret);
  assert.equal(verifyStoredReceipt({ ...receipt, payload: receipt.payload + '\n' }, secret, expected), false);
  for (const change of [{ kind: 'queued' }, { version: 2 }, { surprise: true }, { readingId: '' }]) {
    const raw = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(receipt.payload, 'base64')), ...change }));
    const signature = createHmac('sha256', Buffer.from(secret, 'hex')).update('honey-chain-stored-v1\n').update(raw).digest('hex');
    assert.equal(verifyStoredReceipt({ payload: raw.toString('base64'), signature }, secret, expected), false);
  }
});

function fakeDatabase(transaction) {
  process.env.IOT_CREDENTIAL_KEY = '12'.repeat(32);
  const credential = { id: 'credential', hiveId: 'hive', epoch: packet.epoch, active: true, source: 'DEVICE',
    updatedAt: new Date(), encryptedSecret: encryptDeviceSecret(secret, `${packet.deviceId}:${packet.epoch}`), hive: {} };
  return { credential, db: {
    deviceCredential: { findFirst: async () => credential },
    sensorReading: { findUnique: async () => null },
    $transaction: transaction,
  } };
}

test('ingestion cannot return a receipt before the transaction commits', async () => {
  let commit;
  const gate = new Promise(resolve => { commit = resolve; });
  const { db, credential } = fakeDatabase(async fn => {
    const result = await fn({ deviceCredential: { findFirst: async () => credential }, sensorReading: { create: async () => row } });
    await gate;
    return result;
  });
  let returned = false;
  const operation = new TelemetryService(db).ingest(bytes, signPacket(bytes, secret)).then(result => { returned = true; return result; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(returned, false);
  commit();
  const result = await operation;
  assert.equal(verifyStoredReceipt(result.receipt, secret, expected), true);
  assert.equal(result.duplicate, false);
});

test('failed storage emits no receipt while identical committed retries return the same receipt', async () => {
  const { db } = fakeDatabase(async () => { throw new Error('storage failed'); });
  await assert.rejects(new TelemetryService(db).ingest(bytes, signPacket(bytes, secret)), /storage failed/);
  db.sensorReading.findUnique = async () => row;
  const result = await new TelemetryService(db).ingest(bytes, signPacket(bytes, secret));
  assert.equal(result.duplicate, true);
  assert.deepEqual(result.receipt, createStoredReceipt(bytes, row, secret));
});
