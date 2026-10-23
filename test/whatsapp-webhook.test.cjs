require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),{createHmac}=require('node:crypto');
const {createWebhookHandlers}=require('../src/lib/whatsapp/webhook.ts');
const secret='unit-webhook-secret-not-real',phone='12345';
const body=messages=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:phone},messages}}]}]});
const msg=(id='message-one')=>({id,from:'999000000001',timestamp:'1792500000',type:'text',text:{body:'harvest'}});
function request(bytes,signature){return new Request('https://app.example.test/api/webhook/whatsapp',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':signature??'sha256='+createHmac('sha256',secret).update(bytes).digest('hex')},body:bytes});}
function fixture(accept=async()=>{}){return createWebhookHandlers({verifyToken:'verify-unit-token',appSecret:secret,phoneId:phone,store:{accept}});}
test('webhook acknowledges only after durable acceptance resolves; it does not run the conversation inline',async()=>{
 let finish,stored=false;const pending=new Promise(resolve=>{finish=resolve;});
 const handlers=fixture(async(messages)=>{assert.equal(messages.length,2);await pending;stored=true;});
 let responded=false;const response=handlers.POST(request(JSON.stringify(body([msg(),msg('message-two')])))).then(value=>{responded=true;return value;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(responded,false);finish();assert.equal((await response).status,200);assert.equal(stored,true);
});
test('signature binds exact bytes; forged, malformed UTF-8/JSON and oversized bodies never reach storage',async()=>{
 let writes=0;const h=fixture(async()=>{writes++;}),bytes=JSON.stringify(body([msg()]));
 assert.equal((await h.POST(request(bytes,'sha256='+'0'.repeat(64)))).status,401);
 const signed='sha256='+createHmac('sha256',secret).update(bytes).digest('hex');assert.equal((await h.POST(request(bytes+' ',signed))).status,401);
 assert.equal((await h.POST(request('{'))).status,400);assert.equal((await h.POST(request(Buffer.from([0xff,0xfe])))).status,400);
 assert.equal((await h.POST(request('x'.repeat(256*1024+1)))).status,413);assert.equal(writes,0);
});
test('storage failure returns retryable HTTP 503 rather than successful-looking acknowledgement',async()=>{
 const response=await fixture(async()=>{throw new Error('DATABASE-PRIVATE-DETAIL');}).POST(request(JSON.stringify(body([msg()]))));
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('PRIVATE'));
});
test('signed messages for another phone are excluded and challenge verification stays bounded',async()=>{
 let count=-1;const h=fixture(async(messages)=>{count=messages.length;}),value=body([msg()]);value.entry[0].changes[0].value.metadata.phone_number_id='other-phone';
 assert.equal((await h.POST(request(JSON.stringify(value)))).status,200);assert.equal(count,0);
 const url='https://app.example.test/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verify-unit-token&hub.challenge=123';
 const good=await h.GET(new Request(url));assert.equal(good.status,200);assert.equal(await good.text(),'123');
 assert.equal((await h.GET(new Request(url.replace('verify-unit-token','wrong')))).status,403);
});
