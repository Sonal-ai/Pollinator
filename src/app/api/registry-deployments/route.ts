import {walletDeploymentRequest} from '@/lib/deployment/wallet-api';
import {deploymentAdministrator,publicDeployment} from '@/lib/deployment/wallet-deployment';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return walletDeploymentRequest(request,false,async service=>({administrator:deploymentAdministrator(),chainId:service.chainId,plans:(await service.list()).map(publicDeployment)}));}
export async function POST(request:Request){return walletDeploymentRequest(request,true,async(service,accountId,body)=>({plan:publicDeployment(await service.create(accountId,body))}));}
