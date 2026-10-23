require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-ts.cjs');
const {randomUUID}=require('node:crypto');
const identity=require('../src/lib/identity.ts');
function fixture({registered=true,language='en'}={}){
 let session={state:registered?'MAIN_MENU':'IDLE',data:{language}},analyses=0;const sent=[],apiCalls=[],seen=new Set();
 const farmer={id:'farmer-conversation',phone:'+919876543210',name:'Synthetic conversation',region:'Delhi',wallet:'0x'+'a'.repeat(40)};
 const fsm={getSession:async()=>session,setSession:async(_id,state,data)=>{session={state,data};},updateSessionData:async(_id,data)=>{session.data={...session.data,...data};},isDuplicateMessage:async id=>{if(seen.has(id))return true;seen.add(id);return false;}};
 const handler=load('src/lib/whatsapp/handler.ts',{'../identity':identity,'../app-origin':{serverAppOrigin:()=> 'https://app.example.test'},
  '../db':{prisma:{beekeeper:{findMany:async()=>registered?[farmer]:[],create:async()=>{throw new Error('Unexpected registration');}}}},
  './fsm':{fsm,ConversationState:new Proxy({},{get:(_o,key)=>key})},
  './gemini':{analyzeIncomingText:async()=>{analyses++;return{detected_language:language,intent:'HARVEST_MARKET'};},generateOnboardingResponse:async()=>({response:'Register',ready_to_register:false})},
  './client':{whatsapp:{markAsRead:async()=>{},sendText:async(_to,text,lang)=>sent.push({kind:'text',text,lang}),sendButtons:async(_to,text,buttons,lang)=>sent.push({kind:'buttons',text,buttons,lang}),sendList:async()=>sent.push({kind:'menu'})}},
  '../blockchain':{},'../varroa-detector':{}});
 return{sent,apiCalls,handler,session:()=>session,analyses:()=>analyses,
  set:(state,data={})=>{session={state,data:{language,...data}};},
  send:async(text,id=randomUUID(),button)=>handler.handleIncomingMessage({entry:[{changes:[{value:{messages:[{id,from:'919876543210',timestamp:'1700000000',type:button?'interactive':'text',text:{body:text},interactive:button?{type:'button_reply',button_reply:{id:button,title:text}}:undefined}]}}]}]})};
}
test('harvest data stays in its state, preserves grams and language, and does not call intent AI for each field',async()=>{
 const f=fixture({language:'hi'});await f.send('log harvest');assert.equal(f.session().state,'HARVEST_TYPE');
 await f.send('Market flower honey');assert.equal(f.session().state,'HARVEST_QUANTITY');assert.equal(f.session().data.harvest_draft.honeyType,'Market flower honey');
 const key=f.session().data.harvest_draft.requestKey;await f.send('2.5 kg');assert.equal(f.session().state,'HARVEST_CONFIRM');assert.equal(f.session().data.harvest_draft.quantityGrams,2500);assert.equal(f.session().data.harvest_draft.requestKey,key);assert.equal(f.analyses(),1);assert.equal(f.session().data.language,'hi');
 await f.send('yesterday');assert.equal(f.session().state,'HARVEST_CONFIRM');assert.equal(f.sent.at(-1).kind,'buttons');
 await f.send('No',randomUUID(),'harvest_no');assert.equal(f.session().state,'MAIN_MENU');
});
test('invalid quantity retains the same draft, and oversized honey names cannot advance',async()=>{
 const f=fixture();f.set('HARVEST_TYPE');await f.send('x'.repeat(101));assert.equal(f.session().state,'HARVEST_TYPE');
 await f.send('Mustard');const before=f.session().data.harvest_draft;await f.send('5 spoons');assert.equal(f.session().state,'HARVEST_QUANTITY');assert.deepEqual(f.session().data.harvest_draft,before);
});
test('all entries, changes and messages are processed sequentially rather than dropping later messages',async()=>{
 const f=fixture();const message=(text)=>({id:randomUUID(),from:'919876543210',type:'text',text:{body:text}});
 await f.handler.handleIncomingMessage({entry:[{changes:[{value:{messages:[message('harvest'),message('Mustard')]}}]},{changes:[{value:{messages:[message('5000')]}}]}]});
 assert.equal(f.session().state,'HARVEST_CONFIRM');assert.equal(f.session().data.harvest_draft.quantityGrams,5000);
});
test('malformed registration counts do not silently become positive integers',async()=>{
 const f=fixture({registered:false});for(const text of ['-3','2.5','2 hives','100001','0']){f.set('REGISTRATION_HIVE_COUNT',{registration:{name:'Synthetic',region:'Delhi'}});await f.send(text);assert.equal(f.session().state,'REGISTRATION_HIVE_COUNT');}
 await f.send('3');assert.equal(f.session().state,'REGISTRATION_PRACTICES');assert.equal(f.session().data.registration.hivesCount,3);
});
test('Meta client uses configured version and bounded requests without leaking provider errors or retrying uncertain sends',async()=>{
 const clientModule=load('src/lib/whatsapp/client.ts',{'../env':{env:{WHATSAPP_GRAPH_VERSION:'v26.0',WHATSAPP_PHONE_ID:'12345',WHATSAPP_ACCESS_TOKEN:'test-token-not-real'}},'./gemini':{translateResponse:async text=>text}});
 let calls=0;const client=new clientModule.WhatsAppClient(async(url,options)=>{calls++;assert.equal(url,'https://graph.facebook.com/v26.0/12345/messages');assert.ok(options.signal);return Response.json({error:{code:190,message:'SECRET-DO-NOT-LOG'}},{status:401});});
 await assert.rejects(client.sendText('919876543210','test'),e=>e.outcome==='REJECTED'&&e.providerCode===190&&!e.message.includes('SECRET'));assert.equal(calls,1);
 const uncertain=new clientModule.WhatsAppClient(async()=>{calls++;throw new Error('SECRET-DO-NOT-LOG');});
 await assert.rejects(uncertain.sendText('919876543210','test'),e=>e.outcome==='UNKNOWN'&&!e.message.includes('SECRET'));assert.equal(calls,2);
});


test('gateway/server failures and malformed rejection bodies stay unknown without automatic resend',async()=>{
 const {WhatsAppClient}=load('src/lib/whatsapp/client.ts',{'../env':{env:{WHATSAPP_GRAPH_VERSION:'v26.0',WHATSAPP_PHONE_ID:'12345',WHATSAPP_ACCESS_TOKEN:'synthetic'}},'./gemini':{translateResponse:async text=>text}});
 for(const response of [new Response('PRIVATE_PROXY_DETAIL',{status:502}),Response.json({error:{code:1,message:'PRIVATE_DETAIL'}},{status:500}),new Response('PRIVATE_GATEWAY_DETAIL',{status:403}),Response.json({error:{code:'190'}},{status:401})]){
  let sends=0;const client=new WhatsAppClient(async()=>{sends++;return response;});
  await assert.rejects(client.sendText('999000001014','Synthetic test'),error=>error.outcome==='UNKNOWN'&&!error.message.includes('PRIVATE'));assert.equal(sends,1);
 }
});
