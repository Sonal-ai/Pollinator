require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {IDBFactory}=require('fake-indexeddb');
const {LocalGatewayQueue}=require('../src/lib/telemetry/local-queue.ts');
const {BleFrameDecoder,decodeClientEnvelope,clientPacketHash}=require('../src/lib/telemetry/client-protocol.ts');
const {signPacket,packetHash}=require('../src/lib/telemetry/protocol.ts');
const {createStoredReceipt}=require('../src/lib/telemetry/acknowledgement.ts');
const secret='ab'.repeat(32),deviceId='SIM-PHONE',epoch=randomUUID();
function packet(sequence=1,change={}){const bytes=Buffer.from(JSON.stringify({version:1,deviceId,epoch,sequence,observedAt:'2026-10-20T10:00:00Z',metrics:{weightKg:42},...change},null,1));return{payload:bytes.toString('base64'),signature:signPacket(bytes,secret)};}
function receipt(envelope){const bytes=Buffer.from(envelope.payload,'base64'),p=JSON.parse(bytes);return createStoredReceipt(bytes,{id:'reading-a',epoch:p.epoch,sequence:p.sequence,packetHash:packetHash(bytes)},secret);}
test('BLE framing survives every-byte fragmentation and several frames without changing signed bytes',async()=>{
 const input=packet(),raw=Buffer.from(JSON.stringify(input)+'\n'+JSON.stringify({event:'idle'})+'\n');const decoder=new BleFrameDecoder(),frames=[];
 for(const byte of raw)frames.push(...decoder.push(Uint8Array.of(byte)));
 assert.deepEqual(frames,[input,{event:'idle'}]);assert.equal(await clientPacketHash(decodeClientEnvelope(input).bytes),packetHash(Buffer.from(input.payload,'base64')));
});
test('oversized, non-ASCII, ambiguous and malformed wire frames fail instead of producing readings',()=>{
 for(const bytes of [Buffer.alloc(8193,65),Buffer.from([255]),Buffer.from('{"event":"idle","payload":"bad"}\n'),Buffer.from('{bad}\n')])assert.throws(()=>new BleFrameDecoder().push(bytes));
 assert.throws(()=>decodeClientEnvelope({...packet(),extra:true}));assert.throws(()=>decodeClientEnvelope(packet(1,{metrics:{weightKg:999}})));
});
test('queue survives closing and reopening its IndexedDB connection, with exact bytes and no device secret',async()=>{
 const factory=new IDBFactory(),first=await LocalGatewayQueue.open('account-a',factory),input=packet();const saved=await first.put(input,deviceId);first.close();
 const reopened=await LocalGatewayQueue.open('account-a',factory);try{assert.deepEqual((await reopened.list())[0],saved);assert.deepEqual(saved.envelope,input);assert.equal(Object.hasOwn(saved,'secret'),false);}finally{reopened.close();}
});
test('concurrent duplicates store once and conflicting bytes never replace the first packet',async()=>{
 const factory=new IDBFactory(),a=await LocalGatewayQueue.open('account-a',factory),b=await LocalGatewayQueue.open('account-a',factory),input=packet();
 try{const saved=await Promise.all(Array.from({length:20},(_,i)=>(i%2?a:b).put(input,deviceId)));assert.equal(new Set(saved.map(x=>x.id)).size,1);assert.equal((await a.list()).length,1);
  await assert.rejects(b.put(packet(1,{metrics:{weightKg:43}}),deviceId),/Conflicting/);assert.deepEqual((await a.list())[0].envelope,input);
 }finally{a.close();b.close();}
});
test('account queues isolate list, receipt updates and deletion even for the same device packet',async()=>{
 const factory=new IDBFactory(),a=await LocalGatewayQueue.open('account-a',factory),b=await LocalGatewayQueue.open('account-b',factory),input=packet();
 try{const one=await a.put(input,deviceId),two=await b.put(input,deviceId);assert.notEqual(one.id,two.id);assert.equal((await a.list()).length,1);assert.equal((await b.list()).length,1);
  await assert.rejects(b.discardFromPhone(one.id),/another account/);await assert.rejects(b.attachReceipt(one.id,receipt(input)),/this account/);assert.equal((await a.list()).length,1);
 }finally{a.close();b.close();}
});
test('receipts bind the exact queued identity and automatic removal refuses unconfirmed packets',async()=>{
 const q=await LocalGatewayQueue.open('account-a',new IDBFactory()),input=packet();
 try{const saved=await q.put(input,deviceId);await assert.rejects(q.put(input,'OTHER-HIVE'),/another hive/);await assert.rejects(q.removeStored(saved.id),/unconfirmed/);
  await assert.rejects(q.attachReceipt(saved.id,receipt(packet(2))),/does not match/);assert.equal((await q.list())[0].receipt,undefined);
  await q.attachReceipt(saved.id,receipt(input));await q.removeStored(saved.id);assert.equal((await q.list()).length,0);
 }finally{q.close();}
});
test('a full queue cannot race past its global capacity across accounts or discard old records',async()=>{
 const factory=new IDBFactory(),q=await LocalGatewayQueue.open('account-a',factory);
 const database=await new Promise((resolve,reject)=>{const r=factory.open('honeychain-phone-gateway-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
 await new Promise((resolve,reject)=>{const t=database.transaction('packets','readwrite'),store=t.objectStore('packets');for(let i=0;i<4999;i++){
  const envelope=packet(i),bytes=Buffer.from(envelope.payload,'base64');store.add({id:JSON.stringify(['older-account',deviceId,epoch,i]),owner:'older-account',deviceId,epoch,sequence:i,packetHash:packetHash(bytes),observedAt:'2026-10-20T10:00:00Z',createdAt:i,envelope});
 }t.oncomplete=resolve;t.onabort=reject;});
 try{const outcomes=await Promise.allSettled([q.put(packet(6000),deviceId),q.put(packet(6001),deviceId)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
  const count=await new Promise(resolve=>{const r=database.transaction('packets').objectStore('packets').count();r.onsuccess=()=>resolve(r.result);});assert.equal(count,5000);
 }finally{q.close();database.close();}
});
test('closed or unavailable local storage cannot report successful collection',async()=>{
 await assert.rejects(LocalGatewayQueue.open('account-a',null),/unavailable/);const factory=new IDBFactory(),q=await LocalGatewayQueue.open('account-a',factory);q.close();await assert.rejects(q.put(packet(),deviceId));
 const reopened=await LocalGatewayQueue.open('account-a',factory);try{assert.deepEqual(await reopened.list(),[]);}finally{reopened.close();}
});
