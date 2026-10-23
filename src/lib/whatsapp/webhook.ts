import {createHmac,timingSafeEqual} from 'node:crypto';
import {boundedBody,RequestBodyError} from '../request-body';
import {parseProviderWebhook} from './protocol';
import {WebhookConflictError,type WhatsAppStore} from './store';

function sameSecret(one:string,two:string){const a=Buffer.from(one),b=Buffer.from(two);return a.length===b.length&&timingSafeEqual(a,b);}
export function createWebhookHandlers(options:{verifyToken:string;appSecret:string;phoneId:string;store:Pick<WhatsAppStore,'accept'>}){
 return{
  async GET(request:Request){
   const params=new URL(request.url).searchParams,challenge=params.get('hub.challenge');
   if(params.get('hub.mode')!=='subscribe'||!options.verifyToken||!sameSecret(params.get('hub.verify_token')??'',options.verifyToken)||!challenge||challenge.length>1024)return new Response('Forbidden',{status:403});
   return new Response(challenge,{status:200,headers:{'Cache-Control':'no-store'}});
  },
  async POST(request:Request){
   let raw:Buffer;
   try{raw=await boundedBody(request,256*1024);}catch(error){return new Response('Invalid request body',{status:error instanceof RequestBodyError?error.status:400});}
   const supplied=request.headers.get('x-hub-signature-256')??'';
   if(!options.appSecret||!/^sha256=[a-fA-F0-9]{64}$/.test(supplied))return new Response('Unauthorized',{status:401});
   const expected=createHmac('sha256',options.appSecret).update(raw).digest();
   if(!timingSafeEqual(Buffer.from(supplied.slice(7),'hex'),expected))return new Response('Unauthorized',{status:401});
   let parsed:ReturnType<typeof parseProviderWebhook>;
   try{parsed=parseProviderWebhook(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),options.phoneId);}catch{return new Response('Invalid webhook payload',{status:400});}
   try{await options.store.accept(parsed.messages,parsed.statuses);}catch(error){return new Response(error instanceof WebhookConflictError?'Conflicting message ID':'Storage unavailable; retry delivery',{status:error instanceof WebhookConflictError?409:503});}
   return new Response('OK',{status:200,headers:{'Cache-Control':'no-store'}});
  },
 };
}
