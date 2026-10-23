const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomBytes,randomUUID}=require('node:crypto');
require('dotenv').config({path:'.env.integration',override:true,quiet:true});
const databaseUrl=new URL(process.env.DATABASE_URL||'');
if(databaseUrl.hostname!=='127.0.0.1'||databaseUrl.port!=='55432'||databaseUrl.pathname!=='/pollinator_integration')throw new Error('Dedicated local integration database required');
const certificateDirectory=path.resolve('.local-data/clusters/qa-cluster-a/secrets');
process.env.APP_ORIGIN='https://gateway.example.test';process.env.IOT_CREDENTIAL_KEY=randomBytes(32).toString('hex');
process.env.IOT_GATEWAY_MQTT_URL='mqtts://127.0.0.1:18883';
for(const [name,file]of [['CA','mqtt_ca.crt'],['CERT','mqtt_gateway.crt'],['KEY','mqtt_gateway.key']])process.env['IOT_GATEWAY_MQTT_'+name]=path.join(certificateDirectory,file);
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const mqtt=require('mqtt'),{PrismaClient}=require('@prisma/client'),{IDBFactory}=require('fake-indexeddb');
const {createGatewayHandler}=require('../src/lib/telemetry/gateway-handler.ts');
const {publishGatewayPacket}=require('../src/lib/telemetry/gateway-publisher.ts');
const {TelemetryService}=require('../src/lib/telemetry/service.ts');
const {installTelemetryHandler}=require('../src/lib/telemetry/mqtt-bridge.ts');
const {encryptDeviceSecret}=require('../src/lib/telemetry/secrets.ts');
const {signPacket,packetHash}=require('../src/lib/telemetry/protocol.ts');
const {verifyStoredReceipt}=require('../src/lib/telemetry/acknowledgement.ts');
const {LocalGatewayQueue}=require('../src/lib/telemetry/local-queue.ts');
const {syncPhoneQueue}=require('../src/lib/telemetry/phone-sync.ts');
const db=new PrismaClient(),service=new TelemetryService(db),secret=randomBytes(32).toString('hex'),epoch=randomUUID(),deviceId='SIM-GATEWAY-IT-'+randomUUID().slice(0,8).toUpperCase();
let keeper,hive,identity,bridge,credential,published=0;
before(async()=>{
 const stamp=String(Date.now());keeper=await db.beekeeper.create({data:{name:'Synthetic gateway integration',phone:'+997'+stamp}});
 hive=await db.hive.create({data:{deviceId,beekeeperId:keeper.id}});
 credential=await db.deviceCredential.create({data:{hiveId:hive.id,epoch,source:'SIMULATED',encryptedSecret:encryptDeviceSecret(secret,deviceId+':'+epoch)}});
 identity={accountId:'gateway-integration-'+stamp,role:'beekeeper',beekeeperId:keeper.id,walletAddress:'0x'+'a'.repeat(40)};
});
after(async()=>{if(bridge)await bridge.endAsync(true);await db.$disconnect();});
function raw(sequence,change={}){return Buffer.from(JSON.stringify({version:1,deviceId,epoch,sequence,observedAt:new Date().toISOString(),metrics:{tempC:35},...change}));}
function envelope(bytes){return{payload:bytes.toString('base64'),signature:signPacket(bytes,secret)};}
function request(value,account=identity.accountId){return new Request('https://gateway.example.test/api/iot/gateway',{method:'POST',headers:{Origin:'https://gateway.example.test','Content-Type':'application/json','X-Gateway-Account':account},body:JSON.stringify(value)});}
function handler(statusOnly=false,session=()=>identity){return createGatewayHandler({db,session:async()=>session(),statusOnly,publish:async(id,value)=>{published++;await publishGatewayPacket(id,value);}});}
async function consume(){
 bridge=mqtt.connect('mqtts://127.0.0.1:18883',{manualConnect:true,reconnectPeriod:0,connectTimeout:5000,clean:true,clientId:'gateway-it-'+randomUUID(),rejectUnauthorized:true,
  ca:fs.readFileSync(path.join(certificateDirectory,'mqtt_ca.crt')),cert:fs.readFileSync(path.join(certificateDirectory,'mqtt_bridge.crt')),key:fs.readFileSync(path.join(certificateDirectory,'mqtt_bridge.key'))});
 bridge.on('error',()=>{});installTelemetryHandler(bridge,service,()=>{},()=>{});
 const connected=new Promise((resolve,reject)=>{bridge.once('connect',resolve);bridge.once('error',()=>reject(new Error('Synthetic TLS broker connection unavailable')));});bridge.connect();await connected;
 await bridge.subscribeAsync('honeychain/v1/devices/'+deviceId+'/telemetry',{qos:1});
}
test('real TLS broker acceptance without a consumer remains pending and does not create a database receipt',async()=>{
 const value=envelope(raw(1)),post=handler(),response=await post(request(value));assert.equal(response.status,202);assert.equal((await response.json()).state,'BROKER_ACCEPTED');
 const pending=await handler(true)(request(value));assert.equal(pending.status,202);assert.equal((await pending.json()).state,'WAITING_FOR_STORAGE');assert.equal(await db.sensorReading.count({where:{hiveId:hive.id}}),0);
 await consume();
});
test('phone queue, MQTT worker and PostgreSQL complete storage before the simulated hive verifies its receipt',async()=>{
 const bytes=raw(2),value=envelope(bytes),q=await LocalGatewayQueue.open(identity.accountId,new IDBFactory());await q.put(value,deviceId);let deviceJournalRetained=true;
 try{const result=await syncPhoneQueue(q,{deviceId,signal:new AbortController().signal,request:async(input,statusOnly)=>{
   const response=await handler(statusOnly)(request(input));assert.ok([200,202].includes(response.status));return response.json();},
  acknowledge:async(_record,receipt)=>{assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:2}}),1);assert.equal(verifyStoredReceipt(receipt,secret,{deviceId,epoch,sequence:2,packetHash:packetHash(bytes)}),true);deviceJournalRetained=false;return true;},
  updated:async()=>{},delay:async ms=>new Promise(resolve=>setTimeout(resolve,Math.min(ms,300)))});
  assert.equal(result.receiptsSent,1);assert.equal(deviceJournalRetained,false);assert.equal((await q.list()).length,0);
  assert.equal((await db.sensorReading.findFirst({where:{hiveId:hive.id,sequence:2}})).source,'SIMULATED');
 }finally{q.close();}
});
test('committed retries return the same receipt without a new publish, and conflicting content is refused',async()=>{
 const bytes=raw(3),value=envelope(bytes);await service.ingest(bytes,value.signature);const before=published,post=handler();
 const first=await post(request(value)),second=await post(request(value));assert.equal(first.status,200);assert.deepEqual((await first.json()).receipt,(await second.json()).receipt);assert.equal(published,before);
 const changed=envelope(raw(3,{metrics:{tempC:36}}));assert.equal((await post(request(changed))).status,409);assert.equal(published,before);assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:3}}),1);
});
test('foreign owner, stale account tab and forged packet cannot publish to the real broker',async()=>{
 const before=published,value=envelope(raw(4));assert.equal((await handler(false,()=>({...identity,beekeeperId:'another-keeper'}))(request(value))).status,404);
 assert.equal((await handler()(request(value,'another-account'))).status,403);assert.equal((await handler()(request({...value,signature:'ff'.repeat(32)}))).status,401);
 assert.equal(published,before);assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:4}}),0);
});
test('the read-only bridge certificate cannot impersonate the gateway publisher',async()=>{
 const savedCertificate=process.env.IOT_GATEWAY_MQTT_CERT,savedKey=process.env.IOT_GATEWAY_MQTT_KEY;
 try{process.env.IOT_GATEWAY_MQTT_CERT=path.join(certificateDirectory,'mqtt_bridge.crt');process.env.IOT_GATEWAY_MQTT_KEY=path.join(certificateDirectory,'mqtt_bridge.key');
  const response=await handler()(request(envelope(raw(8))));assert.equal(response.status,503);assert.equal(await db.sensorReading.count({where:{hiveId:hive.id,sequence:8}}),0);
 }finally{process.env.IOT_GATEWAY_MQTT_CERT=savedCertificate;process.env.IOT_GATEWAY_MQTT_KEY=savedKey;}
});
test('revocation prevents new delivery and receipt lookup without erasing committed history',async()=>{
 await db.deviceCredential.update({where:{id:credential.id},data:{active:false}});const before=published;
 assert.equal((await handler()(request(envelope(raw(5))))).status,401);assert.equal((await handler(true)(request(envelope(raw(2))))).status,401);assert.equal(published,before);
 assert.ok(await db.sensorReading.count({where:{hiveId:hive.id}})>=2);
});
