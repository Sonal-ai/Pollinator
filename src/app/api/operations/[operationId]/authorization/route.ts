import { getSession } from '@/lib/auth';
import { operationService, operationFailure, sameOrigin } from '@/lib/chain/operations';
import { FORWARD_TYPES } from '@/lib/chain/protocol';
export async function POST(request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    sameOrigin(request);
    const authorization = await operationService.authorization((await params).operationId, session);
    return Response.json({ ...authorization, types: FORWARD_TYPES });
  } catch (error) { return operationFailure(error); }
}
