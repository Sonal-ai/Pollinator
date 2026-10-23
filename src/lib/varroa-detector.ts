import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { assessVisionOutput, validateVisionImage } from './vision-result';
export type { DetectionItem, VarroaDetectionResult } from './vision-result';

/** Bounded image-level inference. No diagnosis or calibrated probability is inferred from an empty result. */
export async function detectVarroaFromBuffer(imageBuffer: Buffer) {
  validateVisionImage(imageBuffer);
  const functionName=process.env.VARROA_LAMBDA_FUNCTION, modelVersion=process.env.VARROA_MODEL_VERSION;
  if (!functionName || !modelVersion || !/^[A-Za-z0-9_.:/-]{1,200}$/.test(modelVersion)) throw new Error('The vision model endpoint and version must be configured');
  const client=new LambdaClient({region:process.env.AWS_REGION||'us-east-1',maxAttempts:1});
  const started=Date.now();
  try {
    const response=await client.send(new InvokeCommand({FunctionName:functionName,Payload:Buffer.from(JSON.stringify({body:JSON.stringify({image:imageBuffer.toString('base64')})}))}), {abortSignal:AbortSignal.timeout(25000)});
    if(response.FunctionError || !response.Payload || response.Payload.length>2*1024*1024) throw new Error('The vision endpoint is unavailable');
    const envelope=JSON.parse(Buffer.from(response.Payload).toString('utf8'));
    if(envelope.errorMessage || (envelope.statusCode && envelope.statusCode!==200)) throw new Error('The vision endpoint did not return a successful result');
    const result=typeof envelope.body==='string'?JSON.parse(envelope.body):envelope.body||envelope;
    return assessVisionOutput(result,modelVersion,Date.now()-started);
  } finally { client.destroy(); }
}
