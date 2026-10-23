const {ethers}=require('ethers');
const roles=['BEEKEEPER','LAB','PROCESSOR','DISTRIBUTOR','RETAILER'];
const publicAddress=value=>typeof value==='string'&&ethers.isAddress(value)&&value.toLowerCase()!==ethers.ZeroAddress?ethers.getAddress(value):null;
async function inspectAmoyReadiness(provider,environment=process.env){
 const record={checkedAt:new Date().toISOString(),readOnly:true,broadcastPerformed:false,readyForDeploymentApproval:false,walletAssignmentsComplete:false,requirements:[],actors:{}};
 try{
  record.chainId=Number((await provider.getNetwork()).chainId);if(record.chainId!==80002)record.requirements.push('Use verified Amoy chain 80002');
  const fees=await provider.getFeeData();record.feeQuote={maxFeePerGasWei:fees.maxFeePerGas?.toString()??null,maxPriorityFeePerGasWei:fees.maxPriorityFeePerGas?.toString()??null,gasPriceWei:fees.gasPrice?.toString()??null};
  const administrator=publicAddress(environment.DEPLOYMENT_ADMIN_ADDRESS);
  let relayer=publicAddress(environment.RELAYER_ADDRESS),keyAddress=null;
  if(/^0x[a-fA-F0-9]{64}$/.test(environment.RELAYER_PRIVATE_KEY||'')){try{keyAddress=new ethers.Wallet(environment.RELAYER_PRIVATE_KEY).address;}catch{}}
  if(environment.RELAYER_ADDRESS&&!relayer)record.requirements.push('Use a valid nonzero public RELAYER_ADDRESS');
  if(relayer&&keyAddress&&relayer.toLowerCase()!==keyAddress.toLowerCase())record.requirements.push('The configured relayer key does not match the approved public relayer address');
  if(!environment.RELAYER_ADDRESS)relayer=keyAddress;
  record.relayerSigningConfigured=Boolean(keyAddress&&relayer&&keyAddress.toLowerCase()===relayer.toLowerCase());
  if(administrator){record.deployer={address:administrator,signing:'USER_METAMASK',balanceWei:String(await provider.getBalance(administrator)),pendingNonce:await provider.getTransactionCount(administrator,'pending')};if(record.deployer.balanceWei==='0')record.requirements.push('Fund the administrator with Amoy test POL before reviewing deployment gas');}
  else record.requirements.push('Configure the approved public DEPLOYMENT_ADMIN_ADDRESS; administrator signing stays in MetaMask');
  if(relayer){record.relayer={address:relayer,balanceWei:String(await provider.getBalance(relayer))};if(record.relayer.balanceWei==='0')record.requirements.push('Fund the separate gas relayer with Amoy test POL');}
  else record.requirements.push('Supply the separate public RELAYER_ADDRESS');
  if(!record.relayerSigningConfigured)record.requirements.push('Configure the matching separate relayer key securely on the intended server before backend activation');
  const used=new Set([administrator,relayer].filter(Boolean).map(value=>value.toLowerCase()));let distinct=!(administrator&&relayer&&administrator.toLowerCase()===relayer.toLowerCase());
  if(!distinct)record.requirements.push('Administrator and relayer must differ');
  for(const role of roles){const address=publicAddress(environment[role+'_ACTOR_ADDRESS']);if(!address){record.requirements.push('Supply '+role+' actor public address');continue;}if(used.has(address.toLowerCase())){distinct=false;record.requirements.push(role+' needs its own distinct enrolled actor');}used.add(address.toLowerCase());record.actors[role]=address;}
  record.walletAssignmentsComplete=Boolean(administrator&&relayer&&distinct&&Object.keys(record.actors).length===roles.length);
  record.requirements.push('Review fresh v2 registry/forwarder transaction data and gas estimates in the administrator deployment page before each MetaMask signature');
  record.requirements.push('Retain historical deployment identity; a new registry requires a new binding or explicitly reviewed migration');
 }catch(error){record.failureCode=typeof error.code==='string'?error.code:'UNAVAILABLE';}
 return record;
}
async function main(){require('dotenv').config({path:'.env',override:true,quiet:true});require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});const {ChainTransport}=require('../src/lib/chain/transport.ts'),chain=new ChainTransport();try{const record=await inspectAmoyReadiness(chain.provider);require('node:fs').writeFileSync('docs/qa/amoy-deployment-readiness.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));if(record.failureCode)process.exitCode=1;}finally{chain.provider.destroy();}}
module.exports={inspectAmoyReadiness};
if(require.main===module)main().catch(()=>{console.error('Read-only deployment readiness unavailable; no secrets printed');process.exitCode=1;});
