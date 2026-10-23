import {ethers} from 'ethers';
import {Prisma,type PrismaClient,type RegistryDeployment,type RegistryDeploymentStep} from '@prisma/client';
import {getActiveRpcUrl,isLocalChain} from '../chain/config';
import {deploymentArtifacts,deploymentTemplateHash} from './wallet-artifacts';
import {ACTOR_ROLES,DeploymentError,validateEnrollment,type Enrollment,type DeploymentAction} from './wallet-protocol';

type Plan=RegistryDeployment&{steps:RegistryDeploymentStep[]};
const include={steps:{orderBy:{ordinal:'asc' as const}}};
const hashRole=(role:string)=>ethers.id(role.toUpperCase()+'_ROLE');
const same=(a:string|null,b:string|null)=>a?.toLowerCase()===b?.toLowerCase();
export function deploymentAdministrator(){
 const value=process.env.DEPLOYMENT_ADMIN_ADDRESS;
 if(!value||!ethers.isAddress(value)||same(value,ethers.ZeroAddress))throw new DeploymentError('Configure the approved public DEPLOYMENT_ADMIN_ADDRESS before wallet deployment.',503);
 return ethers.getAddress(value).toLowerCase();
}
export function publicDeployment(plan:Plan){
 return{id:plan.id,administrator:plan.administrator,relayer:plan.relayer,actors:plan.actors as Enrollment['actors'],chainId:plan.chainId,genesisHash:plan.genesisHash,state:plan.state,createdAt:plan.createdAt.toISOString(),
  steps:plan.steps.map(step=>({id:step.id,kind:step.kind,state:step.state,nonce:step.nonce,target:step.target,predictedAddress:step.predictedAddress,txHash:step.txHash,receiptBlock:step.receiptBlock,lastError:step.lastError,
   transaction:step.state==='PREPARED'?{from:plan.administrator,chainId:ethers.toQuantity(plan.chainId),nonce:ethers.toQuantity(step.nonce!),...(step.target?{to:step.target}:{}),data:step.data!,value:'0x0',gas:ethers.toQuantity(BigInt(step.gasLimit!)),maxFeePerGas:ethers.toQuantity(BigInt(step.maxFeePerGas!)),maxPriorityFeePerGas:ethers.toQuantity(BigInt(step.priorityFee!))}:null,
   maximumFeePOL:step.gasLimit&&step.maxFeePerGas?ethers.formatEther(BigInt(step.gasLimit)*BigInt(step.maxFeePerGas)):null}))};
}
export type PublicDeployment=ReturnType<typeof publicDeployment>;

