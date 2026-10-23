require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function route({databaseError=false,identityError=false,redisError=false,whatsappSchemaError=false,deploymentSchemaError=false}={}){
  const filename=path.resolve('src/app/api/health/ready/route.ts'),unit=new Module(filename,module);unit.filename=filename;unit.paths=Module._nodeModulePaths(path.dirname(filename));
  const state={disconnected:0};class Redis{on(){}async connect(){if(redisError)throw new Error('private-redis-url');}async ping(){return'PONG';}disconnect(){state.disconnected++;}}
  const mocks={'@/lib/db':{prisma:{$queryRaw:async query=>{if(databaseError||whatsappSchemaError&&String(query).includes('WhatsAppInbox')||deploymentSchemaError&&String(query).includes('RegistryDeployment'))throw new Error('private-db-url');}}},'@/lib/deployment/identity':{deploymentConfig:()=>({}),assertDeployment:async()=>{if(identityError)throw new Error('wrong-cluster-secret-context');}},ioredis:{default:Redis,__esModule:true}};
  unit.require=key=>Object.hasOwn(mocks,key)?mocks[key]:Module.prototype.require.call(unit,key);
  unit._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return{get:unit.exports.GET,state};
}
test('readiness checks database, cluster binding and Redis without disclosing infrastructure',async()=>{
  const keys=['NODE_ENV','HONEYCHAIN_CLUSTER_MODE','REDIS_URL'],old=keys.map(key=>process.env[key]);Object.assign(process.env,{NODE_ENV:'production',HONEYCHAIN_CLUSTER_MODE:'isolated',REDIS_URL:'redis://unit.invalid'});
  try{const r=route(),response=await r.get();assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ready'});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(r.state.disconnected,1);}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});

test('enabled WhatsApp requires verification secrets and durable schema before readiness',async()=>{
 const keys=['NODE_ENV','REDIS_URL','WHATSAPP_PHONE_ID','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN'],old=keys.map(key=>process.env[key]);
 Object.assign(process.env,{NODE_ENV:'test',WHATSAPP_PHONE_ID:'synthetic',WHATSAPP_APP_SECRET:'synthetic-secret',WHATSAPP_VERIFY_TOKEN:'synthetic-verify'});delete process.env.REDIS_URL;
 try{assert.equal((await route().get()).status,200);assert.equal((await route({whatsappSchemaError:true}).get()).status,503);delete process.env.WHATSAPP_APP_SECRET;assert.equal((await route().get()).status,503);}
 finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});
test('database, Redis and wrong-cluster failures return the same unavailable response',async()=>{
  const keys=['NODE_ENV','HONEYCHAIN_CLUSTER_MODE','REDIS_URL'],old=keys.map(key=>process.env[key]);Object.assign(process.env,{NODE_ENV:'production',HONEYCHAIN_CLUSTER_MODE:'isolated',REDIS_URL:'redis://unit.invalid'});
  try{for(const failure of[{databaseError:true},{identityError:true},{redisError:true}]){const r=route(failure),response=await r.get();assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'unavailable'});}}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});
test('production readiness cannot claim healthy login protection without Redis configured',async()=>{
  const keys=['NODE_ENV','REDIS_URL'],old=keys.map(key=>process.env[key]);process.env.NODE_ENV='production';delete process.env.REDIS_URL;
  try{assert.equal((await route().get()).status,503);}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});


test('configured wallet deployment requires its durable schema before readiness',async()=>{
 const keys=['NODE_ENV','REDIS_URL','DEPLOYMENT_ADMIN_ADDRESS'],old=keys.map(key=>process.env[key]);
 Object.assign(process.env,{NODE_ENV:'test',DEPLOYMENT_ADMIN_ADDRESS:'0x'+'1'.repeat(40)});delete process.env.REDIS_URL;
 try{assert.equal((await route().get()).status,200);assert.equal((await route({deploymentSchemaError:true}).get()).status,503);}
 finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}
});
