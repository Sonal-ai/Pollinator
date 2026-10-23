import { getSession } from '@/lib/auth';
import { operationService, operationFailure, operationResponse, operationRequestKey, sameOrigin } from '@/lib/chain/operations';
export async function POST(request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    sameOrigin(request);
    const op = await operationService.retry((await params).operationId, session, operationRequestKey(request));
    return operationResponse(op);
  } catch (error) { return operationFailure(error); }
}
