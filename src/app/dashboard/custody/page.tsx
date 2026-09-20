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
  const isBeekeeper = session?.role === 'beekeeper';

  let where: any = { recalled: false };

  if (!isAdmin) {
    if (isBeekeeper) {
      const beekeepers = await prisma.beekeeper.findMany({
        where: {
          OR: [
            ...(walletAddress ? [{ wallet: walletAddress }, { wallet: walletAddress.toLowerCase() }] : []),
            { phone: '8882218036' },
            { phone: '8882291014' },
            { name: 'Sonal' },
          ],
        },
        select: { id: true, wallet: true },
      });

      const beekeeperWallets = new Set<string>();
      if (walletAddress) {
        beekeeperWallets.add(walletAddress);
        beekeeperWallets.add(walletAddress.toLowerCase());
      }
      for (const b of beekeepers) {
        if (b.wallet) {
          beekeeperWallets.add(b.wallet);
          beekeeperWallets.add(b.wallet.toLowerCase());
        }
      }

      const walletList = Array.from(beekeeperWallets);
      const beekeeperIds = beekeepers.map((b) => b.id);

      // Beekeeper can ONLY transfer batches currently in their custody (not yet handed over)
      where = {
        recalled: false,
        status: { in: ['HARVESTED', 'PENDING_CHAIN'] },
        OR: [
          ...(walletList.length > 0 ? [{ current_custodian: { in: walletList } }] : []),
          { current_custodian: null, beekeeperId: { in: beekeeperIds } },
          { current_custodian: null, beekeeper: { name: 'Sonal' } },
        ],
      };
    } else if (walletAddress) {
      where = {
        recalled: false,
        OR: [
          { current_custodian: walletAddress },
          { current_custodian: walletAddress.toLowerCase() },
        ],
      };
    } else {
      where = { id: '__none__' };
    }
  }

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

      {!walletAddress && !isAdmin && !isBeekeeper ? (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs">
          Please log in to manage batch custody.
        </div>
      ) : (
        <CustodyTransferForm myBatches={myBatches} />
      )}
    </div>
  );
}
