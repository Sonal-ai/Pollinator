const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
require('dotenv').config({path:'.env.integration',override:true,quiet:true});
const database=new URL(process.env.DATABASE_URL||'');
if(database.hostname!=='127.0.0.1'||database.port!=='55432'||database.pathname!=='/pollinator_integration'||process.env.BLOCKCHAIN_NETWORK!=='local'||process.env.LOCAL_RPC_URL!=='http://127.0.0.1:8545')throw new Error('Dedicated localhost fixtures required');
const {prisma:db}=require('../build/workers/lib/db.js');
const {ChainTransport}=require('../build/workers/lib/chain/transport.js'),{ChainWorker}=require('../build/workers/lib/chain/worker.js');
const accounts=JSON.parse(fs.readFileSync('.local-data/local-demo-accounts.json')),chain=new ChainTransport(),worker=new ChainWorker(db,chain);
const base='http://127.0.0.1:3100',cookies={},result={checkedAt:new Date().toISOString(),scope:'Actual Windows production standalone HTTP app, real local PostgreSQL/Redis/EVM and configured IPFS; synthetic accounts/data and fixture wallet signing',steps:[],passed:false,uiInspected:false,externalWalletInspected:false};
let currentStep='startup';
async function step(name,action){currentStep=name;await action();result.steps.push({name,passed:true});}
async function request(path,{role,body,method=body===undefined?'GET':'POST',key,origin=base}={}){
 assert.ok(path.startsWith('/'));const headers={Origin:origin,...(role?{Cookie:cookies[role]}:{}),...(key?{'Idempotency-Key':key}:{})};
 const multipart=body instanceof FormData;if(body!==undefined&&!multipart)headers['Content-Type']='application/json';
 const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:multipart?body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(60000)});
 const text=await response.text();let json;try{json=JSON.parse(text);}catch{}
 return{status:response.status,headers:response.headers,json,text};
}
function status(response,expected){assert.equal(response.status,expected,'Unexpected HTTP status during '+currentStep);return response.json;}
async function finish(role,prepared){
 assert.ok(prepared.operationId);const id=prepared.operationId;
 const auth=status(await request('/api/operations/'+id+'/authorization',{role,body:{}}),200);
 const signer=await chain.provider.getSigner(accounts[role].walletAddress);
 assert.equal(auth.message.from.toLowerCase(),accounts[role].walletAddress.toLowerCase());
 const signature=await signer.signTypedData(auth.domain,auth.types,auth.message);
 status(await request('/api/operations/'+id+'/approve',{role,body:{signature}}),202);
 for(let turn=0;turn<35;turn++){
  const row=await db.chainOperation.findUniqueOrThrow({where:{id}});if(row.state==='CONFIRMED'){result.steps.push({name:'Confirmed '+row.kind,passed:true,operationId:id,transactionHash:row.txHash});return row;}
  assert.ok(!['FAILED','NEEDS_REVIEW'].includes(row.state),'Chain operation needs review during '+currentStep);
  await worker.runOnce();
  await new Promise(resolve=>setTimeout(resolve,250));
 }throw new Error('Fixture worker did not confirm operation');
}
(async()=>{
 try{
  const context=await chain.context();assert.equal(context.chainId,31337);result.chainContext=context;
  await step('Readiness, liveness and anonymous denial',async()=>{status(await request('/api/health/live'),200);status(await request('/api/health/ready'),200);status(await request('/api/batch'),401);});
  await step('Real password login for all six roles with secure HttpOnly cookies',async()=>{
   for(const role of ['beekeeper','processor','lab','distributor','retailer','admin']){const response=await request('/api/auth/login',{body:{identifier:accounts[role].identifier,password:accounts[role].password}});status(response,200);const cookie=response.headers.get('set-cookie');assert.ok(cookie&&/HttpOnly/i.test(cookie)&&/Secure/i.test(cookie)&&/SameSite=Lax/i.test(cookie));cookies[role]=cookie.split(';')[0];}
   status(await request('/api/auth/login',{body:{identifier:accounts.beekeeper.identifier,password:'synthetic-wrong-password'}}),401);
   status(await request('/api/auth/login',{body:{identifier:accounts.beekeeper.identifier,password:accounts.beekeeper.password},origin:'https://foreign.invalid'}),403);
   status(await request('/api/whatsapp/operations',{role:'beekeeper'}),403);status(await request('/api/whatsapp/operations',{role:'admin'}),200);
  });
  let batchCode,batchId,create,labels;
  await step('HTTP harvest, pending signature, idempotency and role boundaries',async()=>{
   const body={beekeeperId:accounts.beekeeper.beekeeperId,honeyType:'Synthetic HTTP demonstration',quantityGrams:25000,hivesHarvested:4,harvestDate:new Date(Date.now()-60000).toISOString(),region:'Local prototype'},key='http-create-'+randomUUID();
   create=status(await request('/api/batch',{role:'beekeeper',body,key}),202);batchCode=create.batchCode;batchId=create.batchId;result.batchCode=batchCode;result.batchId=batchId;
   assert.equal(create.operation.state,'AWAITING_SIGNATURE');
   assert.equal(status(await request('/api/batch',{role:'beekeeper',body,key}),202).operationId,create.operationId);
   status(await request('/api/batch',{role:'beekeeper',body:{...body,quantityGrams:1},key}),409);
   status(await request('/api/batch/'+batchCode,{role:'lab'}),404);
   assert.ok([403,404].includes((await request('/api/operations/'+create.operationId+'/authorization',{role:'processor',body:{}})).status));
   await finish('beekeeper',create);
   const details=status(await request('/api/batch/'+batchCode,{role:'beekeeper'}),200);assert.equal(details.batch.status,'HARVESTED');assert.ok(details.chainRecord);
  });
  async function transfer(role,toRole,newStatus){const prepared=status(await request('/api/custody',{role,key:'http-custody-'+randomUUID(),body:{batchId,toAddress:accounts[toRole].walletAddress,newStatus,note:'Synthetic HTTP verification'}}),202);await finish(role,prepared);}
  await step('Processor custody and processing, then independent lab custody',async()=>{await transfer('beekeeper','processor','HARVESTED');await transfer('processor','processor','PROCESSED');await transfer('processor','lab','PROCESSED');});
  await step('Real lab PDF upload and signed commitment',async()=>{
   const form=new FormData();form.append('batchId',batchId);form.append('file',new Blob([Buffer.from('%PDF-1.4\n% Synthetic QA only; not a real laboratory report.\n%%EOF\n')],{type:'application/pdf'}),'synthetic-qa-report.pdf');
   const prepared=status(await request('/api/certificate',{role:'lab',key:'http-lab-'+randomUUID(),body:form}),202);await finish('lab',prepared);await transfer('lab','processor','LAB_VERIFIED');
  });
  await step('Packaging bounds, real IPFS metadata and stable serialized reprints',async()=>{
   status(await request('/api/batch/'+batchCode+'/package',{role:'processor',key:'http-excess-'+randomUUID(),body:{jarCount:11,jarSizeGrams:2500}}),400);
   const prepared=status(await request('/api/batch/'+batchCode+'/package',{role:'processor',key:'http-package-'+randomUUID(),body:{jarCount:10,jarSizeGrams:2500}}),202);await finish('processor',prepared);
   const body={batchCode,jarCount:10,jarSizeGrams:2500};labels=status(await request('/api/qr',{role:'processor',body}),201).qrTokens;assert.equal(labels.length,10);
   const reprinted=status(await request('/api/qr',{role:'processor',body}),201).qrTokens;assert.deepEqual(reprinted.map(x=>x.verifyUrl),labels.map(x=>x.verifyUrl));
  });
  await step('Distribution and retail custody',async()=>{await transfer('processor','distributor','IN_DISTRIBUTION');await transfer('distributor','retailer','AT_RETAIL');});
  await step('Public consumer page verifies matching evidence over actual HTTP',async()=>{
   const url=new URL(labels[0].verifyUrl);assert.equal(url.origin,base);const response=await request(url.pathname+url.search);assert.equal(response.status,200);assert.ok(response.text.includes('The recorded evidence matches.'));result.serializedConsumerPath=url.pathname+url.search;
  });
  await step('Recall withdraws labels before chain approval and confirms on chain',async()=>{
   const prepared=status(await request('/api/batch/'+batchCode+'/recall',{role:'admin',key:'http-recall-'+randomUUID(),body:{reason:'Synthetic HTTP acceptance recall; not a real product'}}),202);
   const before=await db.honeyBatch.findUniqueOrThrow({where:{id:batchId}});assert.equal(before.recalled,true);assert.equal(before.recallTxHash,null);assert.equal(await db.qRToken.count({where:{batchId,active:true}}),0);
   const immediate=await request(result.serializedConsumerPath);assert.ok(immediate.text.includes('This batch has been recalled.'));
   await finish('admin',prepared);const after=await db.honeyBatch.findUniqueOrThrow({where:{id:batchId}});assert.ok(after.recallTxHash);
   const page=await request(result.serializedConsumerPath);assert.ok(page.text.includes('This batch has been recalled.'));
  });
  result.passed=true;
 }catch(error){result.failedAt=currentStep;result.failureType=error.name;result.failureSummary=String(error.message).split('\n')[0];if(['number','boolean'].includes(typeof error.actual))result.actual=error.actual;if(['number','boolean'].includes(typeof error.expected))result.expected=error.expected;process.exitCode=1;}
 finally{fs.writeFileSync('docs/qa/main-http-acceptance.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,passedSteps:result.steps.length,failedAt:result.failedAt,batchCode:result.batchCode}));chain.provider.destroy();await db.$disconnect();}
})();
