require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict');
const {HiveBleConnection,HIVE_BLE_SERVICE,HIVE_BLE_TELEMETRY,HIVE_BLE_COMMAND}=require('../src/lib/telemetry/bluetooth.ts');
function fixture(){
 const state={writes:[],active:0,maximum:0,selection:null,notifications:0,stopped:0};
 class Characteristic extends EventTarget{
  async startNotifications(){state.notifications++;return this;}
  async stopNotifications(){state.stopped++;return this;}
  async writeValueWithResponse(value){state.active++;state.maximum=Math.max(state.maximum,state.active);await new Promise(resolve=>setImmediate(resolve));state.writes.push(Buffer.from(value));state.active--;}
 }
 const telemetry=new Characteristic(),command=new Characteristic(),device=new EventTarget();device.name='Synthetic BLE fixture';
 device.gatt={connected:false,connect:async()=>{device.gatt.connected=true;return device.gatt;},disconnect:()=>{const was=device.gatt.connected;device.gatt.connected=false;if(was)device.dispatchEvent(new Event('gattserverdisconnected'));},
  getPrimaryService:async uuid=>{assert.equal(uuid,HIVE_BLE_SERVICE);return{getCharacteristic:async name=>name===HIVE_BLE_TELEMETRY?telemetry:name===HIVE_BLE_COMMAND?command:null};}};
 const adapter={requestDevice:async options=>{state.selection=options;return device;}};
 function notify(bytes){const owned=Uint8Array.from(bytes);telemetry.value=new DataView(owned.buffer);telemetry.dispatchEvent(new Event('characteristicvaluechanged'));}
 return{state,adapter,device,notify};
}
test('BLE connects only through the advertised service and serializes 20-byte command writes',async()=>{
 const f=fixture(),connection=await HiveBleConnection.connect(f.adapter,{frame:async()=>{},disconnected:()=>{},error:()=>{}});
 try{const receipt={payload:'A'.repeat(200),signature:'ab'.repeat(32)};await Promise.all([connection.rewind(),connection.next(),connection.acknowledge(receipt)]);
  assert.deepEqual(f.state.selection,{filters:[{services:[HIVE_BLE_SERVICE]}]});assert.equal(f.state.notifications,1);assert.equal(f.state.maximum,1);assert.ok(f.state.writes.every(x=>x.length<=20));
  const commands=Buffer.concat(f.state.writes).toString().trim().split('\n').map(JSON.parse);assert.deepEqual(commands,[{command:'rewind'},{command:'next'},{command:'ack',receipt}]);
 }finally{connection.disconnect();}
});
test('an external BLE disconnect stops notifications and cannot keep delivering frames',async()=>{
 const f=fixture();let frames=0,disconnected=0;
 const connection=await HiveBleConnection.connect(f.adapter,{frame:async()=>{frames++;},disconnected:()=>{disconnected++;},error:()=>{}});
 f.notify(Buffer.from('{"event":"idle"}\n'));await new Promise(resolve=>setImmediate(resolve));assert.equal(frames,1);
 f.device.gatt.disconnect();f.notify(Buffer.from('{"event":"idle"}\n'));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(disconnected,1);assert.equal(frames,1);await assert.rejects(connection.next(),/Reconnect/);assert.equal(f.state.stopped,1);
});
test('malformed notification input disconnects without acknowledging a reading',async()=>{
 const f=fixture();let errors=0,frames=0;
 await HiveBleConnection.connect(f.adapter,{frame:async()=>{frames++;},disconnected:()=>{},error:()=>{errors++;}});
 f.notify(Buffer.alloc(8193,65));await new Promise(resolve=>setImmediate(resolve));assert.equal(errors,1);assert.equal(frames,0);assert.equal(f.device.gatt.connected,false);assert.equal(f.state.writes.length,0);
});
test('a stalled GATT write times out without deleting a journal entry',async()=>{
 const f=fixture();let disconnected=0;
 const original=f.device.gatt.getPrimaryService;
 f.device.gatt.getPrimaryService=async uuid=>{const service=await original(uuid),lookup=service.getCharacteristic;return{getCharacteristic:async name=>{const characteristic=await lookup(name);if(name===HIVE_BLE_COMMAND)characteristic.writeValueWithResponse=()=>new Promise(()=>{});return characteristic;}};};
 const connection=await HiveBleConnection.connect(f.adapter,{frame:async()=>{},disconnected:()=>{disconnected++;},error:()=>{}});
 await assert.rejects(connection.next(),/timed out/);assert.equal(disconnected,1);assert.equal(f.device.gatt.connected,false);await assert.rejects(connection.next(),/Reconnect/);
});
test('a notification flood cannot create an unbounded receive promise queue',async()=>{
 const f=fixture();let errors=0,frames=0;
 await HiveBleConnection.connect(f.adapter,{frame:async()=>{frames++;},disconnected:()=>{},error:()=>{errors++;}});
 f.notify(Buffer.from('{"event":"idle"}\n'.repeat(17)));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(errors,1);assert.equal(frames,0);assert.equal(f.device.gatt.connected,false);
});
