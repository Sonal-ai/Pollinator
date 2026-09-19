import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { env } from './env';

export interface DetectionItem {
  class: 'bee' | 'varroa';
  class_id: number;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

export interface VarroaDetectionResult {
  success: boolean;
  latency_ms: number;
  summary: {
    bee_count: number;
    mite_count: number;
    total: number;
  };
  alert: {
    level: 'GREEN' | 'YELLOW' | 'RED';
    infestation_rate_pct: number;
    message: string;
  };
  detections: DetectionItem[];
}

const lambdaClient = new LambdaClient({
  region: env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const FUNCTION_NAME = 'pollinator-varroa-detector';

/**
 * Invoke the deployed AWS Lambda Varroa Detector using an image Buffer.
 */
export async function detectVarroaFromBuffer(imageBuffer: Buffer): Promise<VarroaDetectionResult> {
  const base64Image = imageBuffer.toString('base64');
  const payload = {
    body: JSON.stringify({ image: base64Image }),
  };

  const command = new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    Payload: Buffer.from(JSON.stringify(payload)),
  });

  const response = await lambdaClient.send(command);

  if (!response.Payload) {
    throw new Error('No response payload received from Lambda Varroa Detector');
  }

  const rawJson = JSON.parse(Buffer.from(response.Payload).toString('utf-8'));

  if (rawJson.errorMessage || rawJson.errorType) {
    throw new Error(`Lambda runtime error: ${rawJson.errorMessage || rawJson.errorType}`);
  }

  if (rawJson.statusCode && rawJson.statusCode !== 200) {
    const errorBody = typeof rawJson.body === 'string' ? JSON.parse(rawJson.body) : rawJson.body;
    throw new Error(`Lambda detection error (${rawJson.statusCode}): ${errorBody?.error || 'Unknown error'}`);
  }

  const result: VarroaDetectionResult = typeof rawJson.body === 'string' ? JSON.parse(rawJson.body) : rawJson;
  return result;
}
