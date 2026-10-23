import {randomUUID} from 'node:crypto';
import {Prisma,PrismaClient,type WhatsAppInbox,type WhatsAppOutbox} from '@prisma/client';
import {prisma} from '../db';
import {handleIncomingMessage} from './handler';
import {WhatsAppClient,WhatsAppDeliveryError,whatsapp} from './client';
import {ConversationState,type Session,type SessionData} from './fsm';
import {whatsAppProcessing} from './processing-context';
import {incomingMessage,payloadHash,validateOutgoing} from './protocol';
import {WhatsAppStore} from './store';

const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
type Handler=typeof handleIncomingMessage;
type Dependencies={handle?:Handler;send?:(payload:unknown)=>Promise<string|null>;translate?:(text:string,lang:Parameters<WhatsAppClient['sendText']>[2])=>Promise<string>};
export class WhatsAppWorker {
 readonly store:WhatsAppStore;
 constructor(readonly db:PrismaClient=prisma,private readonly dependencies:Dependencies={}){this.store=new WhatsAppStore(db);}

 async claimIncoming():Promise<WhatsAppInbox|null>{
  const now=new Date(),token=randomUUID(),until=new Date(now.getTime()+180000);
  return this.db.$transaction(async tx=>{
   await tx.whatsAppInbox.updateMany({where:{state:'PROCESSING',attempts:{gte:5},leaseUntil:{lte:now}},data:{state:'FAILED',lastError:'PROCESSING_REQUIRES_REVIEW',leaseToken:null,leaseUntil:null}});
   const rows=await tx.$queryRaw<WhatsAppInbox[]>(Prisma.sql`
    UPDATE "WhatsAppInbox" SET "state"='PROCESSING',"attempts"="attempts"+1,"leaseToken"=${token},"leaseUntil"=${until},"updatedAt"=${now}
    WHERE "id"=(SELECT i."id" FROM "WhatsAppInbox" i
     WHERE i."attempts"<5 AND ((i."state"='PENDING' AND i."nextAttemptAt"<=${now}) OR (i."state"='PROCESSING' AND i."leaseUntil"<=${now}))
     AND NOT EXISTS(SELECT 1 FROM "WhatsAppInbox" earlier WHERE earlier."waId"=i."waId" AND earlier."sequence"<i."sequence" AND earlier."state" NOT IN ('PROCESSED','DISCARDED'))
     ORDER BY i."sequence" LIMIT 1 FOR UPDATE OF i SKIP LOCKED) RETURNING *`);
   return rows[0]??null;
  },{maxWait:3000,timeout:10000});
 }

