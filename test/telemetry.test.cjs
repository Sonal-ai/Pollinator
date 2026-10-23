require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { signPacket, verifyPacket, parsePacket, checkPacketTime } = require('../src/lib/telemetry/protocol.ts');
const { encryptDeviceSecret, decryptDeviceSecret } = require('../src/lib/telemetry/secrets.ts');
const { calculateHiveHealth } = require('../src/lib/iot-health-model.ts');
const { boundedBody } = require('../src/lib/request-body.ts');
const secret = 'ab'.repeat(32);
const packet = { version: 1, deviceId: 'SIM-UNIT', epoch: randomUUID(), sequence: 1, observedAt: new Date().toISOString(), metrics: { tempC: 35 } };

test('device signatures bind the exact bytes and key, without accepting a bearer secret', () => {
  const bytes = Buffer.from(JSON.stringify(packet)); const signature = signPacket(bytes, secret);
  assert.equal(verifyPacket(bytes, signature, secret), true);
  assert.equal(verifyPacket(Buffer.concat([bytes, Buffer.from(' ')]), signature, secret), false);
  assert.equal(verifyPacket(bytes, signature, 'cd'.repeat(32)), false);
  assert.equal(verifyPacket(bytes, 'Bearer pollinator-iot-device-secret', secret), false);
});
test('packet schema rejects absent metrics, aliases, invalid ranges and sequences', () => {
  for (const change of [{metrics:{}},{metrics:{tempC:999}},{sequence:-1},{sequence:2147483648},{hiveId:'OTHER'},{deviceId:'../OTHER'},{epoch:'old'}]) {
    assert.throws(() => parsePacket(Buffer.from(JSON.stringify({ ...packet, ...change }))));
  }
  assert.equal(parsePacket(Buffer.from(JSON.stringify(packet))).metrics.humidityPct, undefined);
  assert.throws(() => parsePacket(Buffer.alloc(4097)), error => error.status === 413);
});
test('offline window accepts out-of-order times but rejects excessive age and future clocks', () => {
  const now = new Date();
  checkPacketTime({ ...packet, observedAt: new Date(now - 6 * 86400000).toISOString() }, now);
  for (const offset of [-8 * 86400000, 6 * 60000]) assert.throws(() => checkPacketTime({ ...packet, observedAt: new Date(+now + offset).toISOString() }, now));
});
test('encrypted device secrets fail closed when ciphertext is moved to a different device or epoch', () => {
  process.env.IOT_CREDENTIAL_KEY = '12'.repeat(32);
  const encrypted = encryptDeviceSecret(secret, 'DEVICE:A');
  assert.equal(decryptDeviceSecret(encrypted, 'DEVICE:A'), secret);
  assert.throws(() => decryptDeviceSecret(encrypted, 'DEVICE:B'));
  assert.throws(() => decryptDeviceSecret(encrypted.slice(3), 'DEVICE:A'));
});
test('missing, stale and legacy observations never produce a healthy rules index', () => {
  const measured = { tempC:35, humidityPct:58, timestamp:new Date(), source:'DEVICE' };
  for (const change of [{tempC:null},{humidityPct:null},{timestamp:undefined},{timestamp:new Date(Date.now()-3600000)},{source:'LEGACY'}]) {
    const result = calculateHiveHealth({ ...measured, ...change });
    assert.equal(result.score, null); assert.equal(result.status, 'INSUFFICIENT_DATA');
  }
  const result = calculateHiveHealth({ ...measured, source:'SIMULATED', weightKg:20 });
  assert.equal(result.metrics.weightDeltaKg,null); assert.match(result.insights[0], /Synthetic/);
});
test('weight changes require measured values and a bounded observation interval', () => {
  const now = new Date(), base={tempC:35,humidityPct:58,weightKg:42,previousWeightKg:40,timestamp:now,source:'DEVICE'};
  assert.equal(calculateHiveHealth({...base,previousTimestamp:new Date(+now-3600000)}).metrics.weightDeltaKg,2);
  assert.equal(calculateHiveHealth({...base,previousTimestamp:new Date(+now-1000)}).metrics.weightDeltaKg,null);
  assert.equal(calculateHiveHealth({...base,previousTimestamp:new Date(+now-2*86400000)}).metrics.weightDeltaKg,null);
});
test('bounded ingestion rejects an oversized stream without trusting Content-Length', async () => {
  const request = new Request('http://localhost/api/sensor-data',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(4097));c.close();}}),duplex:'half'});
  await assert.rejects(boundedBody(request,4096), error=>error.status===413);
});
test('MQTT envelopes preserve signed bytes and cannot redirect a packet to another device topic', () => {
  const {decodeMqttPacket}=require('../src/lib/telemetry/mqtt-bridge.ts');
  const raw=Buffer.from(JSON.stringify(packet)), envelope=Buffer.from(JSON.stringify({payload:raw.toString('base64'),signature:signPacket(raw,secret)}));
  assert.deepEqual(decodeMqttPacket('honeychain/v1/devices/SIM-UNIT/telemetry',envelope).bytes,raw);
  assert.throws(()=>decodeMqttPacket('honeychain/v1/devices/OTHER/telemetry',envelope),error=>error.status===401);
  assert.throws(()=>decodeMqttPacket('honeychain/v1/devices/SIM-UNIT/telemetry',Buffer.alloc(8193)),error=>error.status===413);
});
