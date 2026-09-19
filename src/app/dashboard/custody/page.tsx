import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { CustodyTransferForm } from './custody-form';

export const dynamic = 'force-dynamic';

export default async function CustodyPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('pollinator_session');
  
  let walletAddress: string | null = null;
  let isAdmin = false;

  if (sessionCookie) {
    try {
      const session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
      walletAddress = session.walletAddress ?? null;
      isAdmin = session.role === 'admin';
    } catch { /* ignore */ }
  }

  // Fetch batches in possession of the logged-in user
  // If admin, fetch all active batches for oversight
  const myBatches = await prisma.honeyBatch.findMany({
    where: {
      recalled: false,
      ...(isAdmin ? {} : { current_custodian: walletAddress }),
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
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">🔄 Custody Transfer</h1>
      <p className="text-gray-500 text-sm mb-8">
        Transfer custody of a honey batch to the next supply chain actor. Each multi-hop transfer is permanently logged on the Polygon blockchain.
      </p>

      {(!walletAddress && !isAdmin) ? (
        <div className="bg-red-50 p-4 rounded-xl text-red-700">
          Please log in to manage custody.
        </div>
      ) : (
        <CustodyTransferForm myBatches={myBatches} />
      )}
    </div>
  );
}
