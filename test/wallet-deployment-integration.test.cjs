const {test,before,after,afterEach}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('dotenv').config({path:'.env.integration',override:true,quiet:true});
const url=new URL(process.env.DATABASE_URL||'');if(url.hostname!=='127.0.0.1'||url.port!=='55432'||url.pathname!=='/pollinator_integration'||process.env.LOCAL_RPC_URL!=='http://127.0.0.1:8545')throw new Error('Owned local fixtures only');
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {ethers}=require('ethers'),{PrismaClient}=require('@prisma/client'),{WalletDeploymentService,publicDeployment}=require('../src/lib/deployment/wallet-deployment.ts');
const db=new PrismaClient(),service=new WalletDeploymentService(db,process.env.LOCAL_RPC_URL,31337,1),plans=[];let administrator;
function actors(){return{relayer:ethers.Wallet.createRandom().address,actors:Object.fromEntries(['beekeeper','lab','processor','distributor','retailer'].map(role=>[role,ethers.Wallet.createRandom().address]))};}
async function create(input=actors()){const plan=await service.create('synthetic-local-admin',input);plans.push(plan.id);return plan;}
async function send(plan){const step=plan.steps.find(s=>s.state!=='CONFIRMED');await service.begin(plan.id,step.id);const hash=await service.provider.send('eth_sendTransaction',[publicDeployment(plan).steps.find(s=>s.id===step.id).transaction]);return{step,hash};}
before(async()=>{assert.equal((await service.provider.getNetwork()).chainId,31337n);const manifest=JSON.parse(fs.readFileSync('.local-data/integration-chain.json'));assert.equal((await service.provider.getBlock(0)).hash,manifest.genesisHash);administrator=await(await service.provider.getSigner(0)).getAddress();process.env.DEPLOYMENT_ADMIN_ADDRESS=administrator;});
afterEach(async()=>{await db.registryDeployment.updateMany({where:{id:{in:plans}},data:{state:'TEST_ARCHIVED'}});});
after(async()=>{service.provider.destroy();await db.$disconnect();});
test('duplicate creation is idempotent and conflicting enrollment cannot start a second active deployment',async()=>{
 const input=actors(),one=await create(input),two=await create(input);assert.equal(one.id,two.id);await assert.rejects(service.create('synthetic-local-admin',actors()),/existing deployment/);
 const changed={...input,relayer:administrator};await assert.rejects(service.create('synthetic-local-admin',changed),/distinct/);
});
test('wallet rejection retains one nonce; duplicate begin and prepare after unknown are fenced',async()=>{
 const plan=await service.prepare((await create()).id),step=plan.steps[0],nonce=step.nonce;
 await service.begin(plan.id,step.id);await assert.rejects(service.begin(plan.id,step.id));await assert.rejects(service.prepare(plan.id));
 const restored=await service.rejected(plan.id,step.id);assert.equal(restored.steps[0].nonce,nonce);assert.equal(restored.steps[0].state,'PREPARED');
 assert.equal((await service.prepare(plan.id)).steps[0].predictedAddress,step.predictedAddress);
});
test('a mismatching transaction hash cannot bind or confirm a deployment step',async()=>{
 const plan=await service.prepare((await create()).id),step=plan.steps[0];await service.begin(plan.id,step.id);
 const unrelated=await(await service.provider.getSigner(0)).sendTransaction({to:administrator,value:0});await unrelated.wait();
 await assert.rejects(service.reconcile(plan.id,step.id,unrelated.hash),/does not match/);
 const stored=await service.load(plan.id);assert.equal(stored.steps[0].txHash,null);assert.equal(stored.steps[0].state,'UNKNOWN');await assert.rejects(service.rejected(plan.id,step.id),/nonce advanced/);
});
test('seven real local transactions recover lost wallet response and export only verified separated roles',async()=>{
 let plan=await create();await assert.rejects(service.manifest(plan.id),/seven transactions/);
 for(let ordinal=0;ordinal<7;ordinal++){
  plan=await service.prepare(plan.id);const prepared=plan.steps[ordinal],{hash}=await send(plan);
  if(ordinal===0){const restarted=new WalletDeploymentService(db,process.env.LOCAL_RPC_URL,31337,1);try{await assert.rejects(restarted.prepare(plan.id),/Reconcile/);plan=await restarted.reconcile(plan.id,prepared.id,hash);}finally{restarted.provider.destroy();}}
  else plan=await service.reconcile(plan.id,prepared.id,hash);
  assert.equal(plan.steps[ordinal].state,'CONFIRMED');
 }
 assert.equal(plan.state,'COMPLETE');const manifest=await service.manifest(plan.id);assert.equal(manifest.registryVersion,2);assert.equal(manifest.receipts.length,7);assert.equal(manifest.activationRequired,true);assert.equal(manifest.webAccountsProvisioned,false);
 const registry=new ethers.Contract(manifest.registryAddress,require('../artifacts/contracts/HoneyChain.sol/HoneyChain.json').abi,await service.provider.getSigner(0));
 await(await registry.grantRole(ethers.id('LAB_ROLE'),plan.relayer)).wait();await assert.rejects(service.manifest(plan.id),/gas relayer/);
 assert.equal(await registry.hasRole(ethers.ZeroHash,administrator),true);
 assert.equal((await db.registryDeploymentStep.count({where:{deploymentId:plan.id}})),7);
});

