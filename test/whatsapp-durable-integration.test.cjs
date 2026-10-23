const {test,before,after,afterEach}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
require('dotenv').config({path:'.env.integration',override:true,quiet:true});
const database=new URL(process.env.DATABASE_URL||'');
if(database.hostname!=='127.0.0.1'||database.port!=='55432'||database.pathname!=='/pollinator_integration')throw new Error('Dedicated local integration database required');
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {PrismaClient}=require('@prisma/client'),{WhatsAppStore}=require('../src/lib/whatsapp/store.ts'),{WhatsAppWorker}=require('../src/lib/whatsapp/worker.ts');
const {whatsAppProcessing}=require('../src/lib/whatsapp/processing-context.ts'),{reviewWhatsApp}=require('../src/lib/whatsapp/review.ts');
const {payloadHash}=require('../src/lib/whatsapp/protocol.ts'),load=require('./helpers/load-ts.cjs');
const db=new PrismaClient(),store=new WhatsAppStore(db),phones=[];let serial=0;
const prefix='999'+String(Date.now()).slice(-7);
function phone(){const id=prefix+String(++serial).padStart(3,'0');phones.push(id);return id;}
function message(waId,text='hello',id='wamid.in.'+randomUUID()){return{id,from:waId,timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:text}};}
const clone=value=>JSON.parse(JSON.stringify(value));
const simple=async body=>{const m=body.entry[0].changes[0].value.messages[0],context=whatsAppProcessing.getStore();
 const session=await context.sessions.getSession(m.from);await context.sessions.setSession(m.from,'MAIN_MENU',{registration:{hivesCount:(session.data.registration?.hivesCount??0)+1}});
 await context.messenger.sendText(m.from,'Reply '+m.text.body);
};
function worker(handle=simple,send=async payload=>{assert.ok(payload.to.startsWith(prefix));return'wamid.out.'+randomUUID();}){return new WhatsAppWorker(db,{handle,send,translate:async text=>text});}
before(async()=>{assert.equal(await db.whatsAppInbox.count({where:{waId:{not:{startsWith:'999'}}}}),0,'Do not consume non-synthetic messages in integration tests');});
afterEach(async()=>{if(!phones.length)return;await db.whatsAppOutbox.updateMany({where:{waId:{in:phones}},data:{state:'DISCARDED'}});await db.whatsAppInbox.updateMany({where:{waId:{in:phones}},data:{state:'DISCARDED'}});});
after(async()=>{await db.$disconnect();});
async function stage(waId,text='hello',w=worker()){
 const m=message(waId,text);await store.accept([m],[]);const claim=await w.claimIncoming();assert.equal(claim.id,m.id);assert.equal(await w.processIncoming(claim),true);return{m,w,out:await db.whatsAppOutbox.findFirstOrThrow({where:{inboxId:m.id}})};
}
test('durable receipt is idempotent and conflicting IDs roll back the whole delivery',async()=>{
 const wa=phone(),a=message(wa);await store.accept([a],[]);await store.accept([clone(a)],[]);assert.equal(await db.whatsAppInbox.count({where:{id:a.id}}),1);
 const fresh=message(wa);await assert.rejects(store.accept([fresh,{...a,text:{body:'conflict'}}],[]));assert.equal(await db.whatsAppInbox.count({where:{id:fresh.id}}),0);
});
test('sender ordering survives parallel workers while another sender can progress',async()=>{
 const wa=phone(),other=phone(),a=message(wa),b=message(wa),c=message(other);await store.accept([a,b,c],[]);
 const one=worker(),two=worker(),first=await one.claimIncoming(),second=await two.claimIncoming();assert.equal(first.id,a.id);assert.equal(second.id,c.id);
 assert.equal(await two.claimIncoming(),null);await one.processIncoming(first);const next=await two.claimIncoming();assert.equal(next.id,b.id);await two.processIncoming(next);
 assert.equal((await db.whatsAppConversation.findUniqueOrThrow({where:{waId:wa}})).data.registration.hivesCount,2);
});
test('transaction failure rolls back registration, session and staged replies before replay',async()=>{
 const wa=phone(),m=message(wa),handle=async body=>{const context=whatsAppProcessing.getStore();await context.db.beekeeper.create({data:{phone:'+'+wa,name:'Rollback synthetic'}});await simple(body);throw new Error('INTERRUPTED_AFTER_STAGE');};
 await store.accept([m],[]);const bad=worker(handle),claim=await bad.claimIncoming();assert.equal(await bad.processIncoming(claim),false);
 assert.equal(await db.beekeeper.count({where:{phone:'+'+wa}}),0);assert.equal(await db.whatsAppConversation.count({where:{waId:wa}}),0);assert.equal(await db.whatsAppOutbox.count({where:{inboxId:m.id}}),0);
 await db.whatsAppInbox.update({where:{id:m.id},data:{nextAttemptAt:new Date(0)}});const recovered=worker(),again=await recovered.claimIncoming();assert.equal(again.attempts,2);assert.equal(await recovered.processIncoming(again),true);assert.equal(await db.whatsAppOutbox.count({where:{inboxId:m.id}}),1);
});
test('an expired inbound lease is reclaimed and the stale token cannot process it',async()=>{
 const wa=phone(),m=message(wa);await store.accept([m],[]);const one=worker(),old=await one.claimIncoming();await db.whatsAppInbox.update({where:{id:m.id},data:{leaseUntil:new Date(0)}});
 const two=worker(),current=await two.claimIncoming();assert.notEqual(old.leaseToken,current.leaseToken);assert.equal(await one.processIncoming(old),false);assert.equal(await two.processIncoming(current),true);
 assert.equal(await db.whatsAppOutbox.count({where:{inboxId:m.id}}),1);
});
test('provider acceptance is separate from delivery; early and out-of-order statuses are reconciled',async()=>{
 const wa=phone(),providerId='wamid.early.'+randomUUID(),w=worker(simple,async()=>providerId);const {out}=await stage(wa,'early',w);
 const event=status=>({id:providerId,recipient_id:wa,timestamp:String(Math.floor(Date.now()/1000)),status});
 await store.accept([],[event('read')]);assert.equal((await db.whatsAppOutbox.findUniqueOrThrow({where:{id:out.id}})).state,'PENDING');
 const claim=await w.claimOutgoing();assert.equal(await w.sendOutgoing(claim),true);assert.equal((await db.whatsAppOutbox.findUniqueOrThrow({where:{id:out.id}})).state,'READ');
 await store.accept([],[event('sent'),event('delivered'),event('failed')]);assert.equal((await db.whatsAppOutbox.findUniqueOrThrow({where:{id:out.id}})).state,'READ');
 assert.equal((await db.whatsAppSendAttempt.findUniqueOrThrow({where:{id:claim.attemptId}})).state,'READ');
});
test('uncertain send stays UNKNOWN and blocks automatic resend and later replies',async()=>{
 let sends=0;const wa=phone(),w=worker(simple,async()=>{sends++;throw new Error('Timeout after possible provider receipt');});const {out}=await stage(wa,'one',w);await stage(wa,'two',w);
 const firstAttempt=await w.claimOutgoing();await w.sendOutgoing(firstAttempt);assert.equal((await db.whatsAppOutbox.findUniqueOrThrow({where:{id:out.id}})).state,'UNKNOWN');
 await w.recoverSends();assert.equal(await w.claimOutgoing(),null);assert.equal(sends,1);
 await assert.rejects(reviewWhatsApp(db,'test-admin',{target:'outbox',id:out.id,action:'RETRY',reason:'Operator test review without acknowledgement'}));
 await reviewWhatsApp(db,'test-admin',{target:'outbox',id:out.id,action:'RETRY',reason:'Synthetic recipient checked; explicit retry accepted',acknowledgeDuplicateRisk:true});
 const retry=await w.claimOutgoing();assert.equal(retry.item.id,out.id);assert.notEqual(retry.attemptId,firstAttempt.attemptId);assert.equal(await db.whatsAppSendAttempt.count({where:{outboxId:out.id}}),2);
 assert.equal(await db.whatsAppReviewEvent.count({where:{targetId:out.id}}),1);
});
test('worker loss after claiming a send becomes UNKNOWN without issuing a new attempt',async()=>{
 const wa=phone(),{w,out}=await stage(wa);const claim=await w.claimOutgoing();await db.whatsAppOutbox.update({where:{id:out.id},data:{leaseUntil:new Date(0)}});await db.whatsAppSendAttempt.update({where:{id:claim.attemptId},data:{leaseUntil:new Date(0)}});
 await w.recoverSends();assert.equal(await w.claimOutgoing(),null);assert.equal((await db.whatsAppSendAttempt.findUniqueOrThrow({where:{id:claim.attemptId}})).state,'UNKNOWN');
});
test('parallel senders keep one attempt per reply and preserve per-recipient ordering',async()=>{
 const wa=phone(),other=phone(),one=await stage(wa,'first'),two=await stage(wa,'second'),three=await stage(other,'other');
 const a=worker(),b=worker(),claims=await Promise.all([a.claimOutgoing(),b.claimOutgoing()]);
 assert.deepEqual(claims.map(c=>c.item.id).sort(),[one.out.id,three.out.id].sort());assert.equal(await a.claimOutgoing(),null);
 for(const claim of claims)await a.sendOutgoing(claim);
 assert.equal((await b.claimOutgoing()).item.id,two.out.id);assert.equal(await db.whatsAppSendAttempt.count({where:{outboxId:one.out.id}}),1);
});

