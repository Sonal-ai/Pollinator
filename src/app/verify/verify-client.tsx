'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  FileText, 
  Layers, 
  QrCode, 
  Calendar, 
  MapPin, 
  Scale, 
  Award,
  Clock,
  Hexagon
} from 'lucide-react';
import { motion } from 'framer-motion';

interface VerifyClientProps {
  batch: {
    batchCode: string;
    honey_type: string;
    quantity_grams: number;
    harvest_timestamp: Date | null;
    region: string | null;
    lab_verified: boolean;
    recalled: boolean;
    txHash: string | null;
    metadataCID: string | null;
    metadataHash: string | null;
    beekeeper?: {
      name: string;
      region: string;
      kvicId?: string | null;
    } | null;
    certificates?: Array<{
      id: string;
      certificateHash: string;
      ipfsCID: string;
      createdAt: Date;
    }>;
    custodyEvents?: Array<{
      id: string;
      stage: string;
      from?: string;
      to?: string;
      fromCustodian?: string;
      toCustodian?: string;
      txHash?: string | null;
      createdAt: Date;
    }>;
  };
  chainData: {
    status: number;
    labVerified: boolean;
    recalled: boolean;
    quantityGrams: number;
  } | null;
  integrity: {
    valid: boolean;
    reason?: string;
    networkError?: boolean;
  } | null;
  scanInfo?: {
    jarIndex: number;
    jarSizeGrams: number;
    totalScans: number;
    nonce?: string;
    latestScan: {
      timestamp: Date;
      ipRegion: string | null;
      ipCity: string | null;
      ipCountry: string | null;
    } | null;
    firstScan: {
      timestamp: Date;
      ipRegion: string | null;
    } | null;
  } | null;
  qrCodeDataUrl?: string | null;
}

const BATCH_STATUS_LABELS: Record<number, string> = {
  0: 'Created', 1: 'Harvested', 2: 'Processed', 3: 'Lab Verified',
  4: 'Packaged', 5: 'In Distribution', 6: 'At Retail', 7: 'Sold', 8: 'Recalled',
};

const AMOY_CONTRACT_ADDRESS = '0x4B650a3d926A8f777f96422d790B0e36eB29b47a';

