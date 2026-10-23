require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {IDBFactory}=require('fake-indexeddb');
const {LocalGatewayQueue}=require('../src/lib/telemetry/local-queue.ts');
const {syncPhoneQueue}=require('../src/lib/telemetry/phone-sync.ts');
const {signPacket,packetHash}=require('../src/lib/telemetry/protocol.ts');
const {createStoredReceipt}=require('../src/lib/telemetry/acknowledgement.ts');
const secret='ab'.repeat(32),deviceId='SIM-SYNC',epoch=randomUUID();
async function setup(){const q=await LocalGatewayQueue.open('account-a',new IDBFactory()),bytes=Buffer.from(JSON.stringify({version:1,deviceId,epoch,sequence:1,observedAt:new Date().toISOString(),metrics:{tempC:35}}));
 const envelope={payload:bytes.toString('base64'),signature:signPacket(bytes,secret)},record=await q.put(envelope,deviceId),receipt=createStoredReceipt(bytes,{id:'reading-a',epoch,sequence:1,packetHash:packetHash(bytes)},secret);return{q,record,receipt};}
function options(extra={}){return{deviceId,signal:new AbortController().signal,request:async()=>({state:'BROKER_ACCEPTED',source:'SIMULATED'}),acknowledge:async()=>false,updated:async()=>{},delay:async()=>{},...extra};}
test('sync waits for database receipt and keeps the local copy until the BLE acknowledgement write succeeds',async()=>{
 const {q,receipt}=await setup();let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ackStarted=new Promise(resolve=>{entered=resolve;});const calls=[];
 try{const work=syncPhoneQueue(q,options({request:async(_envelope,statusOnly)=>{calls.push(statusOnly);return statusOnly?{state:'STORED',source:'SIMULATED',receipt}:{state:'BROKER_ACCEPTED',source:'SIMULATED'};},acknowledge:async()=>{entered();await gate;return true;}}));
  await ackStarted;assert.ok((await q.list())[0].receipt);release();await work;assert.deepEqual(calls,[false,true]);assert.equal((await q.list()).length,0);
 }finally{q.close();}
});
test('broker acceptance without database storage never acknowledges or deletes the queued packet',async()=>{
 const {q}=await setup();let acknowledgements=0,requests=0;
 try{await assert.rejects(syncPhoneQueue(q,options({request:async()=>{requests++;return{state:'WAITING_FOR_STORAGE',source:'SIMULATED'};},acknowledge:async()=>{acknowledgements++;return true;}})),/storage is still pending/);
  assert.equal(acknowledgements,0);assert.equal(requests,5);assert.equal((await q.list()).length,1);assert.equal((await q.list())[0].receipt,undefined);
 }finally{q.close();}
});
test('BLE failure retains the stored receipt and a reconnect can return it without publishing again',async()=>{
 const {q,receipt}=await setup();try{await assert.rejects(syncPhoneQueue(q,options({request:async()=>({state:'STORED',source:'SIMULATED',receipt}),acknowledge:async()=>{throw new Error('Disconnected');}})),/Disconnected/);
  assert.ok((await q.list())[0].receipt);await syncPhoneQueue(q,options({request:async()=>{throw new Error('Must not publish an already stored packet');},acknowledge:async()=>true}));assert.equal((await q.list()).length,0);
 }finally{q.close();}
});
test('a mismatched receipt cannot reach the hive or remove the original packet',async()=>{
 const {q,receipt}=await setup();let acknowledged=false;const body=JSON.parse(Buffer.from(receipt.payload,'base64'));body.sequence++;
 try{await assert.rejects(syncPhoneQueue(q,options({request:async()=>({state:'STORED',source:'SIMULATED',receipt:{...receipt,payload:Buffer.from(JSON.stringify(body)).toString('base64')}}),acknowledge:async()=>{acknowledged=true;return true;}})),/does not match/);
  assert.equal(acknowledged,false);assert.equal((await q.list()).length,1);
 }finally{q.close();}
});
test('network failure keeps the packet and never invents a direct HTTP ingestion fallback',async()=>{
 const {q}=await setup();let requests=0;try{await assert.rejects(syncPhoneQueue(q,options({request:async()=>{requests++;throw new Error('Offline');}})),/Offline/);assert.equal(requests,1);assert.equal((await q.list()).length,1);}finally{q.close();}
});
test('offline hive and cancellation preserve receipts after the server has committed',async()=>{
 for(const cancel of [false,true]){const {q,receipt}=await setup(),controller=new AbortController();let acknowledged=false;
  try{const work=syncPhoneQueue(q,options({signal:controller.signal,request:async()=>{if(cancel)controller.abort();return{state:'STORED',source:'SIMULATED',receipt};},acknowledge:async()=>{acknowledged=true;return false;}}));
   if(cancel)await assert.rejects(work);else await work;assert.ok((await q.list())[0].receipt);assert.equal(acknowledged,!cancel);
  }finally{q.close();}
 }
});
