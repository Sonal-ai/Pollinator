import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function OperationsPage() {
  const session = await requireSession();
  const operations = await prisma.chainOperation.findMany({ where: session.role === 'admin' ? {} : { OR: [{ initiatedBy: session.accountId }, { actorAddress: session.walletAddress.toLowerCase() }] },
    include: { batch: { select: { batchCode: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  return <div className="space-y-7"><div><p className="eyebrow">ACTOR APPROVALS</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Operations</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Review a prepared action, approve it with the enrolled wallet, and follow its chain receipt. A stored request is not a confirmed batch change.</p></div>
    <div className="divide-y divide-[var(--surface-border)] rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-solid)]">{operations.length ? operations.map(op => <Link key={op.id} href={'/dashboard/operations/' + op.id} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-[var(--surface-subtle)]"><div><h2 className="text-sm font-semibold">{op.kind.replaceAll('_', ' ')}</h2><p className="mt-2 font-mono text-xs text-[var(--text-muted)]">{op.batch.batchCode}</p></div><div className="text-right"><span className="text-xs">{op.state.replaceAll('_', ' ')}</span><p className="mt-2 text-xs text-[var(--text-muted)]">{op.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC</p></div></Link>) : <p className="p-6 text-sm text-[var(--text-muted)]">Prepared harvests, handovers, laboratory reports, packaging and recalls will appear here.</p>}</div>
  </div>;
}
