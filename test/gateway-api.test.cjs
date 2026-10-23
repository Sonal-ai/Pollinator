require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createGatewayHandler}=require('../src/lib/telemetry/gateway-handler.ts');
const {encryptDeviceSecret}=require('../src/lib/telemetry/secrets.ts');
const {signPacket,packetHash,TelemetryError}=require('../src/lib/telemetry/protocol.ts');
const {verifyStoredReceipt}=require('../src/lib/telemetry/acknowledgement.ts');
const session={accountId:'account-a',role:'beekeeper',beekeeperId:'keeper-a',walletAddress:'0x'+'a'.repeat(40)};
const secret='ab'.repeat(32),epoch=randomUUID(),deviceId='SIM-GATEWAY';
process.env.IOT_CREDENTIAL_KEY='12'.repeat(32);process.env.APP_ORIGIN='https://gateway.example.test';
function envelope(change={}){const bytes=Buffer.from(JSON.stringify({version:1,deviceId,epoch,sequence:7,observedAt:new Date().toISOString(),metrics:{tempC:35},...change}));return{payload:bytes.toString('base64'),signature:signPacket(bytes,secret)};}
function setup(options={}){
 const state={published:[],hiveReads:0,credentialReads:0,transactions:0,scope:null};
 const credential={id:'credential-a',hiveId:'hive-a',epoch,active:true,source:'SIMULATED',hive:{},encryptedSecret:encryptDeviceSecret(secret,deviceId+':'+epoch),...options.credential};
 const db={hive:{findFirst:async query=>{state.hiveReads++;state.scope=query.where;return options.foreign?null:{id:'hive-a'};}},deviceCredential:{findFirst:async()=>{state.credentialReads++;return credential;}},
  sensorReading:{findUnique:async()=>{if(options.storageError)throw new Error('private connection failure');return options.row||null;}},$transaction:async()=>{state.transactions++;throw new Error('Gateway must not insert readings');}};
 return{state,post:createGatewayHandler({db,session:async()=>Object.hasOwn(options,'session')?options.session:session,statusOnly:options.statusOnly,
  publish:async(id,value)=>{state.published.push({id,value});if(options.publishFailure)throw new TelemetryError('MQTT delivery is unavailable.',503);}})};
}
function request(body=envelope(),extra={}){return new Request('https://gateway.example.test/api/iot/gateway',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://gateway.example.test','X-Gateway-Account':'account-a',...extra},body:JSON.stringify(body)});}
test('phone relay requires a live account, correct role, same origin and matching queue owner before reads',async()=>{
 for(const [identity,headers,status]of [[null,{},401],[{...session,role:'lab'},{},403],[session,{Origin:'https://other.test'},403],[session,{'X-Gateway-Account':'account-b'},403],[session,{'X-Gateway-Account':''},403]]){
  const r=setup({session:identity});assert.equal((await r.post(request(envelope(),headers))).status,status);assert.equal(r.state.hiveReads,0);assert.equal(r.state.published.length,0);
 }
});
test('gateway ownership is scoped before a device credential can be examined',async()=>{
 const r=setup({foreign:true});assert.equal((await r.post(request())).status,404);assert.equal(r.state.credentialReads,0);assert.deepEqual(r.state.scope.AND[0],{beekeeperId:{in:['keeper-a']}});
});
test('valid relay preserves exact signed bytes but reports only broker acceptance',async()=>{
 const r=setup(),input=envelope(),response=await r.post(request(input));assert.equal(response.status,202);assert.equal((await response.json()).state,'BROKER_ACCEPTED');
 assert.deepEqual(r.state.published,[{id:deviceId,value:input}]);assert.equal(r.state.transactions,0);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('receipt polling is read-only and pending storage never becomes a receipt',async()=>{
 const r=setup({statusOnly:true});const response=await r.post(request());assert.equal(response.status,202);assert.deepEqual(await response.json(),{state:'WAITING_FOR_STORAGE',source:'SIMULATED'});assert.equal(r.state.published.length,0);assert.equal(r.state.transactions,0);
});
test('only an identical committed row produces a device-verifiable receipt, including old retries',async()=>{
 const input=envelope({observedAt:new Date(Date.now()-10*86400000).toISOString()}),bytes=Buffer.from(input.payload,'base64');
 const r=setup({row:{id:'reading-a',epoch,sequence:7,source:'SIMULATED',packetHash:packetHash(bytes)}}),response=await r.post(request(input));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.state,'STORED');assert.equal(verifyStoredReceipt(data.receipt,secret,{deviceId,epoch,sequence:7,packetHash:packetHash(bytes)}),true);assert.equal(r.state.published.length,0);
});
test('sequence conflicts, revoked keys, wrong epochs and forged signatures never reach MQTT',async()=>{
 const input=envelope();for(const [options,value,status]of [[{row:{packetHash:'00'.repeat(32)}},input,409],[{credential:{active:false}},input,401],[{credential:{epoch:randomUUID()}},input,401],[{}, {...input,signature:'ff'.repeat(32)},401]]){
  const r=setup(options);assert.equal((await r.post(request(value))).status,status);assert.equal(r.state.published.length,0);
 }
});
test('uncommitted stale packets, invalid schemas and oversized envelopes are retained by rejection',async()=>{
 for(const [input,status]of [[envelope({observedAt:new Date(Date.now()-8*86400000).toISOString()}),422],[{...envelope(),extra:true},422],[{payload:'A'.repeat(9000),signature:'ab'.repeat(32)},413]]){
  const r=setup();assert.equal((await r.post(request(input))).status,status);assert.equal(r.state.published.length,0);
 }
});
test('MQTT and storage outages return unavailable without a direct-ingestion fallback or private diagnostics',async()=>{
 for(const options of [{publishFailure:true},{storageError:true}]){const r=setup(options),response=await r.post(request());assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/private connection/);assert.equal(r.state.transactions,0);}
});
test('legacy device credentials require re-enrollment before phone forwarding',async()=>{
 const r=setup({credential:{source:'LEGACY'}});assert.equal((await r.post(request())).status,409);assert.equal(r.state.published.length,0);
});
