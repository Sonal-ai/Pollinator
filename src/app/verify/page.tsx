import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { getBatchFromChain, getExplorerTxUrl, getExplorerAddressUrl, getActiveContractAddress, getActiveNetworkName } from '@/lib/blockchain';
import { verifyMetadataIntegrity, verifyFileIntegrity, type BatchMetadata } from '@/lib/ipfs';
import { processQRScan } from '@/lib/qr';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ArrowLeft, ArrowUpRight, ShieldAlert, CheckCircle2, Clock, Fingerprint, FlaskConical, Package, Layers } from 'lucide-react';
import type { EvidenceCheck } from '@/lib/evidence';

export const dynamic = 'force-dynamic';
const unavailable: EvidenceCheck & { metadata?: BatchMetadata } = { valid: false, status: 'UNAVAILABLE', reason: 'No retrievable commitment is available.' };
function Notice({ title, children, warning = false }: { title: string; children: React.ReactNode; warning?: boolean }) {
  return <div className="verification-notice" data-warning={warning}><ShieldAlert size={30} /><h1>{title}</h1><p>{children}</p><Link href="/#verify">Return to batch lookup <ArrowLeft size={15} /></Link></div>;
}
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ b?: string; n?: string; sig?: string }> }) {
  const { b: batchCode, n: nonce, sig: signature } = await searchParams;
  if (!batchCode || batchCode.length > 100 || !/^[a-zA-Z0-9-]+$/.test(batchCode)) return <Notice title="A valid batch code is required">Use the full link on the label or enter a batch code from the packaging.</Notice>;
  if (Boolean(nonce) !== Boolean(signature)) return <Notice title="Incomplete jar label" warning>The label link must contain both its serial nonce and signature.</Notice>;
  const result = await loadVerification(batchCode, nonce, signature);
  if ('notice' in result) return <Notice title={result.notice.title} warning={result.notice.warning}>{result.notice.message}</Notice>;
  const { batch, labelMatched, chain, recalled, metadata, report } = result;
  const evidenceMatched = Boolean(chain && chain.labVerified && metadata.valid && report.valid);
  const title = recalled ? 'This batch has been recalled.' : labelMatched && evidenceMatched
    ? 'The recorded evidence matches.' : labelMatched ? 'Label matched. Check the evidence.' : 'Batch information.';
  const chainUrl = getExplorerTxUrl(batch.txHash);
  const contractUrl = getExplorerAddressUrl(getActiveContractAddress());
  const checks = [
    { title: 'Jar label', icon: Fingerprint, state: labelMatched ? 'MATCH' : 'NOT CHECKED', description: labelMatched ? 'The signature matches an active token linked to this batch.' : 'A batch lookup does not authenticate a serialized jar.' },
    { title: 'Blockchain record', icon: Layers, state: chain ? 'MATCH' : 'UNAVAILABLE', description: chain ? 'A batch record was read from the configured contract.' : 'No confirmed chain record could be read. This is not a verified registration.' },
    { title: 'Metadata bytes', icon: Package, state: metadata.status, description: metadata.valid ? 'Retrieved metadata bytes match the registered SHA-256 hash.' : metadata.reason },
    { title: 'Laboratory report bytes', icon: FlaskConical, state: report.status, description: report.valid ? 'The report bytes match the on-chain laboratory commitment.' : 'A matching, retrievable laboratory report could not be established.' },
  ];
  return <VerificationRecord batch={batch} labelMatched={labelMatched} evidenceMatched={evidenceMatched} recalled={recalled} title={title} checks={checks} chainUrl={chainUrl} contractUrl={contractUrl} />;
}

