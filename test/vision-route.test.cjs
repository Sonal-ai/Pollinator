require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {assessVisionOutput}=require('../src/lib/vision-result.ts');
const session={role:'beekeeper',beekeeperId:'owner-a',walletAddress:'0x'+'a'.repeat(40),accountId:'a'};
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(8)]);
function route(identity=session,override={}){
  const file=path.resolve('src/app/api/detect/varroa/route.ts'),unit=new Module(file,module);unit.filename=file;unit.paths=Module._nodeModulePaths(path.dirname(file));
  const state={calls:0,saved:null};
  const mocks={'@/lib/auth':{getSession:async()=>identity},'@/lib/db':{prisma:{hive:{findFirst:async()=>null},aIInference:{create:async({data})=>{state.saved=data;return{id:'inference-a'};}}}},'@/lib/varroa-detector':{detectVarroaFromBuffer:async()=>{state.calls++;return assessVisionOutput({success:true,detections:[]},'unit-endpoint',1);}},...override};
  unit.require=function(key){if(Object.hasOwn(mocks,key))return mocks[key];if(key.startsWith('@/lib/'))return require('../src/lib/'+key.slice(6)+'.ts');return Module.prototype.require.call(this,key);};
  unit._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
  return {post:unit.exports.POST,state};
}
const request=(body,origin='https://pollinator.example')=>new Request('https://pollinator.example/api/detect/varroa',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
test('image inference requires authentication and the correct role before paid inference',async()=>{
  for(const [identity,status]of [[null,401],[{...session,role:'processor'},403]]){const r=route(identity);assert.equal((await r.post(request({image:png.toString('base64')}))).status,status);assert.equal(r.state.calls,0);}
});
test('a valid image can remain unassigned; empty inference is stored as uncertain with zero evidence confidence',async()=>{
  const r=route(),response=await r.post(request({image:png.toString('base64')}));assert.equal(response.status,200);assert.equal(r.state.saved.hiveId,null);assert.equal(r.state.saved.beekeeperId,'owner-a');assert.equal(r.state.saved.prediction,'uncertain');assert.equal(r.state.saved.confidence,0);
});
test('another farmer hive cannot receive an inference record',async()=>{
  const r=route();assert.equal((await r.post(request({image:png.toString('base64'),hiveId:'foreign-hive'}))).status,404);assert.equal(r.state.calls,0);assert.equal(r.state.saved,null);
});
test('non-image bytes and malformed base64 are rejected before the endpoint',async()=>{
  for(const image of ['not-base64',Buffer.from('%PDF-1.4 Not a JPG').toString('base64')]){const r=route();assert.ok([400,422].includes((await r.post(request({image}))).status));assert.equal(r.state.calls,0);}
});
test('endpoint failures return unavailable and never save a fabricated healthy result',async()=>{
  const r=route(session,{'@/lib/varroa-detector':{detectVarroaFromBuffer:async()=>{throw new Error('Timeout');}}});assert.equal((await r.post(request({image:png.toString('base64')}))).status,503);assert.equal(r.state.saved,null);
});
test('cross-site image submissions are rejected before storage or inference',async()=>{
  const r=route();assert.equal((await r.post(request({image:png.toString('base64')},'https://untrusted.example'))).status,403);assert.equal(r.state.calls,0);
});
