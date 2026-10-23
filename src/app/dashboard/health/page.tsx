import { requireSession } from '@/lib/auth';
import { hiveScope } from '@/lib/access-policy';
import { prisma } from '@/lib/db';
import { ScanClient } from './scan-client';
export const dynamic='force-dynamic';
export default async function BeeHealthPage(){
  const session=await requireSession(['admin','beekeeper']);
  const [inferences,hives]=await Promise.all([
    prisma.aIInference.findMany({where:session.role==='admin'?{}:{beekeeperId:{in:session.beekeeperId?[session.beekeeperId]:[]}},orderBy:{inferredAt:'desc'},take:25,include:{hive:{select:{deviceId:true}}}}),
    prisma.hive.findMany({where:hiveScope(session),select:{id:true,deviceId:true},take:100,orderBy:{deviceId:'asc'}})
  ]);
  const suspected=inferences.filter(record=>record.prediction==='varroa_parasite_suspected').length;
  const uncertain=inferences.filter(record=>record.prediction==='uncertain').length;
  const legacy=inferences.filter(record=>!['varroa_parasite_suspected','uncertain','no_visible_mites'].includes(record.prediction)).length;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Hive image review</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Inspection support, with explicit uncertainty. No model accuracy, live endpoint status or healthy-colony certification is claimed.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Recent image records',inferences.length],['Possible mite screens',suspected],['Uncertain screens',uncertain],['Legacy results to review',legacy]].map(([label,value])=><div key={label} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-4"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
    <ScanClient hives={hives}/>
    <section className="space-y-3"><h2 className="text-lg font-bold">Recent results (up to 25)</h2>{inferences.length===0?<p className="text-sm text-[var(--text-muted)]">No image results. This is not evidence of a healthy colony.</p>:inferences.map(record=><article key={record.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-4 space-y-1"><p className="font-semibold">{record.prediction==='varroa_parasite_suspected'?'Possible mites · inspection needed':record.prediction==='no_visible_mites'?'No visible mites in this image':record.prediction==='uncertain'?'Uncertain image':'Legacy interpretation · needs review'}</p><p className="text-sm text-[var(--text-muted)]">{record.hive?.deviceId||'Hive not assigned'} · {record.inferredAt.toLocaleString('en-IN')} · {record.modelVersion}</p><p className="text-xs text-[var(--text-muted)]">An image result does not diagnose a colony. Legacy confidence or healthy labels are not accepted as current health evidence.</p></article>)}</section>
  </div>;
}
