import { prisma } from '@/lib/db';
import Link from 'next/link';
import { verifyMetadataIntegrity } from '@/lib/ipfs';
import { getBatchFromChain } from '@/lib/blockchain';
import { processQRScan } from '@/lib/qr';
import { headers } from 'next/headers';
import { VerifyClient } from './verify-client';
import { ShieldAlert, AlertTriangle, QrCode, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

type VerifyStatus = 'OK' | 'RECALLED' | 'NOT_FOUND' | 'INVALID_SIGNATURE' | 'DEACTIVATED' | 'INTEGRITY_FAIL' | 'ERROR';

interface VerifyPageProps {
  searchParams: Promise<{ b?: string; n?: string; sig?: string }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const sp = await searchParams;
  const batchCode = sp.b;
  const nonce     = sp.n;
  const signature = sp.sig;

  // Missing batch code — invalid URL
  if (!batchCode) {
    return (
      <VerifyResult
        status="INVALID_SIGNATURE"
        message="Invalid verification link — missing batch identifier."
      />
    );
  }

  // Get IP and User-Agent from request headers
  const headerStore = await headers();
  const forwardedFor = headerStore.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : null;
  const userAgent = headerStore.get('user-agent');

  // If nonce & signature are present and not demo, validate via processQRScan
  const isDemo = signature === 'demo-hmac-signature';
  if (nonce && signature && !isDemo) {
    const scanResult = await processQRScan({
      batchCode,
      nonce,
      signature,
      ipAddress,
      userAgent,
    });

    if (!scanResult.valid) {
      return (
        <VerifyResult
          status={scanResult.status as VerifyStatus}
          message={scanResult.reason}
          batchCode={batchCode}
        />
      );
    }
  }

  // Fetch batch data from PostgreSQL
  const batch = await prisma.honeyBatch.findUnique({
    where: { batchCode },
    include: {
      beekeeper: { select: { name: true, region: true, kvicId: true } },
      certificates: { orderBy: { createdAt: 'desc' }, take: 1 },
      custodyEvents: { orderBy: { createdAt: 'asc' } },
    },
  });

  // If batch does not exist in DB, fallback gracefully with demo batch if matching demo ID
  if (!batch) {
    if (batchCode === 'HC-2026-MH01-000123') {
      // Demo preview for presentation
      const demoBatch = {
        batchCode: 'HC-2026-MH01-000123',
        honey_type: 'Multiflora Raw Blossom',
        quantity_grams: 25000,
        harvest_timestamp: new Date('2026-09-05'),
        region: 'Wardha, Maharashtra',
        lab_verified: true,
        recalled: false,
        txHash: '0x9b4ae1c0788d44e5fa68d9047ca87fa13c3b0e36eB29b47a',
        metadataCID: 'QmZ4tDuPp599Zghq43a41zH2X8cK9xP145yW5N7tQ',
        metadataHash: '0xabc123789fedcba456',
        beekeeper: {
          name: 'Sunil Patil (KVIC Wardha Cluster CL-01)',
          region: 'Wardha, Maharashtra',
          kvicId: 'KVIC-MH-2026-081',
        },
        certificates: [
          {
            id: 'cert-1',
            certificateHash: '0x8f2d119ec845a7bb9104c4',
            ipfsCID: 'QmZ4tDuPp599Zghq43a41zH2X8cK9xP145yW5N7tQ',
            createdAt: new Date('2026-09-08'),
          },
        ],
        custodyEvents: [
          {
            id: 'cust-1',
            stage: 'HARVESTED_TO_LAB',
            from: '0x06a7E556dA2e1e7C40d0C3a19DDB6ED7cC7e4607',
            to: '0x321aB0e36eB29b47a98210DDB6ED7cC7e4607',
            fromCustodian: '0x06a7E556dA2e1e7C40d0C3a19DDB6ED7cC7e4607',
            toCustodian: '0x321aB0e36eB29b47a98210DDB6ED7cC7e4607',
            txHash: '0x9b4ae1c0788d44e5fa68d9047ca87fa13c3b0e36',
            createdAt: new Date('2026-09-06'),
          },
          {
            id: 'cust-2',
            stage: 'LAB_TO_PACKAGING',
            from: '0x321aB0e36eB29b47a98210DDB6ED7cC7e4607',
            to: '0x4B650a3d926A8f777f96422d790B0e36eB29b47a',
            fromCustodian: '0x321aB0e36eB29b47a98210DDB6ED7cC7e4607',
            toCustodian: '0x4B650a3d926A8f777f96422d790B0e36eB29b47a',
            txHash: '0x712fa9b4ae1c0788d44e5fa68d9047ca87fa13c3',
            createdAt: new Date('2026-09-09'),
          },
        ],
      };

      return (
        <div className="min-h-screen bg-[#07090e] text-slate-100 py-12 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/10 blur-[130px] pointer-events-none -z-10" />
          <VerifyClient
            batch={demoBatch as any}
            chainData={{
              status: 4, // Packaged
              labVerified: true,
              recalled: false,
              quantityGrams: 25000,
            }}
            integrity={{ valid: true }}
          />
        </div>
      );
    }

    return (
      <VerifyResult
        status="NOT_FOUND"
        message="Honey batch not found in the decentralized registry."
        batchCode={batchCode}
      />
    );
  }

  // Fetch live blockchain record from Polygon
  const chain = await getBatchFromChain(batchCode).catch(() => null);

  // Anchor integrity check directly to on-chain record if available, falling back to DB record
  const expectedHash = (chain?.metadataHash && chain.metadataHash !== '0x0000000000000000000000000000000000000000000000000000000000000000')
    ? chain.metadataHash
    : batch.metadataHash;

  const integrity = (batch.metadataCID && expectedHash)
    ? await verifyMetadataIntegrity(batch.metadataCID, expectedHash).catch(() => null)
    : null;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/10 blur-[130px] pointer-events-none -z-10" />
      <VerifyClient
        batch={batch as any}
        chainData={chain}
        integrity={integrity}
      />
    </div>
  );
}

