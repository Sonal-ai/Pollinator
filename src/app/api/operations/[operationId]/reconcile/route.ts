import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { operationService, operationFailure, publicOperation, sameOrigin } from '@/lib/chain/operations';
import { readOperationJSON } from '@/lib/chain/http';
const Receipt = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });
export async function POST(request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    sameOrigin(request);
    const body = Receipt.safeParse(await readOperationJSON(request));
    if (!body.success) return Response.json({ error: 'A valid transaction hash is required' }, { status: 422 });
    const op = await operationService.reconcile((await params).operationId, session, body.data.txHash);
    return Response.json({ operation: publicOperation(op) }, { status: 202 });
  } catch (error) { return operationFailure(error); }
}
