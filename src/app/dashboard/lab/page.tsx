import { requireSession } from '@/lib/auth';
import { batchScope } from '@/lib/access-policy';
import { prisma } from '@/lib/db';
import { LabUploadForm } from './upload-form';
import { FileCheck, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LabPage() {
  const session = await requireSession(['admin', 'lab']);
  const pendingBatches = await prisma.honeyBatch.findMany({
    where: {
      AND: [batchScope(session)],
      lab_verified: false,
      recalled: false,
      status: 'PROCESSED',
      pendingOperationId: null,
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
          <FileCheck className="w-7 h-7 text-[var(--accent-ink)]" />
          QA Laboratory Portal
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
          Upload a laboratory PDF, review its exact hash, and approve its commitment with the enrolled lab wallet. The report remains pending until a successful receipt is applied.
        </p>
      </div>

      <LabUploadForm pendingBatches={pendingBatches} />
    </div>
  );
}