export class WalletDeploymentService{
 readonly provider:ethers.JsonRpcProvider;
 readonly chainId:number;
 readonly confirmations:number;
 constructor(readonly db:PrismaClient,rpc=getActiveRpcUrl(),chainId=(isLocalChain()&&process.env.NODE_ENV!=='production'&&process.env.LOCAL_TEST_SIGNING==='true'?31337:80002),confirmations=2){
  if(chainId!==80002&&!(chainId===31337&&process.env.NODE_ENV!=='production'))throw new DeploymentError('Wallet deployment is restricted to Amoy.',503);
  const request=new ethers.FetchRequest(rpc);request.timeout=8000;
  this.provider=new ethers.JsonRpcProvider(request,undefined,{batchMaxCount:1,cacheTimeout:-1});this.chainId=chainId;this.confirmations=Math.max(1,confirmations);
 }
 async context(){
  if((await this.provider.getNetwork()).chainId!==BigInt(this.chainId))throw new DeploymentError('Deployment RPC has the wrong chain ID.',503);
  const genesis=await this.provider.getBlock(0);if(!genesis?.hash)throw new DeploymentError('Cannot verify deployment chain identity.',503);
  return{chainId:this.chainId,genesisHash:genesis.hash};
 }
 async list(){const context=await this.context();return this.db.registryDeployment.findMany({where:{administrator:deploymentAdministrator(),...context,state:{in:['IN_PROGRESS','REVIEW','COMPLETE']}},orderBy:{createdAt:'desc'},take:5,include});}
 async load(id:string){
  const plan=await this.db.registryDeployment.findUnique({where:{id},include});
  if(!plan||!same(plan.administrator,deploymentAdministrator())||plan.chainId!==this.chainId)throw new DeploymentError('Deployment plan not found.',404);
  return plan;
 }
 private async assertContext(plan:Plan){const context=await this.context();if(context.genesisHash!==plan.genesisHash)throw new DeploymentError('The chain identity changed. Preserve this plan for review.');}
 private async locked<T>(id:string,fn:(plan:Plan,tx:Prisma.TransactionClient)=>Promise<T>){
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "RegistryDeployment" WHERE "id"=${id} FOR UPDATE`;
   const plan=await tx.registryDeployment.findUnique({where:{id},include});
   if(!plan||!same(plan.administrator,deploymentAdministrator())||plan.chainId!==this.chainId)throw new DeploymentError('Deployment plan not found.',404);
   await this.assertContext(plan);return fn(plan,tx);
  },{maxWait:3000,timeout:45000});
 }
 async create(initiatedBy:string,input:unknown){
  const administrator=deploymentAdministrator(),enrollment=validateEnrollment(input,administrator),context=await this.context();
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.genesisHash+administrator},0))::text`;
   const existing=await tx.registryDeployment.findFirst({where:{administrator,...context,state:{in:['IN_PROGRESS','REVIEW']}},include});
   if(existing){
    const saved=validateEnrollment({relayer:existing.relayer,actors:existing.actors},administrator);
    if(JSON.stringify(saved)!==JSON.stringify(enrollment))throw new DeploymentError('An existing deployment has different roles. Recover it before creating another.');
    return existing;
   }
   return tx.registryDeployment.create({data:{initiatedBy,administrator,relayer:enrollment.relayer,actors:enrollment.actors,...context,templateHash:deploymentTemplateHash,
    steps:{create:['DEPLOY_FORWARDER','DEPLOY_REGISTRY',...ACTOR_ROLES.map(role=>'GRANT_'+role)].map((kind,ordinal)=>({kind,ordinal}))}},include});
  },{maxWait:3000,timeout:10000});
 }
 private next(plan:Plan){const step=plan.steps.find(s=>s.state!=='CONFIRMED');if(!step)throw new DeploymentError('All deployment transactions are already confirmed.');return step;}
 private async assertConfirmed(plan:Plan){
  const steps=plan.steps.filter(s=>s.state==='CONFIRMED');if(!steps.length)return;
  const head=await this.provider.getBlockNumber();
  await Promise.all(steps.map(async step=>{
   const receipt=step.txHash?await this.provider.getTransactionReceipt(step.txHash):null;
   if(!receipt||receipt.status!==1||receipt.blockHash!==step.receiptBlockHash||head-receipt.blockNumber+1<this.confirmations)
    throw new DeploymentError('An earlier receipt changed or lost confirmations. Stop and reconcile the deployment.');
   const block=await this.provider.getBlock(receipt.blockNumber);
   if(block?.hash!==receipt.blockHash)throw new DeploymentError('An earlier receipt is not on the canonical chain. Stop and reconcile the deployment.');
  }));
 }
 async prepare(id:string){return this.locked(id,async(plan,tx)=>{
  if(plan.state!=='IN_PROGRESS')throw new DeploymentError('This deployment is not open for further transactions.');
  if(plan.templateHash!==deploymentTemplateHash)throw new DeploymentError('Contract artifacts changed. Preserve the saved deployment for review.');
  await this.assertConfirmed(plan);const step=this.next(plan);
  if(step.state==='PREPARED')return plan;
  if(step.state!=='PENDING')throw new DeploymentError('Reconcile the current transaction before preparing another.');
  const nonce=await this.provider.getTransactionCount(plan.administrator,'pending');
  let data:string,target:string|null=null,predictedAddress:string|null=null;
  if(step.kind==='DEPLOY_FORWARDER')data=(await new ethers.ContractFactory(deploymentArtifacts.forwarder.abi,deploymentArtifacts.forwarder.bytecode).getDeployTransaction()).data!;
  else if(step.kind==='DEPLOY_REGISTRY'){
   const forwarder=plan.steps[0].predictedAddress;if(!forwarder)throw new DeploymentError('The confirmed forwarder is missing.');
   data=(await new ethers.ContractFactory(deploymentArtifacts.registry.abi,deploymentArtifacts.registry.bytecode).getDeployTransaction(forwarder)).data!;
  }else{
   target=plan.steps[1].predictedAddress;if(!target)throw new DeploymentError('The confirmed registry is missing.');
   const role=step.kind.slice(6) as typeof ACTOR_ROLES[number];if(!ACTOR_ROLES.includes(role))throw new DeploymentError('Unknown enrollment step.');
   data=new ethers.Interface(deploymentArtifacts.registry.abi).encodeFunctionData('grantRole',[hashRole(role),(plan.actors as Enrollment['actors'])[role]]);
  }
  if(!target)predictedAddress=ethers.getCreateAddress({from:plan.administrator,nonce});
  const fees=await this.provider.getFeeData(),maxFee=fees.maxFeePerGas??fees.gasPrice,priority=fees.maxPriorityFeePerGas??BigInt(0);
  if(!maxFee||maxFee>ethers.parseUnits(process.env.CHAIN_MAX_FEE_GWEI||'100','gwei'))throw new DeploymentError('Deployment gas fees exceed the configured budget.',503);
  const estimate=await this.provider.estimateGas({from:plan.administrator,to:target,data,value:BigInt(0)}),gas=estimate*BigInt(120)/BigInt(100)+BigInt(10000);
  if(gas>(target?BigInt(250000):BigInt(6000000)))throw new DeploymentError('Deployment transaction exceeds its gas limit.',422);
  if(await this.provider.getBalance(plan.administrator)<gas*maxFee)throw new DeploymentError('The administrator needs more testnet gas funds for this transaction.',422);
  await tx.registryDeploymentStep.update({where:{id:step.id},data:{state:'PREPARED',nonce,target,predictedAddress,data,gasLimit:String(gas),maxFeePerGas:String(maxFee),priorityFee:String(priority),lastError:null}});
  return tx.registryDeployment.findUniqueOrThrow({where:{id},include});
 });}
 async begin(id:string,stepId:string){return this.locked(id,async(plan,tx)=>{
  if(plan.templateHash!==deploymentTemplateHash)throw new DeploymentError('Contract artifacts changed. Review the saved deployment before opening a wallet request.');
  await this.assertConfirmed(plan);const step=this.next(plan);
  if(plan.state!=='IN_PROGRESS'||step.id!==stepId||step.state!=='PREPARED')throw new DeploymentError('The wallet request is already in progress or needs reconciliation.');
  if(await this.provider.getTransactionCount(plan.administrator,'pending')!==step.nonce)throw new DeploymentError('The wallet nonce changed. Reconcile or inspect this exact saved transaction.');
  await tx.registryDeploymentStep.update({where:{id:step.id},data:{state:'UNKNOWN',lastError:'Wallet request may have been submitted. Do not automatically resend.'}});
  return tx.registryDeployment.findUniqueOrThrow({where:{id},include});
 });}
 async cancel(id:string){return this.locked(id,async(plan,tx)=>{
  if(plan.state!=='IN_PROGRESS'||plan.steps.some(step=>!['PENDING','PREPARED'].includes(step.state)||step.txHash||step.lastError||(Array.isArray(step.failedAttempts)&&step.failedAttempts.length)))throw new DeploymentError('Only an unused deployment can be cancelled. Preserve and reconcile any possible submission.');
  return tx.registryDeployment.update({where:{id},data:{state:'CANCELLED'},include});
 });}
 async rejected(id:string,stepId:string){return this.locked(id,async(plan,tx)=>{
  const step=this.next(plan);if(step.id!==stepId||step.state!=='UNKNOWN'||step.txHash)throw new DeploymentError('This transaction cannot be marked as wallet-rejected.');
  if(await this.provider.getTransactionCount(plan.administrator,'pending')!==step.nonce)throw new DeploymentError('The nonce advanced; a wallet rejection cannot prove no transaction was sent.');
  await tx.registryDeploymentStep.update({where:{id:step.id},data:{state:'PREPARED',lastError:'A cancelled or unsent wallet request was reported. The same transaction nonce is retained.'}});
  return tx.registryDeployment.findUniqueOrThrow({where:{id},include});
 });}
 private async verifyResult(plan:Plan,step:RegistryDeploymentStep,receipt:ethers.TransactionReceipt){
  if(receipt.status!==1)throw new DeploymentError('The deployment transaction reverted.');
  if(step.kind.startsWith('DEPLOY_')){
   if(!same(receipt.contractAddress,step.predictedAddress)||!receipt.contractAddress||await this.provider.getCode(receipt.contractAddress)==='0x')throw new DeploymentError('The created contract does not match the saved deployment.');
   if(step.kind==='DEPLOY_REGISTRY'){
    const registry=new ethers.Contract(receipt.contractAddress,deploymentArtifacts.registry.abi,this.provider);
    if(await registry.registryVersion()!==BigInt(2)||!same(await registry.trustedForwarder(),plan.steps[0].predictedAddress)||!await registry.hasRole(ethers.ZeroHash,plan.administrator))throw new DeploymentError('The registry version, forwarder or administrator differs from the approved plan.');
   }
  }else{
   const role=step.kind.slice(6) as typeof ACTOR_ROLES[number],registry=new ethers.Contract(step.target!,deploymentArtifacts.registry.abi,this.provider);
   if(!await registry.hasRole(hashRole(role),(plan.actors as Enrollment['actors'])[role]))throw new DeploymentError('The actor role was not enrolled.');
  }
 }
 async reconcile(id:string,stepId:string,txHash:string){return this.locked(id,async(plan,db)=>{
  if(!['IN_PROGRESS','COMPLETE','REVIEW'].includes(plan.state))throw new DeploymentError('This deployment is closed.');
  const step=plan.steps.find(s=>s.id===stepId);if(!step||!step.data||step.nonce===null)throw new DeploymentError('The transaction was not prepared.',422);
  if(step.txHash&&!same(step.txHash,txHash))throw new DeploymentError('This step already has another transaction hash. Preserve both for review.');
  if(step.state!=='CONFIRMED'&&this.next(plan).id!==step.id)throw new DeploymentError('Transactions must be reconciled in order.');
  const transaction=await this.provider.getTransaction(txHash);
  if(!transaction)throw new DeploymentError('The RPC has not found this hash yet. Keep the hash and retry reconciliation, not wallet submission.',503);
  if(transaction.chainId!==BigInt(plan.chainId)||!same(transaction.from,plan.administrator)||transaction.nonce!==step.nonce||!same(transaction.to,step.target)||transaction.data.toLowerCase()!==step.data.toLowerCase()||transaction.value!==BigInt(0))
   throw new DeploymentError('That transaction does not match the administrator, nonce, destination and exact approved contract action.',422);
  const receipt=await this.provider.getTransactionReceipt(txHash);
  if(!receipt||(await this.provider.getBlockNumber())-receipt.blockNumber+1<this.confirmations){
   await db.registryDeploymentStep.update({where:{id:step.id},data:{state:'SUBMITTED',txHash,lastError:'Waiting for the required chain confirmations.'}});
  }else{
   const block=await this.provider.getBlock(receipt.blockNumber);if(block?.hash!==receipt.blockHash)throw new DeploymentError('Receipt is not on the current canonical chain.');
   if(receipt.status===0)await db.registryDeploymentStep.update({where:{id:step.id},data:{state:'FAILED',txHash,receiptBlock:receipt.blockNumber,receiptBlockHash:receipt.blockHash,lastError:'Confirmed reverted transaction. Review before explicitly retrying.'}});
   else{await this.verifyResult(plan,step,receipt);await db.registryDeploymentStep.update({where:{id:step.id},data:{state:'CONFIRMED',txHash,receiptBlock:receipt.blockNumber,receiptBlockHash:receipt.blockHash,lastError:null}});}
  }
  if(plan.state==='COMPLETE')await db.registryDeployment.update({where:{id},data:{state:'IN_PROGRESS'}});
  let current=await db.registryDeployment.findUniqueOrThrow({where:{id},include});
  if(current.steps.every(s=>s.state==='CONFIRMED')){await this.verifyEnrollment(current);current=await db.registryDeployment.update({where:{id},data:{state:'COMPLETE'},include});}
  return current;
 });}
 async retryFailed(id:string,stepId:string){return this.locked(id,async(plan,tx)=>{
  const step=this.next(plan);if(step.id!==stepId||step.state!=='FAILED'||!step.txHash)throw new DeploymentError('Only a confirmed reverted transaction can be retried.');
  const receipt=await this.provider.getTransactionReceipt(step.txHash);
  if(!receipt||receipt.status!==0||receipt.blockHash!==step.receiptBlockHash||(await this.provider.getBlockNumber())-receipt.blockNumber+1<this.confirmations)throw new DeploymentError('The failed receipt is not stable enough to retry.');
  if((await this.provider.getBlock(receipt.blockNumber))?.hash!==receipt.blockHash)throw new DeploymentError('The failed receipt is not on the canonical chain. Do not retry it.');
  const attempts=Array.isArray(step.failedAttempts)?step.failedAttempts:[];if(attempts.length>=5)throw new DeploymentError('This step requires operator review after repeated failures.');
  await tx.registryDeploymentStep.update({where:{id:step.id},data:{state:'PENDING',failedAttempts:[...attempts,{txHash:step.txHash,nonce:step.nonce,receiptBlock:step.receiptBlock}],nonce:null,data:null,target:null,predictedAddress:null,gasLimit:null,maxFeePerGas:null,priorityFee:null,txHash:null,receiptBlock:null,receiptBlockHash:null,lastError:null}});
  return tx.registryDeployment.findUniqueOrThrow({where:{id},include});
 });}
 private async verifyEnrollment(plan:Plan){
  await this.assertContext(plan);await this.assertConfirmed(plan);
  const registry=new ethers.Contract(plan.steps[1].predictedAddress!,deploymentArtifacts.registry.abi,this.provider),actors=plan.actors as Enrollment['actors'];
  if(await registry.registryVersion()!==BigInt(2)||!same(await registry.trustedForwarder(),plan.steps[0].predictedAddress)||!await registry.hasRole(ethers.ZeroHash,plan.administrator))throw new DeploymentError('The live registry binding no longer matches the deployment.');
  for(const role of [ethers.ZeroHash,...ACTOR_ROLES.map(hashRole)])if(await registry.hasRole(role,plan.relayer))throw new DeploymentError('The gas relayer must not have administrator or operational roles.');
  for(const role of ACTOR_ROLES){
   if(await registry.hasRole(ethers.ZeroHash,actors[role])||await registry.hasRole(hashRole(role),plan.administrator))throw new DeploymentError('Actor or administrator roles differ from the approved separation.');
   for(const assigned of ACTOR_ROLES)if(Boolean(await registry.hasRole(hashRole(assigned),actors[role]))!==(assigned===role))throw new DeploymentError('Actor roles differ from the approved separation.');
  }
 }
 async manifest(id:string){const plan=await this.load(id);if(plan.state!=='COMPLETE')throw new DeploymentError('Confirm all seven transactions before exporting the deployment.');await this.verifyEnrollment(plan);
  return{registryVersion:2,administrator:plan.administrator,relayer:plan.relayer,actors:plan.actors,chainId:plan.chainId,genesisHash:plan.genesisHash,registryAddress:plan.steps[1].predictedAddress,forwarderAddress:plan.steps[0].predictedAddress,
   templateHash:plan.templateHash,receipts:plan.steps.map(s=>({kind:s.kind,txHash:s.txHash,block:s.receiptBlock})),activationRequired:true,webAccountsProvisioned:false,
   environment:{BLOCKCHAIN_NETWORK:plan.chainId===80002?'amoy':'local',CONTRACT_ADDRESS:plan.steps[1].predictedAddress,REGISTRY_FORWARDER_ADDRESS:plan.steps[0].predictedAddress,REGISTRY_GENESIS_HASH:plan.genesisHash,REGISTRY_CHAIN_ID:String(plan.chainId),DEPLOYMENT_ADMIN_ADDRESS:plan.administrator}};
 }
 async action(id:string,action:DeploymentAction){
  switch(action.action){
   case 'CANCEL':return publicDeployment(await this.cancel(id));
   case 'PREPARE':return publicDeployment(await this.prepare(id));
   case 'BEGIN':return publicDeployment(await this.begin(id,action.stepId));
   case 'REJECTED':return publicDeployment(await this.rejected(id,action.stepId));
   case 'RECONCILE':return publicDeployment(await this.reconcile(id,action.stepId,action.txHash));
   case 'RETRY_FAILED':return publicDeployment(await this.retryFailed(id,action.stepId));
   case 'EXPORT':return this.manifest(id);
   case 'REFRESH':{let plan=await this.load(id);await this.assertContext(plan);await this.assertConfirmed(plan);const step=plan.steps.find(s=>s.state==='SUBMITTED');if(step?.txHash)plan=await this.reconcile(id,step.id,step.txHash);return publicDeployment(plan);}
  }
 }
}