test('a stale outgoing worker cannot send after recovery and operator retry',async()=>{
 let sends=0;const wa=phone(),w=worker(simple,async()=>{sends++;return'wamid.fresh.'+randomUUID();}),{out}=await stage(wa,'stale',w);
 const stale=await w.claimOutgoing();await db.whatsAppOutbox.update({where:{id:out.id},data:{leaseUntil:new Date(0)}});
 await db.whatsAppSendAttempt.update({where:{id:stale.attemptId},data:{leaseUntil:new Date(0)}});
 assert.equal(await w.sendOutgoing(stale),false);await w.recoverSends();
 await reviewWhatsApp(db,'test-admin',{target:'outbox',id:out.id,action:'RETRY',reason:'Synthetic stale worker explicitly reviewed for retry',acknowledgeDuplicateRisk:true});
 const current=await w.claimOutgoing();assert.equal(await w.sendOutgoing(stale),false);assert.equal(sends,0);
 assert.equal(await w.sendOutgoing(current),true);assert.equal(sends,1);
});
test('a lost database acknowledgement retries receipt storage without another provider send or delivery downgrade',async t=>{
 const wa=phone(),providerId='wamid.commit.'+randomUUID();let sends=0;
 const w=worker(simple,async()=>{sends++;return providerId;}),{out}=await stage(wa,'commit',w),claim=await w.claimOutgoing();
 const original=db.$transaction.bind(db);let inject=true;
 db.$transaction=async(...args)=>{const result=await original(...args);if(inject){inject=false;await store.accept([],[{id:providerId,recipient_id:wa,timestamp:String(Math.floor(Date.now()/1000)),status:'read'}]);throw new Error('LOST_COMMIT_ACK');}return result;};
 t.after(()=>{db.$transaction=original;});
 assert.equal(await w.sendOutgoing(claim),true);db.$transaction=original;
 assert.equal(sends,1);assert.equal((await db.whatsAppOutbox.findUniqueOrThrow({where:{id:out.id}})).state,'READ');assert.equal((await db.whatsAppSendAttempt.findUniqueOrThrow({where:{id:claim.attemptId}})).state,'READ');
});
test('corrupt inbox and redirected outbox content cannot be processed or transmitted',async()=>{
 const wa=phone(),m=message(wa);await store.accept([m],[]);const w=worker();await db.whatsAppInbox.update({where:{id:m.id},data:{payload:{...m,text:{body:'tampered'}}}});
 assert.equal(await w.processIncoming(await w.claimIncoming()),false);assert.equal(await db.whatsAppConversation.count({where:{waId:wa}}),0);
 await db.whatsAppInbox.update({where:{id:m.id},data:{state:'DISCARDED'}});
 let sends=0;const safe=worker(simple,async()=>{sends++;return'wamid.never';}),{out}=await stage(wa,'safe',safe);
 const altered={...out.payload,to:phone()};await db.whatsAppOutbox.update({where:{id:out.id},data:{payload:altered,payloadHash:payloadHash(altered)}});
 const claim=await safe.claimOutgoing();assert.equal(await safe.sendOutgoing(claim),false);assert.equal(sends,0);assert.equal((await db.whatsAppOutbox.findUniqueOrThrow({where:{id:out.id}})).state,'FAILED');
});
test('the real registration handler commits profile and replies together using the database session',async()=>{
 const wa=phone(),handler=load('src/lib/whatsapp/handler.ts',{
  './gemini':{analyzeIncomingText:async()=>({detected_language:'en',intent:'REGISTRATION'}),generateOnboardingResponse:async()=>({response:'Register',ready_to_register:false})},
  '../blockchain':{},'../varroa-detector':{},
 }),w=worker(handler.handleIncomingMessage);
 for(const text of ['register','Synthetic durable keeper','Local QA','3','Apis mellifera'])await stage(wa,text,w);
 const keeper=await db.beekeeper.findUniqueOrThrow({where:{phone:'+'+wa}});assert.equal(keeper.hivesCount,3);assert.equal(keeper.wallet,null);
 assert.equal((await db.whatsAppConversation.findUniqueOrThrow({where:{waId:wa}})).state,'MAIN_MENU');
 const replies=await db.whatsAppOutbox.findMany({where:{waId:wa}});assert.ok(replies.some(row=>JSON.stringify(row.payload).includes('wallet has not been enrolled')));
});


test('a gateway failure through the real client persists UNKNOWN and blocks a second send',async()=>{
 const {WhatsAppClient}=require('../src/lib/whatsapp/client.ts');let sends=0;
 const client=new WhatsAppClient(async()=>{sends++;return new Response('Synthetic gateway timeout',{status:504});},async text=>text);
 const wa=phone(),w=worker(simple,payload=>client.sendPayload(payload)),{out}=await stage(wa,'gateway failure',w);
 const claim=await w.claimOutgoing();assert.equal(await w.sendOutgoing(claim),false);
 assert.equal((await db.whatsAppOutbox.findUniqueOrThrow({where:{id:out.id}})).state,'UNKNOWN');
 assert.equal((await db.whatsAppSendAttempt.findUniqueOrThrow({where:{id:claim.attemptId}})).state,'UNKNOWN');
 await w.recoverSends();assert.equal(await w.claimOutgoing(),null);assert.equal(sends,1);
});
