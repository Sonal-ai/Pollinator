import { requireSession } from '@/lib/auth';
import { operationService } from '@/lib/chain/operations';
import { publicOperation } from '@/lib/chain/http';
import { OperationPayloadSchema } from '@/lib/chain/protocol';
import { notFound } from 'next/navigation';
import { OperationView } from './operation-view';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function OperationPage({ params }: { params: Promise<{ operationId: string }> }) {
  const session = await requireSession();
  const op = await operationService.load((await params).operationId, session).catch(() => null);
  if (!op) notFound();
  const account = process.env.NODE_ENV === 'development' && process.env.LOCAL_TEST_SIGNING === 'true'
    ? await prisma.dashboardAccount.findUnique({ where: { id: session.accountId }, select: { identifier: true } }) : null;
  return <OperationView initial={publicOperation(op)} payload={OperationPayloadSchema.parse(op.payload)} accountWallet={session.walletAddress} allowFixture={Boolean(account?.identifier.startsWith('local-demo-')) && op.chainId === 31337} />;
}