function VerifyResult({
  status,
  message,
  batchCode,
}: {
  status: VerifyStatus;
  message?: string;
  batchCode?: string;
}) {
  const configs: Record<VerifyStatus, { bg: string; icon: any; title: string; color: string }> = {
    OK: { bg: 'border-emerald-500/40 bg-emerald-950/30', icon: ShieldAlert, title: 'Verified', color: 'text-emerald-400' },
    RECALLED: { bg: 'border-red-500/40 bg-red-950/30', icon: ShieldAlert, title: 'BATCH RECALLED', color: 'text-red-400' },
    NOT_FOUND: { bg: 'border-white/10 bg-slate-900/50', icon: QrCode, title: 'Batch Not Found', color: 'text-slate-300' },
    INVALID_SIGNATURE: { bg: 'border-red-500/40 bg-red-950/30', icon: AlertTriangle, title: 'Invalid Signature', color: 'text-red-400' },
    DEACTIVATED: { bg: 'border-amber-500/40 bg-amber-950/30', icon: AlertTriangle, title: 'Deactivated QR', color: 'text-amber-400' },
    INTEGRITY_FAIL: { bg: 'border-red-500/40 bg-red-950/30', icon: AlertTriangle, title: 'Data Integrity Error', color: 'text-red-400' },
    ERROR: { bg: 'border-white/10 bg-slate-900/50', icon: AlertTriangle, title: 'Verification Error', color: 'text-slate-300' },
  };

  const cfg = configs[status] ?? configs.ERROR;
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-6 text-slate-100">
      <div className={`w-full max-w-md rounded-3xl border ${cfg.bg} backdrop-blur-2xl p-8 text-center shadow-2xl space-y-5`}>
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-amber-400">
          <Icon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className={`text-2xl font-bold tracking-tight ${cfg.color}`}>{cfg.title}</h1>
          <p className="text-sm text-slate-400">{message}</p>
          {batchCode && (
            <p className="text-xs font-mono text-amber-400 mt-2 bg-black/40 px-3 py-1.5 rounded-full inline-block border border-white/10">
              Batch: {batchCode}
            </p>
          )}
        </div>

        {status === 'RECALLED' && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-left">
            ⚠️ <strong>DO NOT CONSUME:</strong> This product lot has been recalled by regulatory or producer authority. Contact your vendor for a refund.
          </div>
        )}

        <div className="pt-4 border-t border-white/10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Pollinator Home
          </Link>
        </div>
      </div>
    </div>
  );
}
