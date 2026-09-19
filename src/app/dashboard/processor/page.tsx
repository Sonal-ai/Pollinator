import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { PackagingForm } from './packaging-form';

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

  // Processors can only package batches they possess and that are LAB_VERIFIED
  const processableBatches = await prisma.honeyBatch.findMany({
    where: {
      recalled: false,
      status: 'LAB_VERIFIED', // Must be lab verified to be safely packaged
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
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">🏭 Processor Packaging</h1>
      <p className="text-gray-500 text-sm mb-8">
        Convert bulk honey batches into individual retail jars. This will immutably log the packaging details on the Polygon blockchain and generate cryptographically signed anti-clone QR codes for each jar.
      </p>

      {(!walletAddress && !isAdmin) ? (
        <div className="bg-red-50 p-4 rounded-xl text-red-700">
          Please log in as a Processor or Admin to package batches.
        </div>
      ) : (
        <PackagingForm processableBatches={processableBatches} />
      )}
    </div>
  );
}
