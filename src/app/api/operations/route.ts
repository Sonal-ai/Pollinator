import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { publicOperation, operationFailure } from '@/lib/chain/operations';
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rows = await prisma.chainOperation.findMany({ where: session.role === 'admin' ? {} : { OR: [{ initiatedBy: session.accountId }, { actorAddress: session.walletAddress.toLowerCase() }] }, orderBy: { createdAt: 'desc' }, take: 100 });
    return Response.json({ operations: rows.map(publicOperation) });
  } catch (error) { return operationFailure(error); }
}
