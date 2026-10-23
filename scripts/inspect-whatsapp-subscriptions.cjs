const fs=require('node:fs');require('dotenv').config({path:'.env',override:true,quiet:true});
const token=process.env.WHATSAPP_ACCESS_TOKEN,version=process.env.WHATSAPP_GRAPH_VERSION||'v26.0';
const result={checkedAt:new Date().toISOString(),readOnly:true,messagesSent:0,settingsChanged:false};
async function get(path,auth=token){const r=await fetch('https://graph.facebook.com/'+version+'/'+path,{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(12000)});let data;try{data=await r.json();}catch{}return{status:r.status,data};}
(async()=>{
 try{
  if(!token)throw new Error('NOT_CONFIGURED');
  const debug=await get('debug_token?input_token='+encodeURIComponent(token));result.tokenInspection={httpStatus:debug.status,apiErrorCode:debug.data?.error?.code??null};
  const data=debug.data?.data;
  if(data){result.tokenInspection.valid=data.is_valid===true;result.tokenInspection.permissions=Array.isArray(data.scopes)?data.scopes.filter(s=>/whatsapp|business_management/.test(s)):[];}
  const appId=data?.app_id,targets=[...new Set((data?.granular_scopes||[]).filter(s=>s.scope==='whatsapp_business_management'||s.scope==='whatsapp_business_messaging').flatMap(s=>s.target_ids||[]))].filter(id=>/^\d+$/.test(id)).slice(0,3);
  result.accessibleBusinessTargetCount=targets.length;
  if(appId&&/^\d+$/.test(appId)&&process.env.WHATSAPP_APP_SECRET){
   const subscriptions=await get(appId+'/subscriptions',appId+'|'+process.env.WHATSAPP_APP_SECRET);
   result.appSubscriptions={httpStatus:subscriptions.status,apiErrorCode:subscriptions.data?.error?.code??null};
   if(Array.isArray(subscriptions.data?.data)){
    result.appSubscriptions.entries=subscriptions.data.data.map(entry=>({object:entry.object,active:entry.active,fields:(entry.fields||[]).map(f=>f.name||f).filter(x=>typeof x==='string'),callbackConfigured:!!entry.callback_url,callbackUsesHttps:typeof entry.callback_url==='string'&&entry.callback_url.startsWith('https:')}));
    const entry=subscriptions.data.data.find(row=>row.object==='whatsapp_business_account');
    if(entry?.callback_url){
     const callback=new URL(entry.callback_url),expected=new URL(process.env.APP_ORIGIN||process.env.NEXT_PUBLIC_APP_URL);
     result.callbackCheck={matchesConfiguredOrigin:callback.origin===expected.origin,pathMatchesCurrentRoute:callback.pathname==='/api/webhook/whatsapp',readOnly:true};
     result.callbackCheck.registeredOriginAndPath=callback.origin+callback.pathname;
     result.callbackCheck.credentialProbePerformed=false;
     result.callbackCheck.probeSkipped='Automatic approval review rejected verification-token egress to the callback; no retry or workaround';
    }
   }
  }
  result.businessSubscriptions=[];
  for(const id of targets){const response=await get(id+'/subscribed_apps');result.businessSubscriptions.push({accountSuffix:id.slice(-4),httpStatus:response.status,apiErrorCode:response.data?.error?.code??null,subscribedAppCount:Array.isArray(response.data?.data)?response.data.data.length:null,currentAppPresent:Array.isArray(response.data?.data)?response.data.data.some(item=>String(item.whatsapp_business_api_data?.id)===String(appId)):null});}
 }catch{result.failure='READ_ONLY_INSPECTION_UNAVAILABLE';}
 fs.writeFileSync('docs/qa/meta-subscription-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})();
