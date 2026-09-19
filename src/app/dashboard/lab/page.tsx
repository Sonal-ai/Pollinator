import { prisma } from '@/lib/db';
import { LabUploadForm } from './upload-form';
import { FileCheck, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LabPage() {
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <FileCheck className="w-7 h-7 text-amber-400" />
          QA Laboratory Portal
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Upload certified PDF purity reports. The certificate hash is anchored to IPFS and signed permanently on Polygon Amoy.
        </p>
      </div>

      <LabUploadForm pendingBatches={pendingBatches} />
    </div>
  );
}
