'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  MessageSquare, 
  FileCheck2, 
  PackageCheck, 
  QrCode, 
  CheckCircle2, 
  ArrowRight, 
  Hexagon,
  Sparkles
} from 'lucide-react';

export function ProvenanceSandbox() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 'iot',
      stepNum: '01',
      title: 'Smart Hive IoT Gateway',
      tag: 'Edge Sensor Cluster',
      icon: Wifi,
      accent: '#ffd21e',
      desc: 'ESP32 node mounted directly on the hive brood chamber. Measures internal temperature, relative humidity, and real-time nectar accumulation via load cell.',
      details: {
        nodeId: 'ESP32-HIVE-NODE-04',
        broodTemp: '34.2 °C (Optimal Hive Range)',
        hiveHumidity: '61.8% (Prevents Fermentation)',
        honeyWeight: '27.35 kg (+8.4 kg Nectar Flow)',
        powerSupply: 'Solar + LiPo 88%',
      },
      codeSnippet: `// MQTT edge packet published to AWS IoT
{
  "hiveCluster": "KVIC-WARDHA-CL01",
  "hiveId": "HIVE-04",
  "temperatureC": 34.2,
  "humidityPct": 61.8,
  "weightKg": 27.35,
  "timestamp": "2026-09-18T08:00:00Z"
}`,
      onChainStatus: 'Aggregated daily hash committed to IPFS',
    },
    {
      id: 'whatsapp',
      stepNum: '02',
      title: 'Forager WhatsApp Log',
      tag: 'Rural Bedrock AI Brain',
      icon: MessageSquare,
      accent: '#ffb800',
      desc: 'Smallholder beekeeper records a voice note in Marathi on WhatsApp. Amazon Bedrock (Claude 3 Haiku) transcribes, extracts quantity & flora type, and registers the batch.',
      details: {
        beekeeper: 'Sunil Patil (KVIC Wardha)',
        colonyHives: 'Hive #04, #05',
        honeyType: 'Multiflora Raw Blossom',
        harvestWeight: '25.0 kg',
        aiIntent: 'HARVEST_LOGGED (Conf: 0.98)',
      },
      codeSnippet: `// Bedrock Claude 3 Haiku semantic intent
{
  "senderWaId": "+9198230XXXXX",
  "nativeLanguage": "mr-IN (Marathi)",
  "intent": "LOG_HARVEST",
  "extracted": {
    "hives": [4, 5],
    "quantityKg": 25.0,
    "flora": "Multiflora Blossom"
  },
  "batchCode": "HC-2026-MH01-000123"
}`,
      onChainStatus: 'HoneyChain.createBatch(...) emitted on Amoy',
    },
    {
      id: 'lab',
      stepNum: '03',
      title: 'Nectar Lab Verification',
      tag: 'Decentralized IPFS Anchor',
      icon: FileCheck2,
      accent: '#ffd21e',
      desc: 'FSSAI/NABL certified lab tests for C4 syrup adulteration, HMF, and pollen purity. The PDF report is pinned to IPFS and signed permanently on Polygon Amoy.',
      details: {
        testingLab: 'AgriQuality Labs (NABL)',
        c4SugarPurity: '< 1.0% (Zero Adulteration)',
        moistureContent: '18.2% (Pure Raw Honey)',
        ipfsCID: 'QmZ4tDuPp599Zghq43a41z...',
        labCertHash: '0x8f2d119ec845a7...',
      },
      codeSnippet: `// IPFS Pinata pinning & cryptographic proof
const certHash = sha256(labReportPdf);
const ipfsCID = await pinata.upload(metadata);
await contract.verifyLab(batchIdHash, certHash);
// Event: LabVerified(batchIdHash, labSigner, certHash)`,
      onChainStatus: 'Polygon Amoy: labVerified = true',
    },
    {
      id: 'packaging',
      stepNum: '04',
      title: 'Hive Packaging & Tamper Seal',
      tag: 'HMAC Cryptographic Serialization',
      icon: PackageCheck,
      accent: '#ffb800',
      desc: 'Bulk batch packaged into 500g glass jars. Each jar receives an HMAC-SHA256 signed QR code with a cryptographically unique nonce to prevent physical cloning.',
      details: {
        jarSerial: 'Jar #042 of 50',
        tamperNonce: 'e9a4f21b7c001',
        hmacSig: '7d90f2aa11e8bc34...',
        custodyTransfer: 'Processor → Distributor',
        packagingStatus: 'SERIALIZED ON-CHAIN',
      },
      codeSnippet: `// Cryptographically signed anti-clone QR URL
const nonce = crypto.randomBytes(16).toString('hex');
const sig = hmacSHA256(batchCode + nonce, SECRET_KEY);
const qrUrl = "https://pollinator.app/verify"
  + "?b=" + batchCode 
  + "&n=" + nonce 
  + "&sig=" + sig;`,
      onChainStatus: 'Polygon Amoy: packageBatch(...) logged',
    },
    {
      id: 'consumer',
      stepNum: '05',
      title: 'Consumer Nectar Authenticity',
      tag: 'Instant Trust Proof',
      icon: QrCode,
      accent: '#ffd21e',
      desc: 'Consumer scans the jar QR code. Their browser verifies the HMAC signature, fetches the Polygon Amoy blockchain state, and cross-checks the IPFS metadata hash.',
      details: {
        verdict: '100% PURE & AUTHENTIC ✅',
        integrityHash: 'IPFS SHA-256 MATCH',
        geoScanRadar: 'Single Scan · Delhi',
        jarProvenance: 'Wardha, Maharashtra',
        blockchainTx: '0x9b4a...b47a (Verified)',
      },
      codeSnippet: `// Consumer client verification response
{
  "verified": true,
  "status": "GENUINE_UNALTERED",
  "origin": "Wardha, Maharashtra",
  "beekeeper": "Sunil Patil",
  "labCertified": true,
  "blockchainTx": "0x9b4ae1...b47a"
}`,
      onChainStatus: 'Smart Contract State: Verified Pure Honey',
    },
  ];

  const current = steps[activeStep];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-yellow-400/20 bg-[#0c0e14]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_80px_rgba(0,0,0,0.7)] relative overflow-hidden">
      {/* Background Honeycomb Glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-yellow-500/10 blur-[100px] pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-xs font-extrabold text-yellow-300 mb-2">
            <Hexagon className="w-3.5 h-3.5 fill-yellow-400/20" />
            <span>Interactive Blockchain Bee Sandbox</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            How Honey Moves From Honeycomb to Consumer Table
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Explore how IoT sensors, WhatsApp AI, IPFS, and Polygon Amoy seal the purity of every jar.
          </p>
        </div>

        {/* Next Stage Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveStep((prev) => (prev + 1) % steps.length)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-xs font-bold text-yellow-300 transition-all hover:scale-105"
          >
            <span>Next Stage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stepper Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-6">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isActive = idx === activeStep;
          return (
            <button
              key={s.id}
              onClick={() => setActiveStep(idx)}
              className={`relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-b from-yellow-400/20 to-yellow-500/5 border-yellow-400/60 shadow-lg shadow-yellow-500/15'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-yellow-400/25'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-yellow-300' : 'text-slate-500'}`}>
                  {s.stepNum}
                </span>
                <Icon className={`w-4 h-4 ${isActive ? 'text-yellow-400' : 'text-slate-500'}`} />
              </div>
              <p className={`text-xs font-bold leading-snug line-clamp-1 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {s.title}
              </p>
              <span className="text-[10px] text-slate-500 truncate w-full mt-0.5 font-medium">
                {s.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
        >
          {/* Left Column: Visual Story */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">
                  STAGE {current.stepNum}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{current.tag}</span>
              </div>
              <h4 className="text-xl font-bold text-white tracking-tight">{current.title}</h4>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">{current.desc}</p>
            </div>

            {/* Field Badges */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {Object.entries(current.details).map(([key, val]) => (
                <div
                  key={key}
                  className="p-3 rounded-2xl bg-black/50 border border-yellow-400/10 space-y-1"
                >
                  <p className="text-[10px] uppercase font-mono font-bold text-slate-500">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </p>
                  <p className="text-xs font-extrabold text-white truncate font-mono">{val}</p>
                </div>
              ))}
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-yellow-950/20 border border-yellow-400/20 text-xs text-yellow-300">
              <span className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                {current.onChainStatus}
              </span>
              <span className="font-mono text-[10px] text-yellow-400/80 font-bold">HoneyChain Amoy</span>
            </div>
          </div>

          {/* Right Column: Code Payload / Terminal Simulation */}
          <div className="lg:col-span-5 flex flex-col rounded-2xl bg-black/80 border border-yellow-400/20 p-4 font-mono text-xs overflow-hidden shadow-inner">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                <span className="ml-2 font-mono text-slate-400">pollinator-hive.log</span>
              </div>
              <span className="text-[10px] text-yellow-400 font-bold">HIVE STATE</span>
            </div>

            <pre className="flex-1 overflow-x-auto text-[11px] leading-relaxed text-yellow-300 font-mono">
              <code>{current.codeSnippet}</code>
            </pre>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500">
              <span>Amoy Block: 12,849,203</span>
              <span className="text-yellow-400 font-bold">GAS: 0.0004 MATIC</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