 async processIncoming(item:WhatsAppInbox){
  try{
   return await this.db.$transaction(async tx=>{
    const rows=await tx.$queryRaw<WhatsAppInbox[]>(Prisma.sql`SELECT * FROM "WhatsAppInbox" WHERE "id"=${item.id} AND "state"='PROCESSING' AND "leaseToken"=${item.leaseToken} FOR UPDATE`);
    if(!rows[0])return false;
    const owned=rows[0],message=incomingMessage.parse(owned.payload);
    if(payloadHash(owned.payload)!==owned.payloadHash||message.id!==owned.id||message.from!==owned.waId)throw new Error('INBOX_CONTENT_MISMATCH');
    const saved=await tx.whatsAppConversation.findUnique({where:{waId:item.waId}});
    let session:Session={state:ConversationState.IDLE,data:{}};
    if(saved&&saved.expiresAt>item.createdAt){
     if(!Object.values(ConversationState).includes(saved.state as ConversationState)||typeof saved.data!=='object'||saved.data===null||Array.isArray(saved.data))throw new Error('SESSION_CORRUPT');
     session={state:saved.state as ConversationState,data:saved.data as SessionData};
    }
    const outputs:unknown[]=[];
    const check=(waId:string)=>{if(waId!==item.waId)throw new Error('SESSION_IDENTITY_MISMATCH');};
    const messenger=new WhatsAppClient(undefined,this.dependencies.translate,async payload=>{
     validateOutgoing(payload,item.waId);if(outputs.length>=16)throw new Error('TOO_MANY_REPLIES');outputs.push(payload);
    });
    await whatsAppProcessing.run({db:tx,messenger,sessions:{
     getSession:async waId=>{check(waId);return structuredClone(session);},
     setSession:async(waId,state,data={})=>{check(waId);session={state,data:structuredClone(data)};},
     updateSessionData:async(waId,update)=>{check(waId);session={...session,data:{...session.data,...structuredClone(update)}};},
     isDuplicateMessage:async id=>{if(id!==item.id)throw new Error('MESSAGE_IDENTITY_MISMATCH');return false;},
    }},()=> (this.dependencies.handle??handleIncomingMessage)({entry:[{changes:[{value:{messages:[message]}}]}]}));
    const expiresAt=new Date(item.createdAt.getTime()+86400000);
    await tx.whatsAppConversation.upsert({where:{waId:item.waId},create:{waId:item.waId,state:session.state,data:json(session.data),expiresAt},update:{state:session.state,data:json(session.data),expiresAt}});
    for(const output of outputs)await tx.whatsAppOutbox.create({data:{inboxId:item.id,waId:item.waId,payload:json(output),payloadHash:payloadHash(output)}});
    await tx.whatsAppInbox.update({where:{id:item.id},data:{state:'PROCESSED',processedAt:new Date(),leaseToken:null,leaseUntil:null,lastError:null}});
    return true;
   },{maxWait:3000,timeout:150000});
  }catch{
   await this.db.whatsAppInbox.updateMany({where:{id:item.id,state:'PROCESSING',leaseToken:item.leaseToken},data:{
    state:item.attempts>=5?'FAILED':'PENDING',lastError:'PROCESSING_UNAVAILABLE',leaseToken:null,leaseUntil:null,
    nextAttemptAt:new Date(Date.now()+Math.min(300000,2000*2**item.attempts)),
   }});
   return false;
  }
 }

 async recoverSends(){
  const now=new Date();
  // A crash might have happened after Meta received the request. Never auto-resend it.
  await this.db.$transaction(async tx=>{
   await tx.whatsAppSendAttempt.updateMany({where:{state:'SENDING',leaseUntil:{lte:now}},data:{state:'UNKNOWN',lastError:'SEND_RESULT_UNKNOWN'}});
   await tx.whatsAppOutbox.updateMany({where:{state:'SENDING',leaseUntil:{lte:now}},data:{state:'UNKNOWN',lastError:'SEND_RESULT_UNKNOWN',leaseUntil:null}});
  });
 }

 async claimOutgoing():Promise<{item:WhatsAppOutbox;attemptId:string}|null>{
  const now=new Date(),until=new Date(now.getTime()+60000);
  return this.db.$transaction(async tx=>{
   const rows=await tx.$queryRaw<WhatsAppOutbox[]>(Prisma.sql`
    SELECT o.* FROM "WhatsAppOutbox" o WHERE o."state"='PENDING' AND o."nextAttemptAt"<=${now}
    AND NOT EXISTS(SELECT 1 FROM "WhatsAppOutbox" earlier WHERE earlier."waId"=o."waId" AND earlier."sequence"<o."sequence"
     AND earlier."state" IN ('PENDING','SENDING','UNKNOWN','FAILED')) ORDER BY o."sequence" LIMIT 1 FOR UPDATE OF o SKIP LOCKED`);
   const item=rows[0];if(!item)return null;
   const attempt=await tx.whatsAppSendAttempt.create({data:{outboxId:item.id,leaseUntil:until}});
   const claimed=await tx.whatsAppOutbox.update({where:{id:item.id},data:{state:'SENDING',attempts:{increment:1},leaseToken:attempt.id,leaseUntil:until,lastError:null}});
   return{item:claimed,attemptId:attempt.id};
  },{maxWait:3000,timeout:10000});
 }

