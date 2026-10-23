import {ZodError} from 'zod';
import {getSession} from '../auth';
import {prisma} from '../db';
import {sameOrigin,readOperationJSON} from '../chain/http';
import {OperationError} from '../chain/protocol';
import {DeploymentError} from './wallet-protocol';
import {WalletDeploymentService} from './wallet-deployment';

export async function walletDeploymentRequest(request:Request,write:boolean,run:(service:WalletDeploymentService,accountId:string,body:unknown)=>Promise<unknown>){
 const session=await getSession();
 if(!session)return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 if(session.role!=='admin')return Response.json({error:'Administrator access required'},{status:403,headers:{'Cache-Control':'no-store'}});
 let service:WalletDeploymentService|undefined;
 try{
  if(write)sameOrigin(request);
  const body=write?await readOperationJSON(request,4096):undefined;
  service=new WalletDeploymentService(prisma);
  return Response.json(await run(service,session.accountId,body),{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const known=error instanceof DeploymentError||error instanceof OperationError;
  return Response.json({error:known?error.message:error instanceof ZodError?'Check every actor and relayer address.':'Deployment dependency unavailable. Saved work was retained; do not resend an uncertain wallet transaction.'},
   {status:known?error.status:error instanceof ZodError?422:503,headers:{'Cache-Control':'no-store'}});
 }finally{service?.provider.destroy();}
}