async function loadVerification(batchCode: string, nonce?: string, signature?: string) {
  const notice = (title: string, message: string, warning = false) => ({ notice: { title, message, warning } });
  try {
    const batch = await prisma.honeyBatch.findUnique({ where: { batchCode }, include: {
      beekeeper: { select: { name: true, region: true } },
      certificates: { orderBy: { createdAt: 'desc' }, take: 1 },
      custodyEvents: { orderBy: { createdAt: 'asc' } },
    } });
    if (!batch) return notice('Batch not found', 'There is no recorded batch with this code. No demonstration record has been substituted.');
    let labelMatched = false;
    if (nonce && signature) {
      const incoming = await headers();
      const scan = await processQRScan({ batchCode, nonce, signature,
        ipAddress: incoming.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
        userAgent: incoming.get('user-agent'),
      });
      if (!scan.valid) return notice(scan.status === 'RECALLED' ? 'Batch recalled' : 'Label could not be verified', scan.reason ?? 'The label is not active or its signature does not match.', true);
      labelMatched = true;
    }
    const chain = await getBatchFromChain(batchCode);
    const recalled = batch.recalled || Boolean(chain?.recalled);
    const metadataCID = chain?.metadataCID || batch.metadataCID;
    const metadataHash = chain?.metadataHash || batch.metadataHash;
    const certificate = batch.certificates[0];
    const [metadata, report] = await Promise.all([
      metadataCID && metadataHash ? verifyMetadataIntegrity(metadataCID, metadataHash) : Promise.resolve(unavailable),
      certificate && chain?.labVerified && certificate.certificateHash.toLowerCase() === chain.labReportHash.toLowerCase()
        ? verifyFileIntegrity(certificate.ipfsCID, chain.labReportHash) : Promise.resolve(unavailable),
    ]);
    const content = metadata.metadata;
    const metadataDescribesBatch = Boolean(content && chain && content.batchCode === batchCode &&
      content.quantityGrams === chain.quantityGrams && content.quantityGrams === batch.quantity_grams &&
      content.honeyType === batch.honey_type && content.region === batch.region &&
      (!chain.jarCount || (content.packagingDetails?.jarCount === chain.jarCount && content.packagingDetails?.jarSizeGrams === chain.jarSizeGrams)));
    const checkedMetadata: EvidenceCheck = metadata.valid && !metadataDescribesBatch
      ? { valid: false, status: 'MISMATCH', reason: 'The metadata content, database declaration and chain inventory do not agree.' } : metadata;
    return { batch, labelMatched, chain, recalled, metadata: checkedMetadata, report };
  } catch {
    return notice('The record is temporarily unavailable', 'The registry database or a required check could not be reached. No successful verification is being claimed. Please try again later.');
  }
}

type LoadedRecord = Exclude<Awaited<ReturnType<typeof loadVerification>>, { notice: unknown }>;
function VerificationRecord({ batch, labelMatched, evidenceMatched, recalled, title, checks, chainUrl, contractUrl }: {
  batch: LoadedRecord['batch']; labelMatched: boolean; evidenceMatched: boolean; recalled: boolean; title: string;
  checks: { title: string; icon: typeof Fingerprint; state: string; description: string | undefined }[];
  chainUrl: string | null; contractUrl: string | null;
}) {
    return <div className="verification-page">
      <header className="verification-header"><Link href="/" className="product-brand"><Image src="/logo-mark.png" alt="" width={30} height={30} /><span>pollinator<span className="brand-dot">.</span></span></Link><ThemeToggle /></header>
      <main className="verification-main"><p className="eyebrow">HONEY CHAIN / PUBLIC RECORD</p>
        <div className={'verification-banner' + (recalled ? ' is-recalled' : '')}>
          {recalled ? <ShieldAlert size={32} /> : labelMatched && evidenceMatched ? <CheckCircle2 size={32} /> : <Clock size={32} />}
          <h1>{title}</h1><p>{recalled ? 'Follow the supplier’s recall instructions. A recall warning overrides other evidence checks.' : 'These checks describe recorded evidence, not a guarantee of the jar’s physical contents or chemical purity.'}</p>
          <code>{batch.batchCode}</code>
        </div>
        <div className="verification-facts">{[
          ['Declared honey type', batch.honey_type], ['Declared harvest mass', (batch.quantity_grams / 1000).toLocaleString() + ' kg'],
          ['Recorded origin', batch.region ?? 'Not provided'], ['Recorded producer', batch.beekeeper?.name ?? 'Not provided'],
        ].map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>
        <section className="verification-checks" aria-label="Evidence checks">{checks.map(check => { const Icon = check.icon; return <article key={check.title}><Icon size={22} /><div><h2>{check.title}</h2><p>{check.description}</p></div><span className="evidence-state" data-state={check.state}>{check.state.replaceAll('_', ' ')}</span></article>; })}</section>
        <section className="verification-details"><h2>Custody history</h2>{batch.custodyEvents.length ? <ol>{batch.custodyEvents.map(event => <li key={event.id}><span>{event.stage.replaceAll('_', ' ')}</span><time>{event.createdAt.toISOString().slice(0, 10)}</time><small>{event.txHash ? 'Transaction recorded; inspect the receipt for confirmation.' : 'No confirmed chain transaction is attached.'}</small></li>)}</ol> : <p>No custody handovers have been recorded.</p>}</section>
        <section className="verification-details"><h2>Inspect the source</h2><p>Configured network: {getActiveNetworkName()}. Checked at {new Date().toISOString()}.</p><div className="verification-source-links">{chainUrl && <a href={chainUrl} target="_blank" rel="noreferrer">Registration transaction <ArrowUpRight size={15} /></a>}{contractUrl && <a href={contractUrl} target="_blank" rel="noreferrer">Configured contract <ArrowUpRight size={15} /></a>}</div><p>A static printed QR can be copied. Report suspicious labels to your supplier; repeated scans alone do not prove counterfeiting.</p></section>
        <Link href="/#verify" className="button-text"><ArrowLeft size={15} /> Look up another batch</Link>
      </main>
    </div>;
}
