export class RequestBodyError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function boundedBody(request: Request, limit: number): Promise<Buffer> {
  if (Number(request.headers.get('content-length')) > limit) throw new RequestBodyError('Request is too large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError('A request body is required');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length;
      if (length > limit) { await reader.cancel(); throw new RequestBodyError('Request is too large', 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
