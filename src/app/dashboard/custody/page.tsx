import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { CustodyTransferForm } from './custody-form';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CustodyPage() {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  
  const walletAddress = session?.walletAddress ?? null;
  const isAdmin = session?.role === 'admin';

  const myBatches = await prisma.honeyBatch.findMany({
    where: {
      recalled: false,
      ...(isAdmin ? {} : {
        OR: [
          { current_custodian: walletAddress },
          { current_custodian: walletAddress?.toLowerCase() },
          { beekeeper: { wallet: walletAddress } },
          { beekeeper: { wallet: walletAddress?.toLowerCase() } },
        ],
      }),
    },
    select: {
      id: true,
      batchCode: true,
      honey_type: true,
      quantity_grams: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Truck className="w-7 h-7 text-amber-400" />
          Custody Transfer Protocol
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Transfer custody of honey batches to the next supply chain actor. Each handover triggers a cryptographic state transition signed on Polygon Amoy.
        </p>
      </div>

      {!walletAddress && !isAdmin ? (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs">
          Please log in to manage batch custody.
        </div>
      ) : (
        <CustodyTransferForm myBatches={myBatches} />
      )}
    </div>
  );
}
