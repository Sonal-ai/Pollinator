import {Prisma,PrismaClient} from '@prisma/client';
import {z} from 'zod';

export const ReviewSchema=z.object({target:z.enum(['inbox','outbox']),id:z.string().min(1).max(256),
 action:z.enum(['RETRY','DISCARD']),reason:z.string().trim().min(10).max(500),acknowledgeDuplicateRisk:z.boolean().optional()}).strict();
export class WhatsAppReviewError extends Error{constructor(message:string,readonly status=409){super(message);}}
export async function reviewWhatsApp(db:PrismaClient,accountId:string,input:z.infer<typeof ReviewSchema>){
 return db.$transaction(async tx=>{
  const rows=await tx.$queryRaw<Array<{id:string;state:string;attempts:number}>>(input.target==='inbox'
   ?Prisma.sql`SELECT "id","state","attempts" FROM "WhatsAppInbox" WHERE "id"=${input.id} FOR UPDATE`
   :Prisma.sql`SELECT "id","state","attempts" FROM "WhatsAppOutbox" WHERE "id"=${input.id} FOR UPDATE`);
  const row=rows[0];if(!row)throw new WhatsAppReviewError('Stored work not found',404);
  if(input.target==='inbox'&&row.state!=='FAILED'||input.target==='outbox'&&!['UNKNOWN','FAILED'].includes(row.state))throw new WhatsAppReviewError('Only failed or uncertain inactive work can be reviewed');
  if(input.target==='outbox'&&input.action==='RETRY'){
   if(!input.acknowledgeDuplicateRisk)throw new WhatsAppReviewError('Check provider/recipient delivery and explicitly acknowledge duplicate risk before retrying',422);
   if(await tx.whatsAppSendAttempt.count({where:{outboxId:row.id,state:{in:['DELIVERED','READ']}}}))throw new WhatsAppReviewError('This reply already has confirmed delivery');
  }
  const state=input.action==='RETRY'?'PENDING':'DISCARDED';
  if(input.target==='inbox')await tx.whatsAppInbox.update({where:{id:row.id},data:{state,attempts:0,nextAttemptAt:new Date(),leaseToken:null,leaseUntil:null,lastError:null}});
  else await tx.whatsAppOutbox.update({where:{id:row.id},data:{state,nextAttemptAt:new Date(),leaseToken:null,leaseUntil:null,lastError:null,
   reviewedBy:accountId,reviewReason:input.reason,reviewedAt:new Date()}});
  await tx.whatsAppReviewEvent.create({data:{targetKind:input.target,targetId:row.id,action:input.action,accountId,reason:input.reason,previousState:row.state+':attempts='+row.attempts}});
  return{id:row.id,state};
 },{maxWait:3000,timeout:10000});
}
