import type { Prisma } from '@prisma/client';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CustodyTransferForm } from './custody-form';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CustodyPage() {
  const session = await requireSession();
  const walletAddress = session.walletAddress;
  const isAdmin = session.role === 'admin';
  const isBeekeeper = session.role === 'beekeeper';
  const where: Prisma.HoneyBatchWhereInput = {
    recalled: false,
    status: { notIn: ['PENDING_CHAIN', 'CREATED', 'SOLD', 'RECALLED'] },
    OR: [
      { current_custodian: { equals: walletAddress, mode: 'insensitive' } },
      ...(isBeekeeper && session.beekeeperId ? [{ current_custodian: null, beekeeperId: session.beekeeperId, status: { in: ['HARVESTED', 'PENDING_CHAIN'] } }] : []),
    ],
  };

  const myBatches = await prisma.honeyBatch.findMany({
    where,
    select: {
      id: true,
      batchCode: true,
      honey_type: true,
      quantity_grams: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const actors = await prisma.dashboardAccount.findMany({ where: { active: true, role: { not: 'admin' } }, select: { walletAddress: true, role: true } });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
          <Truck className="w-7 h-7 text-[var(--accent-ink)]" />
          Custody Transfer Protocol
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
          Hand over a registered batch while preserving its laboratory and packaging evidence. A transaction is confirmed only after a successful receipt.
        </p>
      </div>

      {!walletAddress && !isAdmin && !isBeekeeper ? (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs">
          Please log in to manage batch custody.
        </div>
      ) : (
        <CustodyTransferForm myBatches={myBatches} role={session.role} actors={actors} />
      )}
    </div>
  );
}
