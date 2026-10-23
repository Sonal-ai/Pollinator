const {test}=require('node:test'),assert=require('node:assert/strict'),{createHmac,randomUUID}=require('node:crypto');
const {FirmwareDriver:Driver}=require('./helpers/firmware-driver.cjs');
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {parsePacket,verifyPacket,packetHash}=require('../src/lib/telemetry/protocol.ts');
const {createStoredReceipt}=require('../src/lib/telemetry/acknowledgement.ts');
const identity={version:1,deviceId:'SIM-FIRMWARE',epoch:randomUUID(),secret:'ab'.repeat(32),source:'SIMULATED'};
const observedAt=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
async function setup(context){const driver=new Driver();context.after(()=>driver.close());assert.equal((await driver.call('boot')).error,'UNPROVISIONED');assert.equal((await driver.call('provision',{identity})).ok,true);return driver;}
const capture=driver=>driver.call('capture',{metrics:{tempC:35,humidityPct:55,weightKg:42},observedAt});
async function packet(driver,rewind=true){const reply=await driver.call('next',{rewind});assert.equal(reply.ok,true);const bytes=Buffer.from(reply.frame.payload,'base64');return{envelope:reply.frame,bytes,packet:parsePacket(bytes)};}
function receipt(bytes,key=identity.secret,change={}){const p=parsePacket(bytes),body={version:1,kind:'stored',deviceId:p.deviceId,epoch:p.epoch,sequence:p.sequence,packetHash:packetHash(bytes),readingId:'reading-committed',...change};const raw=Buffer.from(JSON.stringify(body));return{payload:raw.toString('base64'),signature:createHmac('sha256',Buffer.from(key,'hex')).update('honey-chain-stored-v1\n').update(raw).digest('hex')};}
test('C++ firmware signs exact version-1 bytes accepted by the existing Node protocol',async t=>{
 const d=await setup(t);assert.equal((await capture(d)).ok,true);const first=await packet(d);assert.equal(first.packet.sequence,0);assert.equal(first.packet.metrics.tempC,35);assert.equal(verifyPacket(first.bytes,first.envelope.signature,identity.secret),true);
 const ack=createStoredReceipt(first.bytes,{id:'reading-one',epoch:identity.epoch,sequence:0,packetHash:packetHash(first.bytes)},identity.secret);assert.equal((await d.call('ack',{receipt:ack})).pending,0);assert.equal((await d.call('ack',{receipt:ack})).ok,true);
});
test('reboot retains exact pending bytes and skips the previously reserved sequence block',async t=>{
 const d=await setup(t);await capture(d);const before=await packet(d);const boot=await d.call('crash');assert.equal(boot.ok,true);assert.equal(boot.nextSequence,64);assert.deepEqual((await packet(d)).envelope,before.envelope);
 await capture(d);await packet(d);const second=await packet(d,false);assert.equal(second.packet.sequence,64);assert.notEqual(second.envelope.payload,before.envelope.payload);
});
test('acknowledgement cannot skip a pending packet or trust a phone uploaded flag',async t=>{
 const d=await setup(t);await capture(d);const first=await packet(d);
 for(const ack of [{payload:'uploaded',signature:'saved'},receipt(first.bytes,'cd'.repeat(32)),{payload:first.envelope.payload,signature:first.envelope.signature},receipt(first.bytes,identity.secret,{kind:'queued'}),receipt(first.bytes,identity.secret,{epoch:randomUUID()}),receipt(first.bytes,identity.secret,{deviceId:'SIM-OTHER'}),receipt(first.bytes,identity.secret,{packetHash:'00'.repeat(32)}),receipt(first.bytes,identity.secret,{extra:true}),receipt(first.bytes,identity.secret,{sequence:1.5})]){
  const response=await d.call('ack',{receipt:ack});assert.equal(response.ok,false);assert.equal(response.pending,1);assert.equal(response.durablePackets,1);
 }
 const accepted=await d.call('ack',{receipt:receipt(first.bytes)});assert.equal(accepted.ok,true);assert.equal(accepted.pending,0);
});
test('deleting an earlier packet does not shift the BLE session cursor past another packet',async t=>{
 const d=await setup(t);await capture(d);await capture(d);await capture(d);const first=await packet(d);await d.call('ack',{receipt:receipt(first.bytes)});
 const second=await packet(d,false);assert.equal(second.packet.sequence,1);const third=await packet(d,false);assert.equal(third.packet.sequence,2);
 assert.equal((await d.call('next')).frame.event,'idle');assert.equal((await packet(d)).packet.sequence,1);
});
test('missing or invalid measurements and invalid UTC clocks never become zero-valued packets',async t=>{
 const d=await setup(t);for(const metrics of [{},{tempC:null},{tempC:true},{tempC:'35'},{tempC:71},{weightKg:-1},{pressureHPa:1200},{unknown:1}])assert.equal((await d.call('capture',{metrics,observedAt})).error,'INVALID_INPUT');
 for(const time of ['1970-01-01T00:00:00Z','2026-02-30T00:00:00Z','2026-01-01T25:00:00Z','2026-01-01T00:00:00','2026-01-01T00:00:00Zjunk'])assert.equal((await d.call('capture',{metrics:{tempC:35},observedAt:time})).error,'INVALID_INPUT');
 assert.equal((await d.call('status')).pending,0);assert.equal((await d.call('capture',{metrics:{tempC:35},observedAt:'2028-02-29T00:00:00Z'})).ok,true);
});
for(const point of ['state-before','state-after','packet-before','packet-after'])test('interrupted '+point+' cannot reuse an exposed sequence or lose a committed packet',async t=>{
 const d=await setup(t);await d.call('fault',{point});assert.equal((await capture(d)).ok,false);const recovered=await d.call('crash');assert.equal(recovered.ok,true);
 const committed=point==='packet-after';assert.equal(recovered.pending,committed?1:0);assert.equal(recovered.nextSequence,point==='state-before'?0:64);
 if(committed)assert.equal((await packet(d)).packet.sequence,0);
 assert.equal((await capture(d)).ok,true);const newest=await packet(d);assert.equal(newest.packet.sequence,point==='state-before'?0:committed?0:64);
 if(committed)assert.equal((await packet(d,false)).packet.sequence,64);
});
for(const point of ['erase-before','erase-after'])test('interrupted '+point+' is safe because a valid server receipt already exists',async t=>{
 const d=await setup(t);await capture(d);const first=await packet(d);await d.call('fault',{point});assert.equal((await d.call('ack',{receipt:receipt(first.bytes)})).ok,false);
 const recovered=await d.call('crash');assert.equal(recovered.ok,true);assert.equal(recovered.pending,point==='erase-before'?1:0);assert.equal(recovered.nextSequence,64);
 if(recovered.pending)assert.equal((await d.call('ack',{receipt:receipt(first.bytes)})).pending,0);
});
test('full storage applies backpressure without overwriting the oldest unacknowledged reading',async t=>{
 const d=await setup(t);assert.equal((await d.call('space',{available:false})).ok,true);assert.equal((await capture(d)).error,'JOURNAL_FULL');assert.equal((await d.call('status')).nextSequence,0);
 await d.call('space',{available:true});const filled=await d.call('fill',{count:2048,metrics:{tempC:35},observedAt});assert.equal(filled.pending,2048);const first=await packet(d);
 assert.equal((await capture(d)).error,'JOURNAL_FULL');assert.deepEqual((await packet(d)).envelope,first.envelope);assert.equal((await d.call('status')).durablePackets,2048);
});
test('credential reinstall never resets a counter, while rotation waits for pending receipts',async t=>{
 const d=await setup(t);await capture(d);const first=await packet(d);assert.equal((await d.call('provision',{identity})).nextSequence,1);
 const rotated={...identity,epoch:randomUUID(),secret:'cd'.repeat(32)};assert.equal((await d.call('provision',{identity:rotated})).error,'PENDING_READINGS_PREVENT_ROTATION');
 await d.call('ack',{receipt:receipt(first.bytes)});assert.equal((await d.call('provision',{identity:{...rotated,deviceId:'SIM-OTHER'}})).error,'IDENTITY_MISMATCH');
 assert.equal((await d.call('provision',{identity:rotated})).ok,true);await capture(d);const next=await packet(d);assert.equal(next.packet.sequence,0);assert.equal(next.packet.epoch,rotated.epoch);assert.equal(verifyPacket(next.bytes,next.envelope.signature,rotated.secret),true);
 assert.equal((await d.call('ack',{receipt:receipt(first.bytes)})).error,'INVALID_RECEIPT');
});
test('corrupt identity, packet or journal binding fails closed instead of formatting or starting at zero',async t=>{
 for(const operation of ['tamper-state','tamper-packet','drop-owner']){const d=await setup(t);await capture(d);await d.call(operation,{sequence:0});const crashed=await d.call('crash');assert.equal(crashed.ok,false);assert.equal(crashed.ready,false);assert.equal(crashed.durablePackets,1);assert.equal((await capture(d)).ok,false);}
});
test('counter exhaustion refuses new samples and requires a fresh epoch',async t=>{
 const d=await setup(t);await d.call('set-reservation',{until:2147483648});assert.equal((await d.call('crash')).ok,true);assert.equal((await capture(d)).error,'NEW_EPOCH_REQUIRED');assert.equal((await d.call('status')).durablePackets,0);
});
