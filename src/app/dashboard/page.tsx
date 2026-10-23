import type { Prisma } from '@prisma/client';
import { requireSession } from '@/lib/auth';
import { batchScope, beekeeperScope } from '@/lib/access-policy';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ShieldCheck, AlertTriangle, Layers, QrCode, ArrowRight, Filter, Search } from 'lucide-react';
import { NewHarvestModal } from './batch/new-harvest-modal';

export const dynamic = 'force-dynamic';

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    HARVESTED:       { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    PROCESSED:       { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
    LAB_VERIFIED:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    PACKAGED:        { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
    IN_DISTRIBUTION: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    AT_RETAIL:       { bg: 'bg-amber-500/15', text: 'text-[var(--accent-ink)]', border: 'border-amber-500/30' },
    SOLD:            { bg: 'bg-slate-500/15', text: 'text-[var(--text-muted)]', border: 'border-slate-500/30' },
    RECALLED:        { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
    PENDING_CHAIN:   { bg: 'bg-yellow-500/15', text: 'text-[var(--accent-ink)]', border: 'border-yellow-500/30' },
  };
  return map[status] ?? { bg: 'bg-slate-500/15', text: 'text-[var(--text-muted)]', border: 'border-slate-500/30' };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const page   = Math.max(1, parseInt(sp.page ?? '1', 10));
  const status = sp.status;
  const limit  = 20;

  const session = await requireSession();
  const where: Prisma.HoneyBatchWhereInput = { AND: [batchScope(session), status ? { status } : {}] };
  const currentBeekeeperId = session.beekeeperId ?? undefined;

  const [batches, total, verifiedCount, alertCount, beekeepersRaw] = await Promise.all([
    prisma.honeyBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        beekeeper: { select: { name: true, region: true } },
        _count: { select: { qrTokens: true, scanAlerts: { where: { resolved: false } } } },
      },
    }),
    prisma.honeyBatch.count({ where }),
    prisma.honeyBatch.count({ where: { AND: [batchScope(session), { lab_verified: true }] } }),
    prisma.scanAlert.count({ where: { resolved: false, batch: { is: batchScope(session) } } }),
    prisma.beekeeper.findMany({
      where: beekeeperScope(session),
      select: { id: true, name: true, region: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const beekeepers = beekeepersRaw.map((b) => ({
    id: b.id,
    name: b.name ?? 'Beekeeper',
    region: b.region ?? 'Wardha, Maharashtra',
  }));

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header & Metric Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Batch Registry
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {total} batch records • Check each operation for network and confirmation status
          </p>
        </div>

        {/* Actions & Filter Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {['admin', 'beekeeper'].includes(session.role) && <NewHarvestModal beekeepers={beekeepers} defaultBeekeeperId={currentBeekeeperId} />}

          <div className="h-4 w-px bg-[var(--surface-subtle)] hidden sm:block" />

          <Link
            href="/dashboard"
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !status
                ? 'bg-amber-500/20 border-amber-500/50 text-[var(--accent-ink)]'
                : 'bg-[var(--surface-subtle)] border-[var(--surface-border)] text-[var(--text-muted)] hover:text-foreground'
            }`}
          >
            All Batches ({total})
          </Link>
          <Link
            href="/dashboard?status=LAB_VERIFIED"
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              status === 'LAB_VERIFIED'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[var(--surface-subtle)] border-[var(--surface-border)] text-[var(--text-muted)] hover:text-foreground'
            }`}
          >
            Lab Verified ({verifiedCount})
          </Link>
          <Link
            href="/dashboard?status=RECALLED"
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              status === 'RECALLED'
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-[var(--surface-subtle)] border-[var(--surface-border)] text-[var(--text-muted)] hover:text-red-400'
            }`}
          >
            Recalled
          </Link>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] backdrop-blur-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-6 py-4">Batch Code</th>
                <th className="px-6 py-4">Honey Type & Origin</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Lifecycle State</th>
                <th className="px-6 py-4 text-center">Alerts</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-sans">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="text-3xl">🍯</span>
                      <p className="font-semibold text-foreground">No batches match this filter</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        New harvests will register automatically via the WhatsApp Bot.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const badge = statusBadge(b.status);
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-amber-500/[0.04] transition-colors group"
                    >
                      {/* Batch Code */}
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-foreground bg-[var(--surface-subtle)] px-2.5 py-1 rounded-lg border border-[var(--surface-border)] w-fit">
                          {b.batchCode}
                        </div>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                          ID: {b.id.slice(-8)}
                        </p>
                      </td>

                      {/* Honey Type & Origin */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-foreground">{b.honey_type}</p>
                        <p className="text-[var(--text-muted)] text-[11px] mt-0.5">
                          {b.beekeeper?.name ?? 'Producer'} · {b.region ?? b.beekeeper?.region ?? 'India'}
                        </p>
                      </td>

                      {/* Quantity & Jars */}
                      <td className="px-6 py-4">
                        <p className="font-mono font-semibold text-foreground">
                          {(b.quantity_grams / 1000).toFixed(1)} <span className="text-[var(--text-muted)] text-[10px]">KG</span>
                        </p>
                        {b._count.qrTokens > 0 && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            {b._count.qrTokens} Jars Packaged
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {b.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Anomaly Alerts */}
                      <td className="px-6 py-4 text-center">
                        {b._count.scanAlerts > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 font-bold text-xs border border-red-500/40">
                            {b._count.scanAlerts}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* View Action */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/batch/${b.batchCode}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] hover:bg-amber-500/20 border border-[var(--surface-border)] hover:border-amber-500/40 text-xs font-semibold text-foreground hover:text-[var(--accent-ink)] transition-all"
                        >
                          Dossier
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]">
            <span>
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Link
                href={`/dashboard?page=${page - 1}${status ? `&status=${status}` : ''}`}
                className={`px-3 py-1.5 rounded-lg border border-[var(--surface-border)] transition-colors ${
                  page <= 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-[var(--surface-subtle)] hover:text-foreground'
                }`}
              >
                Previous
              </Link>
              <Link
                href={`/dashboard?page=${page + 1}${status ? `&status=${status}` : ''}`}
                className={`px-3 py-1.5 rounded-lg border border-[var(--surface-border)] transition-colors ${
                  page >= pages ? 'opacity-30 pointer-events-none' : 'hover:bg-[var(--surface-subtle)] hover:text-foreground'
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
