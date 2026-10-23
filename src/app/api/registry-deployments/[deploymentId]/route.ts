import {walletDeploymentRequest} from '@/lib/deployment/wallet-api';
import {publicDeployment} from '@/lib/deployment/wallet-deployment';
import {DeploymentActionSchema} from '@/lib/deployment/wallet-protocol';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{deploymentId:string}>};
export async function GET(request:Request,{params}:Context){const {deploymentId}=await params;return walletDeploymentRequest(request,false,async service=>({plan:publicDeployment(await service.load(deploymentId))}));}
export async function POST(request:Request,{params}:Context){const {deploymentId}=await params;return walletDeploymentRequest(request,true,async(service,_accountId,body)=>{
 const action=DeploymentActionSchema.parse(body),result=await service.action(deploymentId,action);
 return action.action==='EXPORT'?{manifest:result}:{plan:result};
});}
