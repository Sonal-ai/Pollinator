import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getActiveRpcUrl, isLocalChain } from '@/lib/blockchain';
import { operationService, operationFailure, publicOperation, sameOrigin } from '@/lib/chain/operations';
import { FORWARD_TYPES } from '@/lib/chain/protocol';

// Explicit local fixture driver. This endpoint cannot sign for production or real enrolled accounts.
export async function POST(request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  if (process.env.NODE_ENV !== 'development' || process.env.LOCAL_TEST_SIGNING !== 'true') return Response.json({ error: 'Not found' }, { status: 404 });
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    sameOrigin(request);
    const rpc = new URL(getActiveRpcUrl());
    if (!isLocalChain() || rpc.hostname !== '127.0.0.1' || rpc.port !== '8545') return Response.json({ error: 'Fixture signing requires the dedicated local chain' }, { status: 403 });
    const account = await prisma.dashboardAccount.findUnique({ where: { id: session.accountId }, select: { identifier: true } });
    if (!account?.identifier.startsWith('local-demo-')) return Response.json({ error: 'This account is not a local fixture' }, { status: 403 });
    const id = (await params).operationId;
    const auth = await operationService.authorization(id, session);
    if (auth.domain.chainId !== 31337) return Response.json({ error: 'Fixture signing is disabled on public networks' }, { status: 403 });
    const signer = await operationService.chain.provider.getSigner(session.walletAddress);
    const signature = await signer.signTypedData(auth.domain, FORWARD_TYPES, auth.message);
    const op = await operationService.approve(id, session, signature);
    return Response.json({ operation: publicOperation(op), fixture: true }, { status: 202 });
  } catch (error) { return operationFailure(error); }
}