test('unused plans can be cancelled; uncertain wallet requests cannot be discarded',async()=>{
 const unused=await create();assert.equal((await service.cancel(unused.id)).state,'CANCELLED');await assert.rejects(service.prepare(unused.id));assert.ok((await service.list()).every(plan=>['IN_PROGRESS','REVIEW','COMPLETE'].includes(plan.state)));
 const prepared=await service.prepare((await create()).id);await service.begin(prepared.id,prepared.steps[0].id);await assert.rejects(service.cancel(prepared.id));await service.rejected(prepared.id,prepared.steps[0].id);await assert.rejects(service.cancel(prepared.id));
});


test('orphaned success receipts block the next transaction despite matching stored receipt hashes',async()=>{
 let plan=await service.prepare((await create()).id);const {step,hash}=await send(plan);plan=await service.reconcile(plan.id,step.id,hash);
 const getBlock=service.provider.getBlock.bind(service.provider),height=plan.steps[0].receiptBlock;
 service.provider.getBlock=async(...args)=>args[0]===height?{hash:'0x'+'f'.repeat(64)}:getBlock(...args);
 try{await assert.rejects(service.prepare(plan.id),/canonical chain/);}
 finally{service.provider.getBlock=getBlock;}
 assert.equal((await service.prepare(plan.id)).steps[1].state,'PREPARED');
});

test('only canonical reverted receipts permit explicit retry, preserving the failed attempt',async()=>{
 const plan=await service.prepare((await create()).id),step=plan.steps[0];await service.begin(plan.id,step.id);
 const transaction={...publicDeployment(plan).steps[0].transaction,gas:'0x493e0'};let hash;
 try{hash=await service.provider.send('eth_sendTransaction',[transaction]);}catch(error){
  hash=error.info?.error?.data?.txHash||error.data?.txHash;
  if(!hash){const block=await service.provider.getBlock('latest',true);hash=block?.prefetchedTransactions.find(tx=>tx.from.toLowerCase()===administrator.toLowerCase()&&tx.nonce===step.nonce&&tx.data===step.data)?.hash;}
 }
 assert.match(hash||'',/^0x[0-9a-f]{64}$/i,'Local EVM must return the mined out-of-gas transaction hash');
 const failed=await service.reconcile(plan.id,step.id,hash);assert.equal(failed.steps[0].state,'FAILED');
 const getBlock=service.provider.getBlock.bind(service.provider),height=failed.steps[0].receiptBlock;
 service.provider.getBlock=async(...args)=>args[0]===height?{hash:'0x'+'e'.repeat(64)}:getBlock(...args);
 try{await assert.rejects(service.retryFailed(plan.id,step.id),/canonical chain/);}
 finally{service.provider.getBlock=getBlock;}
 const retried=await service.retryFailed(plan.id,step.id);assert.equal(retried.steps[0].state,'PENDING');assert.equal(retried.steps[0].failedAttempts[0].txHash,hash);
 const prepared=await service.prepare(plan.id);assert.equal(prepared.steps[0].nonce,step.nonce+1);
});
