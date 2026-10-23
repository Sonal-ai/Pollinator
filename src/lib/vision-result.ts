import { z } from 'zod';

const DetectionSchema = z.object({
  class: z.enum(['bee','varroa']), confidence: z.number().finite().min(0).max(1),
  bbox: z.object({ x1:z.number().finite().min(0),y1:z.number().finite().min(0),x2:z.number().finite().positive(),y2:z.number().finite().positive() })
    .refine(b => b.x2 > b.x1 && b.y2 > b.y1, 'Invalid bounding box'),
}).passthrough();
const OutputSchema = z.object({ success:z.literal(true), detections:z.array(DetectionSchema).max(1000) }).passthrough();
export interface DetectionItem { class:'bee'|'varroa'; class_id:number; confidence:number; bbox:{x1:number;y1:number;x2:number;y2:number} }
export interface VarroaDetectionResult {
  success:true; latency_ms:number; modelVersion:string; prediction:'uncertain'|'no_visible_mites'|'varroa_parasite_suspected'; confidence:number;
  summary:{bee_count:number;mite_count:number;total:number;low_confidence_count:number};
  alert:{level:'UNCERTAIN'|'REVIEW'|'NO_VISIBLE_MITES';infestation_rate_pct:null;message:string}; detections:DetectionItem[];
}
export function assessVisionOutput(value: unknown, modelVersion: string, latency: number): VarroaDetectionResult {
  const parsed=OutputSchema.safeParse(value);
  if (!parsed.success) throw new Error('The vision endpoint returned an invalid result');
  const accepted=parsed.data.detections.filter(d=>d.confidence>=0.6).map(d=>({...d,class_id:d.class==='bee'?0:1}));
  const bee_count=accepted.filter(d=>d.class==='bee').length, mite_count=accepted.filter(d=>d.class==='varroa').length;
  const low=parsed.data.detections.length-accepted.length;
  // This is an unvalidated image-level screen. No photo count ratio is a colony infestation measurement.
  const prediction=mite_count>0?'varroa_parasite_suspected':bee_count>=10&&low===0?'no_visible_mites':'uncertain';
  const message=prediction==='varroa_parasite_suspected'
    ?'Possible mites were detected in this image. Ask a trained beekeeper to inspect and use an established sampling method. This screen cannot diagnose a colony or prescribe treatment.'
    :prediction==='no_visible_mites'
    ?'No mites met the display threshold in this photograph. Hidden mites, sampling and model errors remain possible; this does not establish a healthy colony.'
    :'Insufficient usable evidence in this image. Try a clear close-up and arrange an inspection. An empty detection result is not a healthy result.';
  const candidates=accepted.filter(d=>prediction==='varroa_parasite_suspected'?d.class==='varroa':d.class==='bee');
  return {success:true,latency_ms:Math.max(0,Math.round(latency)),modelVersion,prediction,
    confidence:prediction==='uncertain'?0:Math.max(0,...candidates.map(d=>d.confidence)),
    summary:{bee_count,mite_count,total:accepted.length,low_confidence_count:low},
    alert:{level:prediction==='varroa_parasite_suspected'?'REVIEW':prediction==='no_visible_mites'?'NO_VISIBLE_MITES':'UNCERTAIN',infestation_rate_pct:null,message},detections:accepted};
}
export const MAX_IMAGE_BYTES=4*1024*1024;
export function validateVisionImage(bytes: Buffer) {
  if (bytes.length<12||bytes.length>MAX_IMAGE_BYTES) throw new Error('Provide a JPG, PNG or WebP image of at most 4 MB');
  const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!jpeg&&!png&&!webp) throw new Error('Unsupported image bytes. Use JPG, PNG or WebP.');
}
