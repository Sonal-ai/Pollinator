import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';
import { detectVarroaFromBuffer } from '@/lib/varroa-detector';
import { getSession } from '@/lib/auth';
import { hiveScope } from '@/lib/access-policy';
import { allowedRequestOrigin } from '@/lib/request-origin';
import { boundedBody, RequestBodyError } from '@/lib/request-body';
import { MAX_IMAGE_BYTES, validateVisionImage } from '@/lib/vision-result';
export const runtime='nodejs';
export async function POST(request: Request) {
  try {
    const session=await getSession();
    if(!session) return Response.json({error:'Unauthorized'},{status:401});
    if(!['admin','beekeeper'].includes(session.role)||!allowedRequestOrigin(request)) return Response.json({error:'Forbidden'},{status:403});
    const type=request.headers.get('content-type')||'';
    let buffer:Buffer, hiveId:string|null=null;
    if(type.startsWith('multipart/form-data')) {
      const body=await boundedBody(request,MAX_IMAGE_BYTES+65536);
      let form:FormData;
      try { form=await new Request(request.url,{method:'POST',headers:{'Content-Type':type},body:new Uint8Array(body)}).formData(); } catch { throw new RequestBodyError('Invalid multipart image upload'); }
      const file=form.get('image');
      if(!file||typeof file==='string') throw new RequestBodyError('An image file is required');
      buffer=Buffer.from(await file.arrayBuffer());
      const id=form.get('hiveId'); if(typeof id==='string'&&id) hiveId=id;
    } else if(type.startsWith('application/json')) {
      let input;
      try { input=JSON.parse((await boundedBody(request,Math.ceil(MAX_IMAGE_BYTES/3)*4+1024)).toString('utf8')); } catch(error) { if(error instanceof RequestBodyError) throw error; throw new RequestBodyError('Invalid JSON'); }
      if(typeof input?.image!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.image)) throw new RequestBodyError('An image in canonical base64 is required');
      buffer=Buffer.from(input.image,'base64'); if(buffer.toString('base64')!==input.image) throw new RequestBodyError('Invalid base64');
      if(typeof input.hiveId==='string'&&input.hiveId) hiveId=input.hiveId;
    } else return Response.json({error:'Use multipart/form-data or application/json'},{status:415});
    try { validateVisionImage(buffer); } catch(error) { throw new RequestBodyError(error instanceof Error?error.message:'Invalid image',buffer.length>MAX_IMAGE_BYTES?413:422); }
    let beekeeperId=session.beekeeperId;
    if(hiveId) {
      if(hiveId.length>128) throw new RequestBodyError('Invalid hive ID');
      const hive=await prisma.hive.findFirst({where:{AND:[hiveScope(session),{id:hiveId}]}});
      if(!hive) return Response.json({error:'Hive not found'},{status:404});
      beekeeperId=hive.beekeeperId;
    }
    const result=await detectVarroaFromBuffer(buffer);
    const record=await prisma.aIInference.create({data:{beekeeperId,hiveId,modelVersion:result.modelVersion,inputImageHash:createHash('sha256').update(buffer).digest('hex'),prediction:result.prediction,confidence:result.confidence,rawOutput:JSON.stringify(result)}});
    return Response.json({inferenceId:record.id,...result});
  } catch(error) {
    return Response.json({error:error instanceof RequestBodyError?error.message:'Image analysis is unavailable. No health conclusion was recorded.'},{status:error instanceof RequestBodyError?error.status:503});
  }
}
