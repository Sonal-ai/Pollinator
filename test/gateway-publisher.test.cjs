require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {gatewayMqttOptions}=require('../src/lib/telemetry/gateway-publisher.ts');
const base=path.resolve('.local-data'),directory=path.join(base,'test-gateway-options-'+randomUUID());fs.mkdirSync(directory,{recursive:true});
const options={IOT_GATEWAY_MQTT_URL:'mqtts://broker.example.test:8883'};
for(const [key,name]of [['IOT_GATEWAY_MQTT_CA','ca'],['IOT_GATEWAY_MQTT_CERT','cert'],['IOT_GATEWAY_MQTT_KEY','key']]){options[key]=path.join(directory,name);fs.writeFileSync(options[key],'synthetic config test only');}
after(()=>{const target=path.resolve(directory);if(!target.startsWith(base+path.sep))throw new Error('Unexpected test cleanup target');fs.rmSync(target,{recursive:true});});
test('phone publisher requires TLS, separate client certificate files and certificate verification',()=>{
 const one=gatewayMqttOptions(options),two=gatewayMqttOptions(options);assert.equal(one.options.rejectUnauthorized,true);assert.equal(one.options.protocolVersion,5);assert.equal(one.options.clean,true);assert.equal(one.options.reconnectPeriod,0);assert.notEqual(one.options.clientId,two.options.clientId);assert.ok(Buffer.isBuffer(one.options.key));
 for(const url of ['mqtt://127.0.0.1:1883','mqtts://user:secret@broker.example.test:8883','mqtts://broker.example.test/path','mqtts://broker.example.test?secret=x'])assert.throws(()=>gatewayMqttOptions({...options,IOT_GATEWAY_MQTT_URL:url}),error=>error.status===503);
 for(const name of ['IOT_GATEWAY_MQTT_CA','IOT_GATEWAY_MQTT_CERT','IOT_GATEWAY_MQTT_KEY'])assert.throws(()=>gatewayMqttOptions({...options,[name]:undefined}),error=>error.status===503);
});
