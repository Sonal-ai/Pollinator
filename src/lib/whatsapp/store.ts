import { Prisma, PrismaClient, type WhatsAppDeliveryEvent } from '@prisma/client';
import { prisma } from '../db';
import { payloadHash, type IncomingMessage, type DeliveryEvent } from './protocol';

export class WebhookConflictError extends Error {}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function applyDelivery(tx: Prisma.TransactionClient, event: WhatsAppDeliveryEvent): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{id:string;state:string;leaseToken:string|null;attemptId:string;attemptState:string}>>(Prisma.sql`
    SELECT o."id",o."state",o."leaseToken",a."id" AS "attemptId",a."state" AS "attemptState"
    FROM "WhatsAppOutbox" o JOIN "WhatsAppSendAttempt" a ON a."outboxId"=o."id"
    WHERE a."providerMessageId"=${event.providerMessageId} AND o."waId"=${event.waId} FOR UPDATE OF o,a`);
  const row=rows[0]; if(!row) return false;
  const attemptUpdate:Prisma.WhatsAppSendAttemptUpdateInput={};
  if(event.status==='read'){attemptUpdate.state='READ';attemptUpdate.readAt=event.observedAt;}
  else if(event.status==='delivered'&&row.attemptState!=='READ'){attemptUpdate.state='DELIVERED';attemptUpdate.deliveredAt=event.observedAt;}
  else if(event.status==='failed'&&!['READ','DELIVERED'].includes(row.attemptState)){attemptUpdate.state='FAILED';attemptUpdate.lastError='PROVIDER_DELIVERY_FAILED';}
  else if(event.status==='sent'&&['SENDING','UNKNOWN','ACCEPTED'].includes(row.attemptState))attemptUpdate.state='ACCEPTED';
  if(Object.keys(attemptUpdate).length)await tx.whatsAppSendAttempt.update({where:{id:row.attemptId},data:attemptUpdate});
  const update: Prisma.WhatsAppOutboxUpdateInput = {};
  if(event.status==='read'){update.state='READ';update.readAt=event.observedAt;}
  else if(event.status==='delivered'&&row.state!=='READ'){update.state='DELIVERED';update.deliveredAt=event.observedAt;}
  else if(event.status==='failed'&&row.leaseToken===row.attemptId&&!['READ','DELIVERED'].includes(row.state)){update.state='FAILED';update.lastError='PROVIDER_DELIVERY_FAILED';}
  else if(event.status==='sent'&&row.leaseToken===row.attemptId&&['SENDING','UNKNOWN','ACCEPTED'].includes(row.state))update.state='ACCEPTED';
  if(Object.keys(update).length)await tx.whatsAppOutbox.update({where:{id:row.id},data:update});
  await tx.whatsAppDeliveryEvent.update({where:{id:event.id},data:{appliedAt:new Date()}});
  return true;
}

export class WhatsAppStore {
  constructor(readonly db:PrismaClient=prisma){}
  async accept(messages:IncomingMessage[],statuses:DeliveryEvent[]){
    return this.db.$transaction(async tx=>{
      for(const message of messages){
        const hash=payloadHash(message);
        await tx.whatsAppInbox.createMany({data:[{id:message.id,waId:message.from,payload:json(message),payloadHash:hash}],skipDuplicates:true});
        const stored=await tx.whatsAppInbox.findUniqueOrThrow({where:{id:message.id}});
        if(stored.payloadHash!==hash||stored.waId!==message.from)throw new WebhookConflictError('Message ID conflicts with stored content');
      }
      for(const status of [...statuses].sort((a,b)=>a.id.localeCompare(b.id)||payloadHash(a).localeCompare(payloadHash(b)))){
        const key=payloadHash(status);
        await tx.whatsAppDeliveryEvent.createMany({data:[{id:key,providerMessageId:status.id,waId:status.recipient_id,status:status.status,
          observedAt:new Date(Number(status.timestamp)*1000),payload:json(status)}],skipDuplicates:true});
        const event=await tx.whatsAppDeliveryEvent.findUniqueOrThrow({where:{id:key}});
        if(!event.appliedAt)await applyDelivery(tx,event);
      }
      return{messages:messages.length,statuses:statuses.length};
    },{maxWait:3000,timeout:10000});
  }
  async reconcileStatuses(){
    return this.db.$transaction(async tx=>{
      const rows=await tx.$queryRaw<WhatsAppDeliveryEvent[]>(Prisma.sql`
        SELECT e.* FROM "WhatsAppDeliveryEvent" e WHERE e."appliedAt" IS NULL AND EXISTS(
          SELECT 1 FROM "WhatsAppSendAttempt" a JOIN "WhatsAppOutbox" o ON o."id"=a."outboxId"
          WHERE a."providerMessageId"=e."providerMessageId" AND o."waId"=e."waId")
        ORDER BY e."createdAt",e."id" LIMIT 100 FOR UPDATE OF e SKIP LOCKED`);
      for(const event of rows)await applyDelivery(tx,event);
      return rows.length;
    },{maxWait:3000,timeout:10000});
  }
}
