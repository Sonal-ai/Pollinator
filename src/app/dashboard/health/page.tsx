import { prisma } from '@/lib/db';
import { ScanClient } from './scan-client';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Bug, 
  Sparkles, 
  Calendar, 
  Cpu, 
  Smartphone, 
  Activity,
  HeartPulse
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BeeHealthPage() {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();

  let beekeeperId: string | null = null;
  if (session?.walletAddress) {
    const bk = await prisma.beekeeper.findFirst({
      where: { wallet: session.walletAddress },
    });
    beekeeperId = bk?.id ?? null;
  }

  const isAdmin = session?.role === 'admin';
  const whereClause = isAdmin ? undefined : (beekeeperId ? { beekeeperId } : undefined);

  // Fetch recent AI scans
  const inferences = await prisma.aIInference.findMany({
    where: whereClause,
    orderBy: { inferredAt: 'desc' },
    take: 25,
    include: {
      beekeeper: { select: { name: true, region: true, phone: true } },
      hive: { select: { deviceId: true, region: true } },
    },
  });

  // Calculate high-level health stats
  const totalScans = inferences.length;
  let totalBees = 0;
  let totalMites = 0;
  let redAlerts = 0;
  let yellowAlerts = 0;
  let greenAlerts = 0;

  inferences.forEach((inf) => {
    if (inf.rawOutput) {
      try {
        const parsed = JSON.parse(inf.rawOutput);
        totalBees += parsed.summary?.bee_count || 0;
        totalMites += parsed.summary?.mite_count || 0;
        if (parsed.alert?.level === 'RED') redAlerts++;
        else if (parsed.alert?.level === 'YELLOW') yellowAlerts++;
        else greenAlerts++;
      } catch {
        if (inf.prediction === 'varroa_parasite_suspected') yellowAlerts++;
        else greenAlerts++;
      }
    }
  });

  const avgInfestation = totalBees > 0 ? (totalMites / totalBees) * 100 : 0.0;
  const overallStatus = redAlerts > 0 ? 'CRITICAL' : (yellowAlerts > 0 ? 'MODERATE' : 'HEALTHY');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <HeartPulse className="w-7 h-7 text-amber-400" />
            Bee Health & Varroa Diagnostic Station
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time YOLO11l computer vision running on AWS Lambda • WhatsApp & Web Ingestion • {totalScans} scans analyzed
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300">
            <Smartphone className="w-3.5 h-3.5" />
            <span>WhatsApp Sync: Active</span>
          </div>
        </div>
      </div>

      {/* Aggregate Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <div className="p-5 rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono text-slate-400 font-bold">Colony Status</span>
            {overallStatus === 'CRITICAL' ? (
              <AlertOctagon className="w-5 h-5 text-red-400" />
            ) : overallStatus === 'MODERATE' ? (
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-extrabold tracking-tight ${
                overallStatus === 'CRITICAL'
                  ? 'text-red-400'
                  : overallStatus === 'MODERATE'
                  ? 'text-yellow-400'
                  : 'text-emerald-400'
              }`}
            >
              {overallStatus}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {overallStatus === 'CRITICAL'
              ? 'Urgent oxalic acid vaporization required'
              : overallStatus === 'MODERATE'
              ? 'Thymol strips or drone trapping advised'
              : 'Zero or nominal mite density observed'}
          </p>
        </div>

        {/* Infestation Rate */}
        <div className="p-5 rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono text-slate-400 font-bold">Mite Ratio</span>
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-extrabold text-white">
              {avgInfestation.toFixed(2)}%
            </span>
            <span className="text-xs text-slate-500 font-mono">infestation</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Threshold: &lt;1% Normal • 1-3% Monitor • &gt;3% Treat
          </p>
        </div>

        {/* Total Bees Counted */}
        <div className="p-5 rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono text-slate-400 font-bold">Bees Scanned</span>
            <span className="text-xl">🐝</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-extrabold text-white">
              {totalBees.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-mono">individuals</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Detected across {totalScans} frame photos
          </p>
        </div>

        {/* Varroa Mites Detected */}
        <div className="p-5 rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono text-slate-400 font-bold">Mites Identified</span>
            <Bug className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-mono font-extrabold ${
                totalMites > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {totalMites}
            </span>
            <span className="text-xs text-slate-500 font-mono">Varroa destructor</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {redAlerts} critical • {yellowAlerts} warning alerts
          </p>
        </div>
      </div>

      {/* Live AI Vision Diagnostic Tester (Client Component) */}
      <ScanClient />

      {/* Treatment Advisory Section */}
      <div className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Scientifically Recommended Colony Treatments
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Infestation &lt; 1% (Healthy)</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">Routine Monthly Monitoring</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Maintain sticky bottom boards, ensure good queen laying pattern, and check drone comb periodically. No chemical treatment required.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span>Infestation 1% – 3% (Moderate)</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">Biotechnical / Thymol Control</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Implement drone brood comb trapping. Apply certified Thymol strips or essential oil vaporizers. Re-scan via WhatsApp after 7 days.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span>Infestation &gt; 3% (Critical)</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">Immediate Organic Acid Vapor</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Urgent intervention needed. Administer vaporized Oxalic Acid (OA) or Formic Acid flash pads. Inspect capped brood for secondary viruses (DWV).
            </p>
          </div>
        </div>
      </div>

      {/* Historical Scans Audit Trail */}
      <div className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Recent AI Vision Diagnostic Scans
            </h3>
            <p className="text-[11px] text-slate-400">
              Audit log of images ingested through WhatsApp and Web Dashboard
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
            {inferences.length} Records
          </span>
        </div>

        {inferences.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bug className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">No Hive Scans Logged Yet</p>
            <p className="text-xs text-slate-600">
              Send a photo of your bee frame to our WhatsApp bot or use the tester above to record your first diagnostic scan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-black/20 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Beekeeper / Hive</th>
                  <th className="px-6 py-3">Health Prediction</th>
                  <th className="px-6 py-3">Counted (Bees / Mites)</th>
                  <th className="px-6 py-3">Mite Ratio</th>
                  <th className="px-6 py-3">Confidence</th>
                  <th className="px-6 py-3">Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {inferences.map((inf) => {
                  let bees = 0;
                  let mites = 0;
                  let rate = 0;
                  let alertLevel = inf.prediction === 'healthy' ? 'GREEN' : 'YELLOW';

                  if (inf.rawOutput) {
                    try {
                      const p = JSON.parse(inf.rawOutput);
                      bees = p.summary?.bee_count ?? 0;
                      mites = p.summary?.mite_count ?? 0;
                      rate = p.alert?.infestation_rate_pct ?? 0;
                      alertLevel = p.alert?.level ?? alertLevel;
                    } catch {}
                  }

                  return (
                    <tr key={inf.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5 font-mono text-slate-300">
                        {new Date(inf.inferredAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-white">
                          {inf.beekeeper?.name || (inf.beekeeper?.phone ? `Farmer (${inf.beekeeper.phone})` : 'Web User')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {inf.hive?.deviceId ? `Hive ${inf.hive.deviceId}` : 'Direct Upload'}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider border ${
                            alertLevel === 'RED'
                              ? 'bg-red-500/15 border-red-500/30 text-red-300'
                              : alertLevel === 'YELLOW'
                              ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              alertLevel === 'RED'
                                ? 'bg-red-400 animate-ping'
                                : alertLevel === 'YELLOW'
                                ? 'bg-yellow-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                          {alertLevel === 'RED'
                            ? 'Critical Mites'
                            : alertLevel === 'YELLOW'
                            ? 'Moderate Mites'
                            : 'Healthy Frame'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono">
                        <span className="text-white font-bold">{bees}</span> bees •{' '}
                        <span className={mites > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                          {mites} mites
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-300">
                        {rate.toFixed(2)}%
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-400">
                        {(inf.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[10px] text-slate-500">
                        {inf.modelVersion}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
