import {getSession} from '@/lib/auth';
import {prisma} from '@/lib/db';
import {readOperationJSON,sameOrigin} from '@/lib/chain/http';
import {OperationError} from '@/lib/chain/protocol';
import {ReviewSchema,reviewWhatsApp,WhatsAppReviewError} from '@/lib/whatsapp/review';

export const runtime='nodejs';
export async function GET(){
 const session=await getSession();if(!session)return Response.json({error:'Unauthorized'},{status:401});
 if(session.role!=='admin')return Response.json({error:'Administrator access required'},{status:403});
 try{
  const [incoming,outgoing,inboxStates,outboxStates]=await Promise.all([
   prisma.whatsAppInbox.findMany({where:{state:'FAILED'},orderBy:{sequence:'asc'},take:25,select:{id:true,waId:true,state:true,attempts:true,lastError:true,createdAt:true}}),
   prisma.whatsAppOutbox.findMany({where:{state:{in:['UNKNOWN','FAILED']}},orderBy:{sequence:'asc'},take:25,select:{id:true,waId:true,state:true,attempts:true,lastError:true,createdAt:true}}),
   prisma.whatsAppInbox.groupBy({by:['state'],_count:{_all:true}}),prisma.whatsAppOutbox.groupBy({by:['state'],_count:{_all:true}}),
  ]);
  const publicRows=(rows:typeof incoming)=>rows.map(({waId,...row})=>({...row,recipientSuffix:waId.slice(-4)}));
  return Response.json({incoming:publicRows(incoming),outgoing:publicRows(outgoing),inboxStates,outboxStates},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'WhatsApp queue unavailable'},{status:503});}
}
export async function POST(request:Request){
 const session=await getSession();if(!session)return Response.json({error:'Unauthorized'},{status:401});
 if(session.role!=='admin')return Response.json({error:'Administrator access required'},{status:403});
 try{
  sameOrigin(request);const parsed=ReviewSchema.safeParse(await readOperationJSON(request));
  if(!parsed.success)return Response.json({error:'Invalid review action'},{status:422});
  return Response.json(await reviewWhatsApp(prisma,session.accountId,parsed.data),{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof WhatsAppReviewError||error instanceof OperationError?error.message:'Review unavailable'},
  {status:error instanceof WhatsAppReviewError||error instanceof OperationError?error.status:503});}
}
