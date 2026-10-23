require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {test}=require('node:test'),assert=require('node:assert/strict');
const {assessVisionOutput,validateVisionImage}=require('../src/lib/vision-result.ts');
const {estimateProductivity}=require('../src/lib/productivity.ts');
const detection=(type='bee',score=.9)=>({class:type,confidence:score,bbox:{x1:0,y1:0,x2:10,y2:10}});
test('empty detections and an upstream green health claim become uncertain, not healthy',()=>{
  const result=assessVisionOutput({success:true,detections:[],alert:{level:'GREEN'},summary:{bee_count:999}},'unit-model',20);
  assert.equal(result.prediction,'uncertain');assert.equal(result.confidence,0);assert.equal(result.summary.bee_count,0);assert.equal(result.alert.infestation_rate_pct,null);
});
test('counts are derived from valid candidates; low-score detections cannot certify a negative screen',()=>{
  const result=assessVisionOutput({success:true,detections:[...Array.from({length:12},()=>detection()),detection('varroa',.3)]},'unit',1);
  assert.equal(result.prediction,'uncertain');assert.equal(result.summary.low_confidence_count,1);
});
test('possible mites trigger inspection, while a negative photograph never certifies colony health',()=>{
  const positive=assessVisionOutput({success:true,detections:[detection('varroa')]},'unit',1);
  assert.equal(positive.prediction,'varroa_parasite_suspected');assert.equal(positive.alert.level,'REVIEW');assert.equal(positive.alert.infestation_rate_pct,null);
  const negative=assessVisionOutput({success:true,detections:Array.from({length:12},()=>detection())},'unit',1);
  assert.equal(negative.prediction,'no_visible_mites');assert.match(negative.alert.message,/does not establish a healthy colony/);
});
test('invalid, failed and unbounded model output is refused',()=>{
  for(const value of [{success:false,detections:[]},{success:true,detections:[detection('queen')]},{success:true,detections:[detection('bee',NaN)]},{success:true,detections:[{...detection(),bbox:{x1:10,y1:0,x2:1,y2:10}}]},{success:true,detections:Array.from({length:1001},()=>detection())}])assert.throws(()=>assessVisionOutput(value,'unit',1));
});
test('image inputs are bounded and checked by bytes rather than the supplied filename',()=>{
  assert.throws(()=>validateVisionImage(Buffer.from('%PDF-1.4 Not a JPG')));
  assert.throws(()=>validateVisionImage(Buffer.alloc(4*1024*1024+1)));
  validateVisionImage(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(8)]));
});
const now=new Date('2026-10-20T12:00:00Z');
const rows=Array.from({length:10},(_,i)=>({timestamp:new Date(+now-(9-i)*86400000),weightKg:40+i*.2,source:'DEVICE'}));
test('productivity needs attributed daily coverage and a recent measured weight',()=>{
  assert.equal(estimateProductivity(rows.slice(0,3),'DEVICE',now).status,'INSUFFICIENT_DATA');
  assert.equal(estimateProductivity(rows,'SIMULATED',now).status,'INSUFFICIENT_DATA');
  assert.equal(estimateProductivity(rows,'LEGACY',now).status,'INSUFFICIENT_DATA');
  assert.equal(estimateProductivity(rows,'DEVICE',new Date(+now+2*86400000)).status,'INSUFFICIENT_DATA');
});
test('the robust scale trend reports a sensitivity scenario, not a honey-yield prediction',()=>{
  const result=estimateProductivity(rows,'DEVICE',now);assert.equal(result.status,'TREND_SCENARIO');assert.equal(result.slopeKgPerDay,.2);assert.equal(result.sevenDayChangeKg,1.4);assert.ok(result.scenarioRangeKg[0]<1.4&&result.scenarioRangeKg[1]>1.4);assert.match(result.message,/not a validated confidence interval or honey-yield forecast/);
});
test('scale handling steps suppress the trend and invalid measurements do not become zero samples',()=>{
  const changed=rows.map((row,i)=>({...row,weightKg:row.weightKg+(i>=5?5:0)}));assert.equal(estimateProductivity(changed,'DEVICE',now).status,'HANDLING_CHANGE');
  assert.equal(estimateProductivity(rows.map(row=>({...row,weightKg:null})),'DEVICE',now).dailySamples,0);
  assert.equal(estimateProductivity([...rows,{timestamp:'invalid',weightKg:40,source:'DEVICE'}],'DEVICE',now).dailySamples,10);
});
test('synthetic trends remain explicitly labelled',()=>{
  const result=estimateProductivity(rows.map(row=>({...row,source:'SIMULATED'})),'SIMULATED',now);assert.equal(result.status,'TREND_SCENARIO');assert.match(result.message,/Synthetic demonstration/);
});
