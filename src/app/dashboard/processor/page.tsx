import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { PackagingForm } from './packaging-form';
import { Package, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProcessorPage() {
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

  const processableBatches = await prisma.honeyBatch.findMany({
    where: {
      recalled: false,
      status: 'LAB_VERIFIED',
      ...(isAdmin ? {} : { current_custodian: walletAddress }),
    },
    select: {
      batchCode: true,
      honey_type: true,
      quantity_grams: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Package className="w-7 h-7 text-amber-400" />
          Packaging & QR Serialization
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Convert verified bulk batches into retail jars. This emits a packaging transaction on Polygon Amoy and mints unique HMAC-signed anti-clone QR codes.
        </p>
      </div>

      {!walletAddress && !isAdmin ? (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs">
          Please log in as a Processor or Admin to package honey batches.
        </div>
      ) : (
        <PackagingForm processableBatches={processableBatches} />
      )}
    </div>
  );
}