 async sendOutgoing(claim:{item:WhatsAppOutbox;attemptId:string}){
  const {attemptId}=claim;
  // A paused worker must not send after its lease expired or an operator reviewed it.
  const now=new Date();
  const item=await this.db.whatsAppOutbox.findFirst({where:{id:claim.item.id,state:'SENDING',leaseToken:attemptId,leaseUntil:{gt:now},sendAttempts:{some:{id:attemptId,state:'SENDING',leaseUntil:{gt:now}}}}});
  if(!item)return false;
  let providerId:string|null;
  try{if(payloadHash(item.payload)!==item.payloadHash)throw new Error('OUTBOX_CONTENT_MISMATCH');validateOutgoing(item.payload,item.waId);}
  catch{
   await this.db.$transaction(async tx=>{
    await tx.whatsAppSendAttempt.update({where:{id:attemptId},data:{state:'FAILED',lastError:'OUTBOX_CONTENT_MISMATCH'}});
    await tx.whatsAppOutbox.updateMany({where:{id:item.id,leaseToken:attemptId,state:'SENDING'},data:{state:'FAILED',lastError:'OUTBOX_CONTENT_MISMATCH',leaseUntil:null}});
   });return false;
  }
  try{
   providerId=await(this.dependencies.send??(payload=>whatsapp.sendPayload(payload)))(item.payload);
   if(!providerId||providerId.length>256)throw new WhatsAppDeliveryError('UNKNOWN');
  }catch(error){
   const rejected=error instanceof WhatsAppDeliveryError&&error.outcome==='REJECTED';
   const state=rejected?'FAILED':'UNKNOWN';
   await this.db.$transaction(async tx=>{
    await tx.whatsAppSendAttempt.update({where:{id:attemptId},data:{state,lastError:rejected?'PROVIDER_REJECTED':'SEND_RESULT_UNKNOWN',providerErrorCode:error instanceof WhatsAppDeliveryError?error.providerCode:null}});
    await tx.whatsAppOutbox.updateMany({where:{id:item.id,leaseToken:attemptId,state:{in:['SENDING','UNKNOWN']}},data:{state,leaseUntil:null,lastError:rejected?'PROVIDER_REJECTED':'SEND_RESULT_UNKNOWN',providerErrorCode:error instanceof WhatsAppDeliveryError?error.providerCode:null}});
   });return false;
  }
  let stored=false;
  // Retry only the database receipt commit, never the network send. Repeated commits preserve stronger delivery states.
  for(let attempt=0;attempt<2;attempt++){
   try{
    await this.db.$transaction(async tx=>{
     const acceptedAt=new Date();
     await tx.whatsAppSendAttempt.updateMany({where:{id:attemptId,state:{in:['SENDING','UNKNOWN']}},data:{state:'ACCEPTED',providerMessageId:providerId,acceptedAt,lastError:null}});
     const proof=await tx.whatsAppSendAttempt.findUniqueOrThrow({where:{id:attemptId}});
     if(proof.providerMessageId!==providerId)throw new Error('PROVIDER_MESSAGE_ID_CONFLICT');
     await tx.whatsAppOutbox.updateMany({where:{id:item.id,leaseToken:attemptId,state:{in:['SENDING','UNKNOWN']}},data:{state:'ACCEPTED',providerMessageId:providerId,acceptedAt,leaseUntil:null,lastError:null}});
    });stored=true;break;
   }catch{}
  }
  if(!stored){
   await this.db.whatsAppOutbox.updateMany({where:{id:item.id,leaseToken:attemptId,state:'SENDING'},data:{state:'UNKNOWN',lastError:'SEND_RESULT_COMMIT_UNAVAILABLE',leaseUntil:null}});
   return false;
  }
  await this.store.reconcileStatuses();return true;
 }

 async runOnce(){
  await this.recoverSends();const reconciled=await this.store.reconcileStatuses();
  const incoming=await this.claimIncoming();if(incoming)await this.processIncoming(incoming);
  const outgoing=await this.claimOutgoing();if(outgoing)await this.sendOutgoing(outgoing);
  return{processed:Boolean(incoming||outgoing),reconciled};
 }
}
