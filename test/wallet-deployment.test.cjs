require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),{ethers}=require('ethers');
const {validateEnrollment}=require('../src/lib/deployment/wallet-protocol.ts'),{checkDeploymentWallet,sendPreparedDeployment}=require('../src/lib/deployment/browser-wallet.ts'),load=require('./helpers/load-ts.cjs');
const wallets=Array.from({length:7},()=>ethers.Wallet.createRandom().address),admin=wallets[0],enrollment={relayer:wallets[1],actors:Object.fromEntries(['beekeeper','lab','processor','distributor','retailer'].map((role,i)=>[role,wallets[i+2]]))};
test('wallet roles reject administrator sharing, relayer sharing, actor duplication and invalid addresses',()=>{
 assert.equal(validateEnrollment(enrollment,admin).relayer,enrollment.relayer.toLowerCase());
 for(const bad of [{...enrollment,relayer:admin},{...enrollment,actors:{...enrollment.actors,lab:enrollment.relayer}},{...enrollment,actors:{...enrollment.actors,lab:enrollment.actors.beekeeper}},{...enrollment,relayer:ethers.ZeroAddress},{...enrollment,relayer:'0xnot-an-address'}])assert.throws(()=>validateEnrollment(bad,admin));
});
const transaction={from:admin,chainId:'0x13882',nonce:'0x0',data:'0x1234',value:'0x0'};
test('wallet network and account are checked before recording any possible send',async()=>{
 for(const [accounts,chain] of [[[wallets[1]],'0x13882'],[[admin],'0x1']]){
  let began=0,sends=0;const provider={request:async({method})=>{if(method==='eth_chainId')return chain;if(method==='eth_sendTransaction'){sends++;return'0x'+'1'.repeat(64);}return accounts;}};
  await assert.rejects(sendPreparedDeployment(provider,admin,80002,transaction,async()=>{began++;},()=>{}));assert.equal(began,0);assert.equal(sends,0);
 }
});
test('an account switch after begin cannot reach wallet submission',async()=>{
 let accounts=0,began=0,sends=0;const provider={request:async({method})=>{if(method==='eth_chainId')return'0x13882';if(method==='eth_sendTransaction'){sends++;return'0x'+'2'.repeat(64);}return[++accounts===1?admin:wallets[1]];}};
 await assert.rejects(sendPreparedDeployment(provider,admin,80002,transaction,async()=>{began++;},()=>{}));assert.equal(began,1);assert.equal(sends,0);
});
test('wallet send keeps the exact nonce and remembers the hash before returning',async()=>{
 const order=[],hash='0x'+'3'.repeat(64),provider={request:async({method,params})=>{if(method==='eth_chainId')return'0x13882';if(method==='eth_sendTransaction'){order.push('send');assert.deepEqual(params,[transaction]);return hash;}return[admin];}};
 assert.equal(await sendPreparedDeployment(provider,admin,80002,transaction,async()=>{order.push('begin');},value=>{assert.equal(value,hash);order.push('remember');}),hash);assert.deepEqual(order,['begin','send','remember']);
});
test('a transport failure never repeats a wallet submission or invents a transaction hash',async()=>{
 let sends=0,remembered=0;const provider={request:async({method})=>{if(method==='eth_chainId')return'0x13882';if(method==='eth_sendTransaction'){sends++;throw new Error('Disconnected after possible submission');}return[admin];}};
 await assert.rejects(sendPreparedDeployment(provider,admin,80002,transaction,async()=>{},()=>{remembered++;}));assert.equal(sends,1);assert.equal(remembered,0);
 await assert.rejects(checkDeploymentWallet(provider,wallets[1],80002));
});
function gate(session){let constructed=0,closed=0;class Service{constructor(){constructed++;this.provider={destroy:()=>{closed++;}}}}
 const api=load('src/lib/deployment/wallet-api.ts',{'../auth':{getSession:async()=>session},'../db':{prisma:{}},'./wallet-deployment':{WalletDeploymentService:Service}});
 return{call:api.walletDeploymentRequest,counts:()=>({constructed,closed})};
}
test('deployment API rejects anonymous and non-admin requests before any provider is created',async()=>{
 for(const [session,status] of [[null,401],[{role:'beekeeper'},403]]){const api=gate(session);const response=await api.call(new Request('https://unit.invalid/api/registry-deployments'),false,async()=>{throw new Error('Unauthorized callback');});assert.equal(response.status,status);assert.equal(api.counts().constructed,0);}
});
test('administrator writes enforce origin, bounded bodies, secret-safe failures and provider disposal',async()=>{
 const old=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://unit.invalid';
 const request=(origin,body)=>new Request('https://unit.invalid/api/registry-deployments',{method:'POST',headers:{Origin:origin},body});
 try{
  const api=gate({role:'admin',accountId:'verified-admin'});
  assert.equal((await api.call(request('https://other.invalid','{}'),true,async()=>({}))).status,403);
  assert.equal((await api.call(request('https://unit.invalid','x'.repeat(4097)),true,async()=>({}))).status,413);assert.equal(api.counts().constructed,0);
  const ok=await api.call(request('https://unit.invalid','{}'),true,async(_service,actor)=>({actor}));assert.equal(ok.status,200);assert.equal((await ok.json()).actor,'verified-admin');assert.equal(ok.headers.get('cache-control'),'no-store');
  const bad=await api.call(request('https://unit.invalid','{}'),true,async()=>{throw new Error('PRIVATE_RPC_CREDENTIAL');});assert.equal(bad.status,503);assert.ok(!(await bad.text()).includes('PRIVATE_RPC_CREDENTIAL'));assert.deepEqual(api.counts(),{constructed:2,closed:2});
 }finally{if(old===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=old;}
});
