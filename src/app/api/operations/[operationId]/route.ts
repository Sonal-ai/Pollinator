import { getSession } from '@/lib/auth';
import { operationService, operationFailure, publicOperation } from '@/lib/chain/operations';
import { OperationPayloadSchema } from '@/lib/chain/protocol';
export async function GET(_request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const op = await operationService.load((await params).operationId, session);
    return Response.json({ operation: publicOperation(op), payload: OperationPayloadSchema.parse(op.payload) });
  } catch (error) { return operationFailure(error); }
}