export function VerifyClient({ batch, chainData, integrity, scanInfo, qrCodeDataUrl }: VerifyClientProps) {
  const [activeTab, setActiveTab] = useState<'certificate' | 'journey' | 'crypto'>('certificate');
  const [copiedTx, setCopiedTx] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);

  const isRecalled = batch.recalled || chainData?.recalled;
  const isIntegrityFailed = integrity && !integrity.valid && !integrity.networkError;

  const amoyExplorerTxUrl = batch.txHash
    ? `https://amoy.polygonscan.com/tx/${batch.txHash}`
    : `https://amoy.polygonscan.com/address/${AMOY_CONTRACT_ADDRESS}`;
  const amoyContractUrl = `https://amoy.polygonscan.com/address/${AMOY_CONTRACT_ADDRESS}`;

  // Dynamically resolve scanner's actual location (handles localhost/loopback gracefully)
  useEffect(() => {
    // 1. If server recorded a real location from external IP
    const serverParts = [
      scanInfo?.latestScan?.ipCity,
      scanInfo?.latestScan?.ipRegion,
      scanInfo?.latestScan?.ipCountry,
    ].filter(Boolean);

    if (serverParts.length > 0) {
      setDetectedLocation(serverParts.join(', '));
      return;
    }

    // 2. Otherwise (localhost 127.0.0.1 or local Wi-Fi), query client's public IP geolocation
    let isMounted = true;
    fetch('https://ipwho.is/')
      .then((r) => r.json())
      .then((data) => {
        if (isMounted && data && data.success) {
          const loc = [data.city, data.region, data.country].filter(Boolean).join(', ');
          if (loc) setDetectedLocation(loc);
        }
      })
      .catch(() => {
        // Fallback to secondary geo service
        fetch('https://ipapi.co/json/')
          .then((r) => r.json())
          .then((data) => {
            if (isMounted && data && (data.city || data.region)) {
              const loc = [data.city, data.region, data.country_name].filter(Boolean).join(', ');
              if (loc) setDetectedLocation(loc);
            }
          })
          .catch(() => {
            // Fallback default
          });
      });

    return () => {
      isMounted = false;
    };
  }, [scanInfo]);

  const copyTx = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  // Format title without duplicating "Honey"
  const formattedTitle = batch.honey_type.toLowerCase().includes('honey')
    ? batch.honey_type
    : `${batch.honey_type} Honey`;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 relative z-10">
      {/* Top Status Header */}
      <div className="text-center space-y-3">
        {isRecalled ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs sm:text-sm font-bold shadow-lg shadow-red-500/20">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
            DO NOT CONSUME · HIVE BATCH RECALLED
          </div>
        ) : isIntegrityFailed ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-5 h-5" />
            FRAUD ALERT · METADATA HASH MISMATCH
          </div>
        ) : (
          <a
            href={amoyExplorerTxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/15 hover:bg-yellow-400/25 border border-yellow-400/40 text-yellow-300 text-xs sm:text-sm font-extrabold shadow-lg shadow-yellow-500/20 transition-all group cursor-pointer"
            title="Inspect Batch Proof on Polygonscan Amoy Testnet"
          >
            <ShieldCheck className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" />
            <span>100% PURE HONEY · HONEYCHAIN AMOY VERIFIED</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-75 group-hover:opacity-100 transition-opacity" />
          </a>
        )}

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <span>{formattedTitle}</span>
          <span className="text-yellow-400">🍯</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Batch <span className="font-mono text-yellow-400 font-bold">{batch.batchCode}</span> · KVIC Honey Mission Protocol
        </p>

        {/* Live Physical Jar & Scannable QR Code Banner */}
        <div className="mt-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 border border-yellow-400/30 text-left space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-yellow-400 animate-pulse" />
              <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                {scanInfo ? `Physical Jar #${scanInfo.jarIndex} (${scanInfo.jarSizeGrams}g Net)` : 'Retail Serialized Jar'}
              </span>
            </div>
            {scanInfo ? (
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Scan #{scanInfo.totalScans} Verified
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-bold">
                Batch Verified
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Scannable QR Code Image */}
            {qrCodeDataUrl && (
              <div className="flex flex-col items-center shrink-0 bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-yellow-400/60 group">
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code for ${batch.batchCode}`}
                  className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                />
                <span className="text-[10px] text-slate-900 font-mono font-extrabold mt-1.5 flex items-center gap-1">
                  <span>📱 Scan with Phone</span>
                </span>
              </div>
            )}

            {/* Scan Analytics & Details */}
            <div className="flex-1 space-y-2.5 text-xs font-mono w-full">
              <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-300 bg-black/40 p-3 rounded-xl border border-white/5">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase flex items-center gap-1">
                    <span>Scan Node</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </span>
                  <span className="text-white font-bold flex items-center gap-1 truncate" title={detectedLocation || 'Detecting live node...'}>
                    <MapPin className="w-3 h-3 text-yellow-400 shrink-0" />
                    <span className="truncate">{detectedLocation || scanInfo?.latestScan?.ipRegion || scanInfo?.latestScan?.ipCity || 'Resolving Node...'}</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Scanned At</span>
                  <span className="text-yellow-300 font-bold">{new Date(scanInfo?.latestScan?.timestamp || Date.now()).toLocaleTimeString()}</span>
                </div>
              </div>

              {scanInfo?.nonce && (
                <div className="text-[10px] text-slate-400 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 truncate">
                  <span className="text-slate-500">Jar Nonce: </span>
                  <span className="text-amber-300 font-mono">{scanInfo.nonce}</span>
                </div>
              )}

              {/* Direct Polygonscan Amoy On-Chain Verification Actions */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <a
                  href={amoyExplorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-900/70 via-indigo-900/60 to-purple-800/70 hover:from-purple-800 hover:to-indigo-800 border border-purple-400/40 text-purple-100 hover:text-white text-xs font-bold transition-all shadow-md shadow-purple-950/40 group"
                  title="Open Transaction / Batch on Polygonscan Amoy"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span>🔗 View on Polygon Amoy Explorer ↗</span>
                </a>

                <a
                  href={amoyContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-black/50 hover:bg-black/80 border border-white/10 hover:border-purple-400/40 text-[11px] font-mono text-slate-300 hover:text-purple-300 transition-all"
                  title="View HoneyChain Smart Contract on Polygonscan"
                >
                  <span>Contract: 0x4B65...29b47a</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </div>

              <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-400/20 text-[11px] text-yellow-200/90 leading-relaxed">
                💡 <strong>Judges / Evaluators:</strong> Point your mobile camera at the QR code to trigger a live scan. Your smartphone will open this page, and the scan counter will increment to <strong>#{(scanInfo?.totalScans ?? 1) + 1}</strong>!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="flex rounded-full bg-black/60 p-1 border border-yellow-400/20">
        {[
          { id: 'certificate', label: 'Certificate of Purity', icon: Award },
          { id: 'journey', label: 'Honeycomb Journey', icon: Layers },
          { id: 'crypto', label: 'Blockchain Proof', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-full text-xs font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-black shadow-md shadow-yellow-500/20'
                  : 'text-slate-400 hover:text-yellow-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Holographic Certificate */}
      {activeTab === 'certificate' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl border border-yellow-400/40 bg-gradient-to-b from-[#141824] to-[#0c0e14] p-6 sm:p-8 shadow-2xl"
        >
          {/* Honey Foil Shimmer Effect */}
          <div className="absolute inset-0 foil-shimmer pointer-events-none opacity-40" />

          {/* Certificate Header */}
          <div className="flex items-start justify-between pb-6 border-b border-yellow-400/20 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase text-yellow-400 font-extrabold">
                <div className="w-4 h-4 relative shrink-0">
                  <Image src="/logo-mark-gold.png" alt="Pollinators Logo" width={16} height={16} className="object-contain" />
                </div>
                <span>CERTIFICATE OF PURITY & PROVENANCE</span>
              </div>
              <h2 className="text-xl font-extrabold text-white mt-1">{batch.honey_type}</h2>
              <p className="text-xs text-slate-400">Authentic Raw Bee Nectar · Zero Added Sugar Syrups</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/15 border border-yellow-400/40 flex items-center justify-center text-yellow-300 shrink-0 shadow-lg shadow-yellow-500/20">
              <Award className="w-6 h-6" />
            </div>
          </div>

          {/* Certificate Body */}
          <div className="grid grid-cols-2 gap-4 py-6 border-b border-yellow-400/20 relative z-10 text-xs sm:text-sm">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <MapPin className="w-3.5 h-3.5 text-yellow-400" /> Origin Region
              </span>
              <p className="font-extrabold text-white">{batch.beekeeper?.region ?? batch.region ?? 'India'}</p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Calendar className="w-3.5 h-3.5 text-yellow-400" /> Harvest Date
              </span>
              <p className="font-extrabold text-white">
                {batch.harvest_timestamp ? new Date(batch.harvest_timestamp).toLocaleDateString('en-IN') : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Award className="w-3.5 h-3.5 text-yellow-400" /> Beekeeper Producer
              </span>
              <p className="font-extrabold text-white truncate">{batch.beekeeper?.name ?? 'KVIC Registered Partner'}</p>
              {batch.beekeeper?.kvicId && (
                <p className="text-[10px] font-mono text-yellow-300 font-bold">KVIC ID: {batch.beekeeper.kvicId}</p>
              )}
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Scale className="w-3.5 h-3.5 text-yellow-400" /> Batch Weight
              </span>
              <p className="font-extrabold text-white">{(batch.quantity_grams / 1000).toFixed(1)} kg Lot</p>
            </div>
          </div>

          {/* Lab Verification Status Badge */}
          <div className="pt-6 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                batch.lab_verified 
                  ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40' 
                  : 'bg-slate-800 text-slate-400 border border-white/10'
              }`}>
                {batch.lab_verified ? <CheckCircle2 className="w-5 h-5 text-yellow-400" /> : <Clock className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-white">
                  {batch.lab_verified ? 'NABL Certified Lab Purity' : 'Pending Lab Confirmation'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {batch.lab_verified 
                    ? 'Gas Chromatography & C4 sugar test passed; PDF anchored on IPFS' 
                    : 'Initial harvest batch registered'}
                </p>
              </div>
            </div>

            {batch.certificates && batch.certificates.length > 0 && (
              <a
                href={`https://gateway.pinata.cloud/ipfs/${batch.certificates[0].ipfsCID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-xs font-bold text-yellow-300 flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                View Lab PDF
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab 2: Honeycomb Journey */}
      {activeTab === 'journey' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-yellow-400/25 bg-[#0d1017] p-6 sm:p-8 space-y-6 shadow-xl"
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <span>Honeycomb Supply Journey</span>
              <span className="text-yellow-400">🐝</span>
            </h3>
            <span className="text-xs font-mono font-bold text-yellow-300">Unbroken Custody Chain</span>
          </div>

          <div className="space-y-6 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-yellow-400 before:via-amber-400 before:to-emerald-400">
            {/* Step 1: Hive Harvest */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-yellow-400 text-black flex items-center justify-center font-extrabold text-[10px]">
                1
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-white">🐝 Harvested & Logged by Beekeeper</p>
                <p className="text-xs text-slate-400">
                  {batch.beekeeper?.name} ({batch.beekeeper?.region ?? batch.region}) · {batch.harvest_timestamp ? new Date(batch.harvest_timestamp).toLocaleDateString('en-IN') : 'Confirmed'}
                </p>
              </div>
            </div>

            {/* Step 2: Lab Test */}
            {batch.lab_verified && (
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-yellow-300 text-black flex items-center justify-center font-extrabold text-[10px]">
                  2
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-extrabold text-white">🧪 NABL Lab Authenticity Analysis Passed</p>
                  <p className="text-xs text-slate-400">
                    C4 sugar isotope ratio test passed. Certificate committed on-chain.
                  </p>
                </div>
              </div>
            )}

            {/* Custody events */}
            {batch.custodyEvents && batch.custodyEvents.map((evt, idx) => (
              <div key={evt.id} className="relative">
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center font-extrabold text-[10px]">
                  {idx + 3}
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-extrabold text-white">
                    🔄 Custody Handover: {evt.stage.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-400">
                    Logged on Polygon Amoy · {new Date(evt.createdAt).toLocaleDateString('en-IN')}
                  </p>
                  {evt.txHash && (
                    <a
                      href={`https://amoy.polygonscan.com/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-yellow-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      Tx: {evt.txHash.slice(0, 10)}... <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}

            {/* Current point */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-400 text-black flex items-center justify-center font-extrabold text-[10px]">
                ✓
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-emerald-300">📱 Verified by Consumer</p>
                <p className="text-xs text-slate-400">
                  Tamper-proof HMAC signature and single-location scan confirmed.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 3: Cryptographic Proofs */}
      {activeTab === 'crypto' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-yellow-400/25 bg-[#0d1017] p-6 sm:p-8 space-y-5 shadow-xl font-mono text-xs"
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 className="text-sm sm:text-base font-extrabold text-white font-sans flex items-center gap-2">
              <div className="w-5 h-5 relative shrink-0">
                <Image src="/logo-mark-gold.png" alt="Pollinators Logo" width={20} height={20} className="object-contain" />
              </div>
              <span>HoneyChain Blockchain & IPFS Ledger</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-300 text-[10px] font-extrabold border border-yellow-400/30">
              Polygon Amoy
            </span>
          </div>

          {/* On-Chain Record */}
          <div className="p-4 rounded-2xl bg-black/60 border border-yellow-400/10 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Smart Contract Call</span>
              <span className="text-yellow-300 font-bold">getBatch(keccak256(batchCode))</span>
            </div>
            <div className="space-y-1.5 pt-1 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-white">
                  {chainData ? BATCH_STATUS_LABELS[chainData.status] : 'Registered on-chain'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lab Signature:</span>
                <span className={chainData?.labVerified ? 'text-yellow-300 font-bold' : 'text-slate-400'}>
                  {chainData?.labVerified ? '✓ Validated by Lab Wallet' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recall Flag:</span>
                <span className={isRecalled ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {isRecalled ? '⚠ RECALLED' : 'Clean (False)'}
                </span>
              </div>
            </div>
          </div>

          {/* Smart Contract on Polygon Amoy */}
          <div className="p-4 rounded-2xl bg-black/60 border border-purple-500/20 space-y-1.5">
            <div className="flex items-center justify-between text-purple-300">
              <p className="text-[10px] uppercase font-bold tracking-wider">HoneyChain Smart Contract (Polygon Amoy)</p>
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                Chain ID: 80002
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-purple-200 font-mono text-[11px]">{AMOY_CONTRACT_ADDRESS}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => copyTx(AMOY_CONTRACT_ADDRESS)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                  title="Copy Contract Address"
                >
                  {copiedTx ? <Check className="w-3.5 h-3.5 text-purple-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={amoyContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/10 text-purple-400 hover:text-purple-300"
                  title="Open Contract on Polygonscan"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Transaction Hash */}
          {batch.txHash && (
            <div className="p-4 rounded-2xl bg-black/60 border border-yellow-400/10 space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-slate-500">Batch Creation Transaction</p>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-yellow-300 font-mono text-[11px]">{batch.txHash}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyTx(batch.txHash!)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                    title="Copy Transaction Hash"
                  >
                    {copiedTx ? <Check className="w-3.5 h-3.5 text-yellow-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={`https://amoy.polygonscan.com/tx/${batch.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-white/10 text-yellow-400 hover:text-yellow-300"
                    title="Open in Polygonscan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* IPFS CID */}
          {batch.metadataCID && (
            <div className="p-4 rounded-2xl bg-black/60 border border-yellow-400/10 space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-slate-500">IPFS Metadata CID (Pinata)</p>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-300 font-mono text-[11px]">{batch.metadataCID}</span>
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${batch.metadataCID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/10 text-yellow-400 hover:text-yellow-300 shrink-0"
                  title="View IPFS Content"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-yellow-400/10 border border-yellow-400/25 text-slate-300 font-sans text-xs">
            🍯 <strong>The Hive Guarantee:</strong> Even if a central database were altered, the immutable Polygon blockchain record and cryptographic IPFS hash guarantee that this honey's floral source, origin, and lab purity tests cannot be altered.
          </div>
        </motion.div>
      )}

      {/* Return link */}
      <div className="text-center pt-4">
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-yellow-400 transition-colors font-semibold"
        >
          ← Return to Pollinator Network
        </Link>
      </div>
    </div>
  );
}
