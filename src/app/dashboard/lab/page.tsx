import { prisma } from '@/lib/db';
import { LabUploadForm } from './upload-form';

export const dynamic = 'force-dynamic';

export default async function LabPage() {
  // Fetch batches that are HARVESTED or PROCESSED and NOT YET lab verified
  const pendingBatches = await prisma.honeyBatch.findMany({
    where: {
      lab_verified: false,
      recalled: false,
      status: { in: ['HARVESTED', 'PROCESSED'] },
    },
    select: {
      id: true,
      batchCode: true,
      honey_type: true,
      quantity_grams: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">🧪 Lab Certificate Analysis</h1>
      <p className="text-gray-500 text-sm mb-8">
        Upload a PDF lab certificate for pending honey batches. The certificate hash will be committed immutably on the Polygon blockchain.
      </p>

      <LabUploadForm pendingBatches={pendingBatches} />
    </div>
  );
}
