import type { ChainOperation } from '@prisma/client';
import { OperationError, OperationPayloadSchema } from './protocol';
import { allowedRequestOrigin } from '../request-origin';
export function publicOperation(op: ChainOperation) {
  return { id: op.id, batchId: op.batchId, kind: op.kind, actorAddress: op.actorAddress, state: op.state,
    chainId: op.chainId, registryAddress: op.registryAddress, forwarderAddress: op.forwarderAddress,
    txHash: op.txHash, receiptBlock: op.receiptBlock, createdAt: op.createdAt.toISOString(), updatedAt: op.updatedAt.toISOString(),
    lastError: op.lastError, authorizationDeadline: op.authorizationDeadline?.toISOString() ?? null };
}
export function operationRequestKey(request: Request): string {
  const key = request.headers.get('idempotency-key');
  if (!key || !/^[A-Za-z0-9:_-]{8,120}$/.test(key)) throw new OperationError('Provide an Idempotency-Key header (8–120 letters, numbers, hyphens or underscores)', 422);
  return key;
}
export function operationResponse(op: ChainOperation) {
  return Response.json({ operation: publicOperation(op), batchId: op.batchId, batchCode: OperationPayloadSchema.parse(op.payload).batchCode,
    status: op.state === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING_CHAIN', operationId: op.id }, { status: op.state === 'CONFIRMED' ? 200 : 202 });
}
export function operationFailure(error: unknown) {
  return Response.json({ error: error instanceof OperationError ? error.message : 'Transaction preparation is temporarily unavailable. Retry with the same idempotency key.' }, { status: error instanceof OperationError ? error.status : 503 });
}
export function sameOrigin(request: Request) {
  if (!allowedRequestOrigin(request)) throw new OperationError('Forbidden origin', 403);
}
async function readBoundedBytes(request: Request, limit: number): Promise<Buffer> {
  if (Number(request.headers.get('content-length')) > limit) throw new OperationError('Request is too large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OperationError('A request body is required', 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > limit) { await reader.cancel(); throw new OperationError('Request is too large', 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function readOperationJSON(request: Request, limit = 8192): Promise<unknown> {
  const bytes = await readBoundedBytes(request, limit);
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new OperationError('Invalid JSON body', 400); }
}
export async function readCertificateForm(request: Request): Promise<FormData> {
  const bytes = await readBoundedBytes(request, 10 * 1024 * 1024 + 65536);
  try { return await new Request(request.url, { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') || '' }, body: new Uint8Array(bytes) }).formData(); }
  catch { throw new OperationError('Expected valid multipart/form-data', 400); }
}
