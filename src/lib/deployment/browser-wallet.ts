export type DeploymentProvider={request:(request:{method:string;params?:unknown[]})=>Promise<unknown>};
export async function checkDeploymentWallet(provider:DeploymentProvider,administrator:string,chainId:number,connect=false){
 const accounts=await provider.request({method:connect?'eth_requestAccounts':'eth_accounts'});
 if(!Array.isArray(accounts)||typeof accounts[0]!=='string'||accounts[0].toLowerCase()!==administrator.toLowerCase())throw new Error('Select the configured administrator wallet in MetaMask.');
 const chain=await provider.request({method:'eth_chainId'});
 if(typeof chain!=='string'||BigInt(chain)!==BigInt(chainId))throw new Error('Switch the wallet to the deployment network shown on this page.');
 return accounts[0];
}
export async function sendPreparedDeployment(provider:DeploymentProvider,administrator:string,chainId:number,transaction:Record<string,string>,begin:()=>Promise<void>,remember:(hash:string)=>void){
 if(transaction.from.toLowerCase()!==administrator.toLowerCase()||BigInt(transaction.chainId)!==BigInt(chainId)||transaction.value!=='0x0')throw new Error('The prepared transaction does not match the administrator or network.');
 await checkDeploymentWallet(provider,administrator,chainId,true);
 await begin();
 await checkDeploymentWallet(provider,administrator,chainId);
 const result=await provider.request({method:'eth_sendTransaction',params:[transaction]});
 if(typeof result!=='string'||!/^0x[a-fA-F0-9]{64}$/.test(result))throw new Error('The wallet send outcome is unknown. Check wallet activity before proceeding.');
 remember(result);return result;
}
