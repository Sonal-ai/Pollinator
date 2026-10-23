// One signed synthetic packet, with a durable outbox for uncertain acknowledgements.
const fs=require('node:fs'),path=require('node:path');
require('dotenv').config({path:process.env.POLLINATOR_ENV_FILE||'.env',quiet:true});
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {signPacket}=require('../src/lib/telemetry/protocol.ts');
const deviceId=process.argv[2];
if(!deviceId||!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(deviceId)) throw new Error('Use node scripts/simulate-iot.js ENROLLED_SIM_DEVICE_ID');
const root=path.resolve('.local-data'),file=path.join(root,'devices',deviceId+'.json'),queue=path.join(root,'outbox',deviceId+'.json'),lock=queue+'.lock';
fs.mkdirSync(path.dirname(queue),{recursive:true});
const credential=JSON.parse(fs.readFileSync(file,'utf8'));
if(credential.deviceId!==deviceId||credential.source!=='SIMULATED')throw new Error('The simulator only accepts an enrolled synthetic fixture credential');
const target=new URL('/api/sensor-data',process.env.NEXT_PUBLIC_APP_URL||'http://127.0.0.1:3100');
if(target.protocol!=='https:'&&!(target.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(target.hostname)))throw new Error('Use HTTPS outside localhost');
let held=false;
(async()=>{
  try {
    fs.closeSync(fs.openSync(lock,'wx'));held=true;
    let pending;
    if(fs.existsSync(queue))pending=JSON.parse(fs.readFileSync(queue,'utf8'));
    else {
      const sequence=credential.nextSequence;
      if(!Number.isInteger(sequence)||sequence<0||sequence>=2147483647)throw new Error('Rotate the device credential before its sequence is exhausted');
      const raw=Buffer.from(JSON.stringify({version:1,deviceId,epoch:credential.epoch,sequence,observedAt:new Date().toISOString(),metrics:{tempC:35.1,humidityPct:58,weightKg:40,batteryPct:90}}));
      pending={payload:raw.toString('base64'),signature:signPacket(raw,credential.secret)};
      fs.writeFileSync(queue,JSON.stringify(pending),{flag:'wx'});
    }
    const raw=Buffer.from(pending.payload,'base64'),packet=JSON.parse(raw.toString('utf8'));
    if(packet.epoch!==credential.epoch)throw new Error('Outbox belongs to an older credential epoch. Review it before clearing it.');
    credential.nextSequence=Math.max(credential.nextSequence,packet.sequence+1);
    fs.writeFileSync(file,JSON.stringify(credential,null,2)); // Persist before sending, including after a crash between outbox and counter writes.
    const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json','X-Device-Signature':pending.signature},body:raw,redirect:'error',signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    if(![200,201].includes(response.status)||typeof result.readingId!=='string')throw new Error('No accepted database acknowledgement (HTTP '+response.status+'). The same packet stays in the outbox.');
    fs.unlinkSync(queue);
    console.log('Synthetic packet acknowledged: '+result.readingId+' (source '+result.source+', duplicate '+result.duplicate+').');
  } finally {if(held)fs.unlinkSync(lock);}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
