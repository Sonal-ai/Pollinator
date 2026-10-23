const fs=require('node:fs');require('dotenv').config({path:'.env',override:true,quiet:true});
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {ethers}=require('ethers'),{ChainTransport}=require('../src/lib/chain/transport.ts'),{getActiveContractAddress}=require('../src/lib/chain/config.ts');
(async()=>{
 const chain=new ChainTransport(),address=getActiveContractAddress();
 const result={checkedAt:new Date().toISOString(),readOnly:true,configuration:'.env',registryAddress:address};
 try{
  result.rpcChainId=Number((await chain.provider.getNetwork()).chainId);
  const code=await chain.provider.getCode(address);result.deployedBytecodeBytes=(code.length-2)/2;
  result.deployedBytecodeHash=ethers.keccak256(code);
  const registry=new ethers.Contract(address,['function registryVersion() view returns(uint256)','function trustedForwarder() view returns(address)'],chain.provider);
  try{result.registryVersion=String(await registry.registryVersion());}catch(error){result.registryVersionCall={code:error.code||'UNKNOWN',returnedData:typeof error.data==='string'?error.data:null};}
  try{result.trustedForwarder=await registry.trustedForwarder();}catch(error){result.trustedForwarderCall={code:error.code||'UNKNOWN'};}
  result.conclusion=code==='0x'?'NO_CONTRACT_AT_CONFIGURED_ADDRESS':result.registryVersion==='2'?'REGISTRY_V2_REQUIRES_CONTEXT_VERIFICATION':'DEPLOYED_CODE_DOES_NOT_ESTABLISH_REGISTRY_V2';
  result.relayerConfigured=Boolean(process.env.RELAYER_PRIVATE_KEY);
 }catch(error){result.failureCode=error.code||'UNAVAILABLE';}
 finally{chain.provider.destroy();}
 fs.writeFileSync('docs/qa/main-chain-diagnosis.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(()=>{console.error('Read-only diagnosis unavailable; no credentials printed');process.exitCode=1;});
