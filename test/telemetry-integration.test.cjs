const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
require('dotenv').config({ path: '.env.integration', override: true, quiet: true });
const url = new URL(process.env.DATABASE_URL || '');
if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/pollinator_integration') throw new Error('Tests require the isolated integration database');
process.env.IOT_CREDENTIAL_KEY = randomBytes(32).toString('hex');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { PrismaClient } = require('@prisma/client');
const { TelemetryService } = require('../src/lib/telemetry/service.ts');
const { encryptDeviceSecret } = require('../src/lib/telemetry/secrets.ts');
const { signPacket, packetHash } = require('../src/lib/telemetry/protocol.ts');
const { verifyStoredReceipt } = require('../src/lib/telemetry/acknowledgement.ts');
const db = new PrismaClient(), service = new TelemetryService(db);
const secret = randomBytes(32).toString('hex'), epoch = randomUUID(), deviceId = 'SIM-IT-' + randomUUID().slice(0,8).toUpperCase();
let hive, credential;
before(async () => {
  const keeper = await db.beekeeper.create({data:{phone:'+999'+String(Date.now()),name:'Synthetic telemetry integration'}});
  hive = await db.hive.create({data:{deviceId,beekeeperId:keeper.id}});
  credential = await db.deviceCredential.create({data:{hiveId:hive.id,epoch,source:'SIMULATED',encryptedSecret:encryptDeviceSecret(secret,deviceId+':'+epoch)}});
});
after(async()=>{await db.$disconnect();});
function bytes(sequence,change={}) { return Buffer.from(JSON.stringify({version:1,deviceId,epoch,sequence,observedAt:new Date().toISOString(),metrics:{tempC:35},...change})); }
function ingest(raw, key=secret) { return service.ingest(raw,signPacket(raw,key)); }
test('real storage preserves partial measurements, provenance and idempotent acknowledgement', async()=>{
  const raw=bytes(1);const first=await ingest(raw),again=await ingest(raw);
  assert.equal(first.duplicate,false);assert.equal(again.duplicate,true);assert.equal(first.reading.id,again.reading.id);
  assert.equal(first.reading.source,'SIMULATED');assert.equal(first.reading.humidityPct,null);
  const identity={deviceId,epoch,sequence:1,packetHash:packetHash(raw)};
  assert.equal(verifyStoredReceipt(first.receipt,secret,identity),true);
  assert.deepEqual(again.receipt,first.receipt);
  assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:1}}),1);
  await assert.rejects(ingest(bytes(1,{metrics:{tempC:36}})),error=>error.status===409);
});
test('wrong key, wrong device and old epochs cannot insert a reading',async()=>{
  await assert.rejects(ingest(bytes(2),'ff'.repeat(32)),error=>error.status===401);
  await assert.rejects(ingest(bytes(2,{deviceId:'NOT-ENROLLED'})),error=>error.status===401);
  await assert.rejects(ingest(bytes(2,{epoch:randomUUID()})),error=>error.status===401);
  assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:2}}),0);
});
test('offline out-of-order packets are retained once and sorted by observation time',async()=>{
  const earlier=new Date(Date.now()-86400000).toISOString();
  await ingest(bytes(10));await ingest(bytes(5,{observedAt:earlier}));
  const row=await db.sensorReading.findFirst({where:{hiveId:hive.id,sequence:5}});assert.equal(row.timestamp.toISOString(),earlier);
  for(const time of [Date.now()-8*86400000,Date.now()+600000]) await assert.rejects(ingest(bytes(20,{observedAt:new Date(time).toISOString()})),error=>error.status===422);
});
test('concurrent duplicate deliveries commit one reading',async()=>{
  const raw=bytes(100),results=await Promise.all(Array.from({length:6},()=>ingest(raw)));
  assert.equal(new Set(results.map(row=>row.reading.id)).size,1);
  assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:100}}),1);
});
test('actual MQTT QoS-1 delivery acknowledges only after database commit and redelivers after a storage failure', {timeout:60000}, async(context)=>{
  const net=require('node:net'), mqtt=require('mqtt'), {once}=require('node:events');
  const broker=require('aedes')(), server=net.createServer(broker.handle);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='mqtt://127.0.0.1:'+server.address().port;
  let first,second,publisher;
  const topic='honeychain/v1/devices/'+deviceId+'/telemetry';
  const {installTelemetryHandler}=require('../src/lib/telemetry/mqtt-bridge.ts');
  const raw=bytes(150), envelope=Buffer.from(JSON.stringify({payload:raw.toString('base64'),signature:signPacket(raw,secret)}));
  const clientId='integration-bridge-'+randomUUID().slice(0,8);
  const abortable=task=>new Promise((resolve,reject)=>{
    const abort=()=>reject(new Error('MQTT test aborted'));
    context.signal.addEventListener('abort',abort,{once:true});
    if(context.signal.aborted)abort();
    Promise.resolve(task).then(resolve,reject).finally(()=>context.signal.removeEventListener('abort',abort));
  });
  const waitAck=client=>abortable(new Promise(resolve=>client.on('packetsend',packet=>{if(packet.cmd==='puback')resolve();})));
  try {
    first=mqtt.connect(address,{clientId,clean:false,reconnectPeriod:0,manualConnect:true});
    const initialConnection=once(first,'connect',{signal:context.signal});first.connect();await initialConnection;
    let acknowledged=false;
    const disconnected=abortable(new Promise(resolve=>broker.on('clientDisconnect',client=>{if(client.id===clientId)resolve();})));
    first.on('packetsend',packet=>{if(packet.cmd==='puback') acknowledged=true;});
    const failed=new Promise(resolve=>installTelemetryHandler(first,{ingest:async()=>{throw new Error('Injected database outage');}},resolve,()=>{}));
    first.on('error',()=>{});
    await abortable(first.subscribeAsync(topic,{qos:1}));
    publisher=mqtt.connect(address,{reconnectPeriod:0,manualConnect:true});
    const publisherConnection=once(publisher,'connect',{signal:context.signal});publisher.connect();await publisherConnection;
    await abortable(publisher.publishAsync(topic,envelope,{qos:1,retain:false}));
    await abortable(failed);
    assert.equal(acknowledged,false);
    assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:150}}),0);
    await first.endAsync(true);
    await disconnected; // Do not race a new connection against the broker's old-session teardown.
    second=mqtt.connect(address,{clientId,clean:false,reconnectPeriod:0,manualConnect:true});
    installTelemetryHandler(second,service,()=>{},()=>{});
    const ack=waitAck(second);
    const connected=once(second,'connect',{signal:context.signal});second.connect();await connected;await ack;
    assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:150}}),1);
    await abortable(second.subscribeAsync(topic,{qos:1}));
    const duplicateAck=waitAck(second);
    await abortable(publisher.publishAsync(topic,envelope,{qos:1}));await duplicateAck;
    assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:150}}),1);
  } finally {
    await Promise.all([first,second,publisher].filter(Boolean).map(client=>client.endAsync(true)));
    await new Promise(resolve=>broker.close(resolve));await new Promise(resolve=>server.close(resolve));
  }
});
test('key rotation and revocation reject previously valid signatures without deleting history',async()=>{
  const rotatedEpoch=randomUUID();await db.deviceCredential.update({where:{id:credential.id},data:{epoch:rotatedEpoch,encryptedSecret:encryptDeviceSecret(secret,deviceId+':'+rotatedEpoch)}});
  await assert.rejects(ingest(bytes(200)),error=>error.status===401);
  const raw=bytes(0,{epoch:rotatedEpoch});assert.equal((await ingest(raw)).reading.source,'SIMULATED');
  await db.deviceCredential.update({where:{id:credential.id},data:{active:false}});
  await assert.rejects(ingest(bytes(1,{epoch:rotatedEpoch})),error=>error.status===401);
  assert.ok(await db.sensorReading.count({where:{hiveId:hive.id}})>=5);
});
