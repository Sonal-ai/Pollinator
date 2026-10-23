const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID,createHmac}=require('node:crypto');
require('dotenv').config({path:'.env.integration',override:true,quiet:true});
const database=new URL(process.env.DATABASE_URL||'');
if(database.hostname!=='127.0.0.1'||database.port!=='55432'||database.pathname!=='/pollinator_integration'||process.env.BLOCKCHAIN_NETWORK!=='local'||process.env.LOCAL_RPC_URL!=='http://127.0.0.1:8545')throw new Error('Dedicated local fixtures required');
const {prisma:db}=require('../build/workers/lib/db.js'),{WhatsAppWorker}=require('../build/workers/lib/whatsapp/worker.js');
const {ChainTransport}=require('../build/workers/lib/chain/transport.js'),{ChainWorker}=require('../build/workers/lib/chain/worker.js');
const accounts=JSON.parse(fs.readFileSync('.local-data/local-demo-accounts.json')),base='http://127.0.0.1:3100',chain=new ChainTransport(),chainWorker=new ChainWorker(db,chain),ids=[];
const waId='999000000001',record={checkedAt:new Date().toISOString(),scope:'Actual signed localhost webhook HTTP -> compiled durable WhatsApp worker -> actual HTTP batch API -> PostgreSQL -> HTTP wallet approval -> local EVM',syntheticMetaInbound:true,providerSendMocked:true,translationMocked:true,ipfsMocked:false,realPhoneDeliveryProven:false,passed:false,steps:[]};
let step='startup',sent=0;
async function webhook(messages=[],statuses=[],signatureValid=true){
 const body=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:process.env.WHATSAPP_PHONE_ID},messages,statuses}}]}]});
 const signature=createHmac('sha256',process.env.WHATSAPP_APP_SECRET).update(body).digest('hex');
 const response=await fetch(base+'/api/webhook/whatsapp',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+(signatureValid?signature:'0'.repeat(64))},body,signal:AbortSignal.timeout(20000)});return{status:response.status,text:await response.text()};
}
async function api(path,body,cookie){const response=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const json=await response.json();assert.equal(response.status,path.endsWith('/approve')?202:200,'Unexpected HTTP status at '+step);return{json,response};}
(async()=>{
 try{
  assert.ok(process.env.WHATSAPP_APP_SECRET&&process.env.WHATSAPP_PHONE_ID);
  assert.equal(await db.whatsAppOutbox.count({where:{waId:{not:waId},state:{in:['PENDING','SENDING']}}}),0,'Do not claim another recipient\'s pending work');
  assert.equal((await chain.context()).chainId,31337);
  await db.whatsAppConversation.upsert({where:{waId},create:{waId,state:'MAIN_MENU',data:{language:'en'},expiresAt:new Date(Date.now()+86400000)},update:{state:'MAIN_MENU',data:{language:'en'},expiresAt:new Date(Date.now()+86400000)}});
  const worker=new WhatsAppWorker(db,{translate:async text=>text,send:async payload=>{
   assert.equal(payload.to,waId);sent++;const id='wamid.mock.http.'+randomUUID();
   const status=await webhook([],[{id,recipient_id:waId,status:'read',timestamp:String(Math.floor(Date.now()/1000))}]);assert.equal(status.status,200);return id;
  }});
  const content=[{type:'interactive',interactive:{type:'button_reply',button_reply:{id:'btn_harvest',title:'Log harvest'}}},{type:'text',text:{body:'Mustard'}},{type:'text',text:{body:'2.5 kg'}},{type:'text',text:{body:'yes'}}];
  for(const [index,value] of content.entries()){
   step='Signed webhook message '+(index+1);const message={id:'wamid.http.'+randomUUID(),from:waId,timestamp:String(Math.floor(Date.now()/1000)),...value};ids.push(message.id);
   if(index===0)assert.equal((await webhook([message],[],false)).status,401);
   assert.equal((await webhook([message])).status,200);assert.equal((await webhook([message])).status,200);assert.equal(await db.whatsAppInbox.count({where:{id:message.id}}),1);
   const claim=await worker.claimIncoming();assert.equal(claim.id,message.id);assert.equal(await worker.processIncoming(claim),true);record.steps.push(step);
  }
  step='Staged approval link and pending chain intent';
  const replies=await db.whatsAppOutbox.findMany({where:{inboxId:{in:ids}}});
  const approval=replies.map(row=>JSON.stringify(row.payload)).join('\n').match(/\/dashboard\/operations\/([a-z0-9]+)/);assert.ok(approval);
  const op=await db.chainOperation.findUniqueOrThrow({where:{id:approval[1]}});assert.equal(op.state,'AWAITING_SIGNATURE');assert.equal(JSON.parse(op.payload?JSON.stringify(op.payload):'{}').quantityGrams,2500);record.operationId=op.id;record.batchId=op.batchId;record.steps.push(step);
  step='Mock provider acceptance and actual signed receipt HTTP reconciliation';
  while(true){const claim=await worker.claimOutgoing();if(!claim)break;assert.equal(claim.item.waId,waId);assert.equal(await worker.sendOutgoing(claim),true);}
  assert.equal(sent,replies.length);assert.equal(await db.whatsAppOutbox.count({where:{inboxId:{in:ids},state:'READ'}}),replies.length);record.mockSendCount=sent;record.steps.push(step);
  step='Real HTTP login and actor wallet approval';
  const login=await api('/api/auth/login',{identifier:accounts.beekeeper.identifier,password:accounts.beekeeper.password});
  const cookie=login.response.headers.get('set-cookie').split(';')[0];
  const {json:auth}=await api('/api/operations/'+op.id+'/authorization',{},cookie);
  const signer=await chain.provider.getSigner(accounts.beekeeper.walletAddress),signature=await signer.signTypedData(auth.domain,auth.types,auth.message);
  await api('/api/operations/'+op.id+'/approve',{signature},cookie);
  for(let turn=0;turn<35;turn++){
   const row=await db.chainOperation.findUniqueOrThrow({where:{id:op.id}});if(row.state==='CONFIRMED'){record.transactionHash=row.txHash;break;}
   assert.ok(!['FAILED','NEEDS_REVIEW'].includes(row.state));await chainWorker.runOnce();await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.equal((await db.chainOperation.findUniqueOrThrow({where:{id:op.id}})).state,'CONFIRMED');
  const batch=await db.honeyBatch.findUniqueOrThrow({where:{id:op.batchId}});assert.equal(batch.quantity_grams,2500);assert.equal(batch.status,'HARVESTED');record.batchCode=batch.batchCode;record.steps.push(step);record.passed=true;
 }catch(error){record.failedAt=step;record.failureType=error.name;record.failureSummary=String(error.message).split('\n')[0];if(['number','boolean'].includes(typeof error.actual))record.actual=error.actual;process.exitCode=1;}
 finally{
  if(!record.passed){await db.whatsAppInbox.updateMany({where:{id:{in:ids}},data:{state:'DISCARDED'}});await db.whatsAppOutbox.updateMany({where:{inboxId:{in:ids}},data:{state:'DISCARDED'}});}
  fs.writeFileSync('docs/qa/whatsapp-http-acceptance.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({passed:record.passed,steps:record.steps.length,failedAt:record.failedAt,batchCode:record.batchCode}));chain.provider.destroy();await db.$disconnect();
 }
})();
