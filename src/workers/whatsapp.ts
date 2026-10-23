import {prisma} from '../lib/db';
import {WhatsAppWorker} from '../lib/whatsapp/worker';
import {heartbeat,pause,stopSignal} from './lifecycle';

async function main(){
 const worker=new WhatsAppWorker(),signal=stopSignal();let failures=0,lastSuccess=false;
 try{
  do{
   try{
    await worker.runOnce();failures=0;lastSuccess=true;
    await heartbeat('whatsapp',true,'poll_succeeded');
   }catch{
    failures++;lastSuccess=false;await heartbeat('whatsapp',false,'dependency_unavailable');
    console.error('WhatsApp worker dependency unavailable; stored work was retained.');
   }
   if(process.argv.includes('--once'))break;
   await pause(failures?Math.min(60000,2000*2**Math.min(failures,5)):1000,signal);
  }while(!signal.aborted);
  if(process.argv.includes('--once')&&!lastSuccess)process.exitCode=1;
 }finally{await heartbeat('whatsapp',false,'stopped');await prisma.$disconnect();}
}
void main().catch(async()=>{console.error('WhatsApp worker stopped; inspect the durable queue.');process.exitCode=1;await prisma.$disconnect();});
