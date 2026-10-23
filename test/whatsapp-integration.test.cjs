const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto'),fs=require('node:fs');
require('dotenv').config({path:'.env.integration',override:true,quiet:true});
const database=new URL(process.env.DATABASE_URL||'');
if(database.hostname!=='127.0.0.1'||database.port!=='55432'||database.pathname!=='/pollinator_integration'||process.env.BLOCKCHAIN_NETWORK!=='local'||process.env.LOCAL_RPC_URL!=='http://127.0.0.1:8545')throw new Error('Dedicated local PostgreSQL and EVM fixtures required');
process.env.ADMIN_API_KEY=randomBytes(32).toString('hex');process.env.APP_ORIGIN='http://127.0.0.1:3100';
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const load=require('./helpers/load-ts.cjs'),{ethers}=require('ethers'),{prisma:db}=require('../src/lib/db.ts');
const {OperationService}=require('../src/lib/chain/operations.ts'),{ChainWorker}=require('../src/lib/chain/worker.ts'),{ChainTransport}=require('../src/lib/chain/transport.ts');
const {FORWARD_TYPES}=require('../src/lib/chain/protocol.ts');
test('enrolled WhatsApp farmer signs in and the harvest conversation reaches the real batch API, PostgreSQL intent and actor-approved EVM registration', {timeout:45000},async t=>{
 const chain=new ChainTransport(),service=new OperationService(db,chain),worker=new ChainWorker(db,chain);
 t.after(async()=>{chain.provider.destroy();await db.$disconnect();});
 const context=await chain.context();assert.equal(context.chainId,31337);
 const manifest=JSON.parse(fs.readFileSync('.local-data/integration-chain.json','utf8'));assert.equal(context.genesisHash,manifest.genesisHash);
 const registry=new ethers.Contract(context.registryAddress,require('../artifacts/contracts/HoneyChain.sol/HoneyChain.json').abi,await chain.provider.getSigner(0));
 const wallet=ethers.Wallet.createRandom(),run=randomUUID();await(await registry.grantRole(ethers.id('BEEKEEPER_ROLE'),wallet.address)).wait();
 const phone='+999'+String(Date.now()).slice(-10);const farmer=await db.beekeeper.create({data:{phone,name:'Synthetic WhatsApp integration',region:'Local QA',wallet:null}});
 const {enrollBeekeeperAccount}=require('../src/lib/beekeeper-enrollment.ts'),{hashPassword}=require('../src/lib/password.ts'),{authenticatePassword,accountSession}=require('../src/lib/account-auth.ts');
 const password=randomBytes(24).toString('hex'),account=await enrollBeekeeperAccount(db,chain,{identifier:farmer.phone,beekeeperId:farmer.id,walletAddress:wallet.address,passwordHash:await hashPassword(password)});
 const authenticated=await authenticatePassword({identifier:farmer.phone,password},identifier=>db.dashboardAccount.findUnique({where:{identifier}}));assert.equal(authenticated.id,account.id);assert.equal((await db.beekeeper.findUniqueOrThrow({where:{id:farmer.id}})).wallet,wallet.address.toLowerCase());
 const metadata=[];
 const route=load('src/app/api/batch/route.ts',{'@/lib/db':{prisma:db},'@/lib/auth':{getSession:async()=>null},
  '@/lib/env':require('../src/lib/env.ts'),'@/lib/access-policy':require('../src/lib/access-policy.ts'),
  '@/lib/chain/protocol':require('../src/lib/chain/protocol.ts'),'@/lib/chain/http':require('../src/lib/chain/http.ts'),
  '@/lib/chain/operations':{operationService:service},'@/lib/ipfs':{uploadBatchMetadata:async value=>{metadata.push(value);return{cid:'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',hash:ethers.sha256(ethers.toUtf8Bytes(JSON.stringify(value)))}}}});
 let session={state:'MAIN_MENU',data:{language:'en'}},apiResult,apiCalls=0;const replies=[],seen=new Set();
 const originalFetch=global.fetch;
 global.fetch=async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:3100/api/batch');apiCalls++;
  const response=await route.POST(new Request(url,options));apiResult=await response.clone().json();return response;
 };
 t.after(()=>{global.fetch=originalFetch;});
 const handler=load('src/lib/whatsapp/handler.ts',{'../db':{prisma:db},'../identity':require('../src/lib/identity.ts'),
  '../app-origin':{serverAppOrigin:()=>process.env.APP_ORIGIN},'../blockchain':{},'../varroa-detector':{},
  './fsm':{ConversationState:new Proxy({},{get:(_o,key)=>key}),fsm:{getSession:async()=>session,
   setSession:async(_id,state,data)=>{session={state,data};},updateSessionData:async(_id,value)=>{session.data={...session.data,...value};},
   isDuplicateMessage:async id=>{if(seen.has(id))return true;seen.add(id);return false;}}},
  './gemini':{analyzeIncomingText:async()=>({detected_language:'en',intent:'HARVEST_MARKET'})},
  './client':{whatsapp:{markAsRead:async()=>{},sendText:async(_to,text)=>replies.push(text),sendButtons:async(_to,text)=>replies.push(text),sendList:async()=>{}}}});
 const send=async(text,id=randomUUID())=>handler.handleIncomingMessage({entry:[{changes:[{value:{messages:[{id,from:phone.slice(1),type:'text',text:{body:text}}]}}]}]});
 await send('log harvest');assert.equal(session.state,'HARVEST_TYPE');await send('Mustard');await send('2.5 kg');
 const draft={...session.data.harvest_draft};assert.equal(draft.quantityGrams,2500);assert.equal(session.state,'HARVEST_CONFIRM');
 const confirmationSession=structuredClone(session);
 const confirmationId=randomUUID();await send('yes',confirmationId);
 assert.ok(apiResult?.operationId,'Conversation must reach the batch API successfully');assert.equal(apiCalls,1);assert.equal(metadata.length,1);assert.equal(metadata[0].quantityGrams,2500);
 assert.ok(replies.some(text=>text.includes('Blockchain confirmation is pending.')));assert.ok(replies.some(text=>text.includes('/dashboard/operations/'+apiResult.operationId)));
 assert.ok(!replies.some(text=>text.includes('registered on blockchain!')));assert.equal(session.state,'MAIN_MENU');
 await send('yes',confirmationId);assert.equal(apiCalls,1);
 // Replay the same persisted draft through the durable worker and interrupt it after the API saved its intent.
 const {WhatsAppWorker}=require('../src/lib/whatsapp/worker.ts'),{WhatsAppStore}=require('../src/lib/whatsapp/store.ts');
 const waId=phone.slice(1),inbound={id:'wamid.durable.'+run,from:waId,timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:'yes'}};
 await db.whatsAppConversation.create({data:{waId,state:confirmationSession.state,data:confirmationSession.data,expiresAt:new Date(Date.now()+86400000)}});
 await new WhatsAppStore(db).accept([inbound],[]);
 t.after(async()=>{await db.whatsAppInbox.updateMany({where:{waId},data:{state:'DISCARDED'}});await db.whatsAppOutbox.updateMany({where:{waId},data:{state:'DISCARDED'}});});
 let interrupted=true;
 const durable=new WhatsAppWorker(db,{handle:async value=>{await handler.handleIncomingMessage(value);if(interrupted){interrupted=false;throw new Error('INTERRUPTED_AFTER_API_COMMIT');}},translate:async text=>text,send:async()=>{throw new Error('Provider sends prohibited in this fixture');}});
 const first=await durable.claimIncoming();assert.equal(first.id,inbound.id);assert.equal(await durable.processIncoming(first),false);
 assert.equal(await db.whatsAppOutbox.count({where:{inboxId:inbound.id}}),0);
 assert.equal((await db.whatsAppConversation.findUniqueOrThrow({where:{waId}})).state,'HARVEST_CONFIRM');
 await db.whatsAppInbox.update({where:{id:inbound.id},data:{nextAttemptAt:new Date(0)}});
 assert.equal(await durable.processIncoming(await durable.claimIncoming()),true);
 assert.equal(apiCalls,3);assert.equal(metadata.length,1);assert.equal(await db.chainOperation.count({where:{initiatedBy:'whatsapp:'+farmer.id}}),1);
 assert.equal((await db.whatsAppConversation.findUniqueOrThrow({where:{waId}})).state,'MAIN_MENU');
 const staged=await db.whatsAppOutbox.findMany({where:{inboxId:inbound.id}});assert.ok(staged.some(row=>JSON.stringify(row.payload).includes('/dashboard/operations/'+apiResult.operationId)));
 const op=await db.chainOperation.findUniqueOrThrow({where:{id:apiResult.operationId}});assert.equal(op.state,'AWAITING_SIGNATURE');
 assert.equal(await registry.batchExists(ethers.id(apiResult.batchCode)),false);
 const actor=accountSession(authenticated);assert.equal(actor.beekeeperId,farmer.id);
 const auth=await service.authorization(op.id,actor);await service.approve(op.id,actor,await wallet.signTypedData(auth.domain,FORWARD_TYPES,auth.message));
 for(let attempt=0;attempt<20;attempt++){
  const current=await db.chainOperation.findUniqueOrThrow({where:{id:op.id}});if(current.state==='CONFIRMED')break;
  assert.ok(!['FAILED','NEEDS_REVIEW'].includes(current.state),current.lastError||current.state);
  await db.chainOperation.update({where:{id:op.id},data:{nextAttemptAt:new Date(0)}});await worker.runOnce();
 }
 assert.equal((await db.chainOperation.findUniqueOrThrow({where:{id:op.id}})).state,'CONFIRMED');
 assert.equal(await registry.batchExists(ethers.id(apiResult.batchCode)),true);
 const row=await db.honeyBatch.findUniqueOrThrow({where:{id:op.batchId}});assert.equal(row.quantity_grams,2500);assert.equal(row.status,'HARVESTED');assert.ok(row.txHash);
 assert.equal(await chain.provider.getBalance(wallet.address),0n);
});
