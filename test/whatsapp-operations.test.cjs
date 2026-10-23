require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-ts.cjs');
const http=require('../src/lib/chain/http.ts'),protocol=require('../src/lib/chain/protocol.ts'),review=require('../src/lib/whatsapp/review.ts');
function route(session){
 const calls=[],rows=[{id:'synthetic-work',waId:'999000001014',state:'UNKNOWN',attempts:1,lastError:'SEND_RESULT_UNKNOWN',createdAt:new Date(0)}];
 const table={findMany:async()=>rows,groupBy:async()=>[]};
 const api=load('src/app/api/whatsapp/operations/route.ts',{
  '@/lib/auth':{getSession:async()=>session},'@/lib/db':{prisma:{whatsAppInbox:table,whatsAppOutbox:table}},
  '@/lib/chain/http':http,'@/lib/chain/protocol':protocol,
  '@/lib/whatsapp/review':{...review,reviewWhatsApp:async(_db,actor,input)=>{calls.push({actor,input});return{id:input.id,state:'PENDING'};}},
 });return{...api,calls};
}
const body={target:'outbox',id:'synthetic-work',action:'RETRY',reason:'Synthetic recipient verified by operator',acknowledgeDuplicateRisk:true};
function request(value=body,origin='https://unit.example.invalid'){return new Request('https://unit.example.invalid/api/whatsapp/operations',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});}
test('WhatsApp review rejects unauthenticated and non-admin reads and writes',async()=>{
 for(const [session,status] of [[null,401],[{role:'beekeeper'},403]]){const api=route(session);assert.equal((await api.GET()).status,status);assert.equal((await api.POST(request())).status,status);assert.equal(api.calls.length,0);}
});
test('admin queue exposes only recipient suffix and forbids cross-origin review',async()=>{
 const keys=['APP_ORIGIN','NEXT_PUBLIC_APP_URL'],old=keys.map(key=>process.env[key]);process.env.APP_ORIGIN='https://unit.example.invalid';
 try{
  const api=route({role:'admin',accountId:'authenticated-admin'}),response=await api.GET(),text=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(text.includes('1014'));assert.ok(!text.includes('999000001014'));assert.ok(!text.includes('waId'));
  assert.equal((await api.POST(request(body,'https://other.example.invalid'))).status,403);assert.equal(api.calls.length,0);
  assert.equal((await api.POST(request({...body,reason:'short'}))).status,422);assert.equal(api.calls.length,0);
  assert.equal((await api.POST(request())).status,200);assert.equal(api.calls[0].actor,'authenticated-admin');
 }finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});
