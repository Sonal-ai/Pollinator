require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {loadRuntimeSecrets,validateRuntimeService}=require('../scripts/runtime-config.cjs');
const {assertDeployment,bindDeployment,deploymentConfig}=require('../src/lib/deployment/identity.ts');
const config={clusterId:'unit-cluster-a',chainId:80002,registryAddress:'0x'+'1'.repeat(40),forwarderAddress:'0x'+'2'.repeat(40),genesisHash:'0x'+'3'.repeat(64)};
test('mounted secrets reject conflicting sources, empty files and oversized values without printing contents',()=>{
  const base=path.resolve('.local-data'),dir=path.join(base,'runtime-unit-'+randomUUID());fs.mkdirSync(dir,{recursive:true});
  try{
    const file=path.join(dir,'secret');fs.writeFileSync(file,'test-only-random-value\r\n');const env={JWT_SECRET_FILE:file};loadRuntimeSecrets(env);assert.equal(env.JWT_SECRET,'test-only-random-value');assert.equal(env.JWT_SECRET_FILE,undefined);
    assert.throws(()=>loadRuntimeSecrets({JWT_SECRET:'already-set',JWT_SECRET_FILE:file}),/exactly one source/);
    fs.writeFileSync(file,'\n');assert.throws(()=>loadRuntimeSecrets({JWT_SECRET_FILE:file}),/Invalid secret value/);
    fs.writeFileSync(file,Buffer.alloc(65537));assert.throws(()=>loadRuntimeSecrets({JWT_SECRET_FILE:file}),/Invalid secret file/);
  }finally{if(!dir.startsWith(base+path.sep))throw new Error('Unexpected test cleanup path');fs.rmSync(dir,{recursive:true});}
});
test('runtime services validate only their own required secrets and reject example keys',()=>{
  validateRuntimeService('chain',{DATABASE_URL:'postgresql://local/db',RELAYER_PRIVATE_KEY:'0x'+'1'.repeat(64)});
  validateRuntimeService('mqtt',{DATABASE_URL:'postgresql://local/db',IOT_CREDENTIAL_KEY:'a'.repeat(64),IOT_MQTT_URL:'mqtts://local',IOT_MQTT_CLIENT_ID:'unit-client'});
  const whatsapp={DATABASE_URL:'postgresql://local/db',WHATSAPP_PHONE_ID:'synthetic-phone-id',WHATSAPP_ACCESS_TOKEN:'synthetic-token',ADMIN_API_KEY:'x'.repeat(40),APP_ORIGIN:'https://unit.example.invalid'};
  validateRuntimeService('whatsapp',whatsapp);
  for(const key of Object.keys(whatsapp)){const incomplete={...whatsapp};delete incomplete[key];assert.throws(()=>validateRuntimeService('whatsapp',incomplete));}
  assert.throws(()=>validateRuntimeService('web',{DATABASE_URL:'postgresql://local/db',REDIS_URL:'redis://local',JWT_SECRET:'change_me'+'x'.repeat(40),QR_HMAC_SECRET:'x'.repeat(40)}));
});
test('feature configuration does not require unrelated AWS or WhatsApp credentials',()=>{
  const {env}=require('../src/lib/env.ts');const keys=['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','WHATSAPP_PHONE_ID','WHATSAPP_ACCESS_TOKEN'];const saved=keys.map(key=>process.env[key]);keys.forEach(key=>delete process.env[key]);
  try{assert.ok(env.BLOCKCHAIN_NETWORK);assert.throws(()=>env.WHATSAPP_PHONE_ID,/WHATSAPP_PHONE_ID/);}finally{keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});}
});
test('a database cannot be rebound to another cooperative, chain, forwarder or registry',async()=>{
  let created=false;const db={deploymentIdentity:{findUnique:async()=>config,create:async()=>{created=true;throw new Error('Unexpected write');}}};
  await assertDeployment(db,{...config,registryAddress:config.registryAddress.toUpperCase().replace('0X','0x')});
  for(const change of [{clusterId:'unit-cluster-b'},{chainId:31337},{registryAddress:'0x'+'4'.repeat(40)},{forwarderAddress:'0x'+'5'.repeat(40)},{genesisHash:'0x'+'6'.repeat(64)}])await assert.rejects(bindDeployment(db,{...config,...change}),/does not match/);
  assert.equal(created,false);
});
test('binding is idempotent and an unbound database cannot start a release service',async()=>{
  let stored=null,writes=0;const db={deploymentIdentity:{findUnique:async()=>stored,create:async({data})=>{writes++;stored=data;return data;}}};
  await assert.rejects(assertDeployment(db,config),/does not match/);await bindDeployment(db,config);await bindDeployment(db,config);assert.equal(writes,1);await assertDeployment(db,config);
});
test('production configuration refuses local fixture signing and non-HTTPS origins',()=>{
  const keys=['NODE_ENV','HONEYCHAIN_CLUSTER_MODE','CLUSTER_ID','REGISTRY_CHAIN_ID','CONTRACT_ADDRESS','REGISTRY_FORWARDER_ADDRESS','REGISTRY_GENESIS_HASH','BLOCKCHAIN_NETWORK','NEXT_PUBLIC_APP_URL','APP_ORIGIN','LOCAL_TEST_SIGNING','LOCAL_PRIVATE_KEY'];const old=keys.map(key=>process.env[key]);
  Object.assign(process.env,{NODE_ENV:'production',HONEYCHAIN_CLUSTER_MODE:'isolated',CLUSTER_ID:config.clusterId,REGISTRY_CHAIN_ID:'80002',CONTRACT_ADDRESS:config.registryAddress,REGISTRY_FORWARDER_ADDRESS:config.forwarderAddress,REGISTRY_GENESIS_HASH:config.genesisHash,BLOCKCHAIN_NETWORK:'amoy',NEXT_PUBLIC_APP_URL:'https://unit.example.invalid'});delete process.env.LOCAL_PRIVATE_KEY;delete process.env.LOCAL_TEST_SIGNING;
  delete process.env.APP_ORIGIN;
  try{assert.equal(deploymentConfig().clusterId,config.clusterId);process.env.LOCAL_TEST_SIGNING='true';assert.throws(deploymentConfig,/fixture/);delete process.env.LOCAL_TEST_SIGNING;process.env.APP_ORIGIN='http://unit.example.invalid';assert.throws(deploymentConfig,/HTTPS/);}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});
test('runtime cluster origin takes precedence over an image build origin',()=>{
  const {serverAppOrigin}=require('../src/lib/app-origin.ts'),{allowedRequestOrigin}=require('../src/lib/request-origin.ts');const keys=['APP_ORIGIN','NEXT_PUBLIC_APP_URL','NODE_ENV'],old=keys.map(key=>process.env[key]);
  Object.assign(process.env,{APP_ORIGIN:'https://cluster-b.example.invalid',NEXT_PUBLIC_APP_URL:'https://cluster-a.example.invalid',NODE_ENV:'production'});
  try{assert.equal(serverAppOrigin(),'https://cluster-b.example.invalid');assert.equal(allowedRequestOrigin(new Request('http://web:3000/api/anything',{headers:{Origin:'https://cluster-b.example.invalid'}})),true);assert.equal(allowedRequestOrigin(new Request('http://web:3000/api/anything',{headers:{Origin:'https://cluster-a.example.invalid'}})),false);}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});
