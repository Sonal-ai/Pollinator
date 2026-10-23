type WeightReading={timestamp:Date|string;weightKg:number|null;source:string};
function median(values:number[]){const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
export interface ProductivityEstimate {
  modelVersion:string;status:'INSUFFICIENT_DATA'|'HANDLING_CHANGE'|'TREND_SCENARIO';source:string;dailySamples:number;
  slopeKgPerDay:number|null;sevenDayChangeKg:number|null;scenarioRangeKg:[number,number]|null;message:string;
}
/** Robust gross-scale trend only. No honey-yield or calibrated confidence claim is made. */
export function estimateProductivity(readings:WeightReading[],source:string,now=new Date()):ProductivityEstimate{
  const base:ProductivityEstimate={modelVersion:'scale-trend-theil-sen-v1',status:'INSUFFICIENT_DATA',source,dailySamples:0,slopeKgPerDay:null,sevenDayChangeKg:null,scenarioRangeKg:null,message:'At least seven daily scale medians across six days, with a recent reading, are required. Gross hive mass is not harvestable honey.'};
  if(!['DEVICE','SIMULATED'].includes(source))return{...base,message:'Legacy readings have no verified source. A trend is unavailable.'};
  const days=new Map<string,number[]>();let latest=0;
  for(const row of readings.slice(-5000)){
    const time=new Date(row.timestamp).getTime();
    if(row.source!==source||row.weightKg==null||!Number.isFinite(row.weightKg)||!Number.isFinite(time)||row.weightKg<0||row.weightKg>500||time>+now||time<+now-30*86400000)continue;
    const day=new Date(time).toISOString().slice(0,10);days.set(day,[...(days.get(day)||[]),row.weightKg]);latest=Math.max(latest,time);
  }
  const samples=[...days].sort(([a],[b])=>a.localeCompare(b)).map(([day,values])=>({day:Date.parse(day)/86400000,weight:median(values)}));
  base.dailySamples=samples.length;
  if(samples.length<7||samples.at(-1)!.day-samples[0].day<6||+now-latest>86400000)return base;
  for(let i=1;i<samples.length;i++){
    if(samples[i].day-samples[i-1].day>2)return{...base,message:'Daily sampling has gaps greater than two days; no trend scenario is shown.'};
    if(Math.abs(samples[i].weight-samples[i-1].weight)>2)return{...base,status:'HANDLING_CHANGE',message:'A daily scale step exceeds the prototype handling threshold (2 kg). Check harvesting, feeding, rain, box changes and calibration before estimating a trend.'};
  }
  const slopes:number[]=[];for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++)slopes.push((samples[j].weight-samples[i].weight)/(samples[j].day-samples[i].day));
  const slope=median(slopes),span=samples.at(-1)!.day-samples[0].day;
  const intercept=median(samples.map(s=>s.weight-slope*(s.day-samples[0].day)));
  const residual=median(samples.map(s=>Math.abs(s.weight-(intercept+slope*(s.day-samples[0].day)))));
  const uncertainty=Math.max(0.1,2*residual+Math.abs(slope)*7/Math.sqrt(span));
  const round=(value:number)=>Number(value.toFixed(2));
  return{...base,status:'TREND_SCENARIO',slopeKgPerDay:round(slope),sevenDayChangeKg:round(slope*7),scenarioRangeKg:[round(slope*7-uncertainty),round(slope*7+uncertainty)],
    message:(source==='SIMULATED'?'Synthetic demonstration. ':'')+'Seven-day gross-scale change if the recent trend continues. The displayed range is an engineering sensitivity band, not a validated confidence interval or honey-yield forecast. Check the hive before any harvest decision.'};
}
