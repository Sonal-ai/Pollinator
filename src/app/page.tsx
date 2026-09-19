import Link from 'next/link';
import Image from 'next/image';
import { 
  ShieldCheck, 
  Layers, 
  Cpu, 
  MessageSquareCode, 
  QrCode, 
  CheckCircle2, 
  Sparkles, 
  Hexagon, 
  ArrowUpRight, 
  Search,
  Lock,
  Zap,
  Globe2,
  FileCheck
} from 'lucide-react';
import { RollButton } from '@/components/ui/roll-button';
import { GlowCard } from '@/components/ui/glow-card';
import { Navbar } from '@/components/ui/navbar';
import { InteractiveHoneycomb } from '@/components/ui/interactive-honeycomb';
import { ProvenanceSandbox } from '@/components/ui/provenance-sandbox';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import {
  getActiveContractAddress,
  getActiveNetworkName,
  getExplorerAddressUrl,
  isLocalChain,
} from '@/lib/blockchain';

export default function HomePage() {
  const contractAddress = getActiveContractAddress() || '0x4B650a3d926A8f777f96422d790B0e36eB29b47a';
  const networkName = getActiveNetworkName();
  const isLocal = isLocalChain();
  const explorerUrl = getExplorerAddressUrl(contractAddress);

  return (
    <div className="min-h-screen bg-[#fbf9f4] dark:bg-[#080a0f] text-slate-900 dark:text-slate-100 relative overflow-hidden selection:bg-yellow-400 selection:text-black honeycomb-pattern transition-colors duration-300">
      {/* Honeycomb Grid Overlay across the page */}
      <div className="absolute inset-0 honeycomb-grid-overlay pointer-events-none opacity-50 dark:opacity-40 z-0" />

      {/* Radiant Beehive Yellow Aura Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b from-amber-400/20 dark:from-yellow-500/20 via-yellow-300/15 dark:via-amber-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[850px] right-0 w-[550px] h-[550px] bg-amber-400/20 dark:bg-yellow-500/10 blur-[160px] pointer-events-none -z-10" />
      <div className="absolute top-[1700px] left-0 w-[600px] h-[600px] bg-yellow-400/20 dark:bg-amber-500/10 blur-[160px] pointer-events-none -z-10" />

      {/* Floating Glass Navigation Header */}
      <Navbar contractAddress={contractAddress} />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/15 dark:bg-yellow-400/10 border border-amber-400/30 dark:border-yellow-400/30 text-xs font-extrabold text-amber-800 dark:text-yellow-300 backdrop-blur-md">
              <Hexagon className="w-3.5 h-3.5 fill-amber-400/30 dark:fill-yellow-400/30" />
              <span>Decentralized Beehive Intelligence & Provenance</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.08]">
              The Proof-of-Nectar Standard for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-amber-600 dark:from-yellow-300 dark:via-amber-300 dark:to-yellow-500 drop-shadow-[0_2px_20px_rgba(217,119,6,0.2)] dark:drop-shadow-[0_0_35px_rgba(255,210,30,0.4)]">
                Pure Honey.
              </span>
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              77% of commercial honey is adulterated with synthetic syrups. Pollinators links smart hive IoT sensors directly to the Polygon blockchain — guaranteeing the authenticity and origin of every jar.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <RollButton href="/dashboard" size="lg" variant="primary" icon={<Zap className="w-4 h-4 text-black" />}>
                Launch Supply Chain Portal
              </RollButton>

              <RollButton
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''}?text=Hi`}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                variant="whatsapp"
                icon={<WhatsAppIcon className="w-4 h-4 text-[#25D366]" />}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-800 dark:text-emerald-300 font-extrabold">Forager Bot</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 font-mono">WhatsApp</span>
                </span>
              </RollButton>
            </div>

            {/* Quick Proof Pills */}
            <div className="pt-6 border-t border-amber-200/80 dark:border-yellow-400/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3 rounded-2xl bg-amber-500/[0.05] dark:bg-transparent border border-amber-200/60 dark:border-transparent">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">100%</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">On-Chain Hashes</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/[0.05] dark:bg-transparent border border-amber-200/60 dark:border-transparent">
                <p className="text-2xl font-extrabold text-amber-600 dark:text-yellow-400 font-mono">Zero</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Adulteration Risk</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-950/25 border border-emerald-300/60 dark:border-emerald-500/30">
                <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1.5">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0" />
                  6 Langs
                </p>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Forager Bot AI</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/[0.05] dark:bg-transparent border border-amber-200/60 dark:border-transparent">
                <p className="text-2xl font-extrabold text-amber-600 dark:text-yellow-300 font-mono">5 Mins</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Hive Telemetry</p>
              </div>
            </div>
          </div>

          {/* Right Hero: Interactive 3D Honeycomb Mesh */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <InteractiveHoneycomb />
          </div>
        </div>
      </section>

      {/* Honeycomb Trail: Cryptographic Journey */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 sm:py-20 scroll-mt-24 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 dark:bg-yellow-400/10 border border-amber-400/30 dark:border-yellow-400/30 text-xs font-bold text-amber-800 dark:text-yellow-300">
            <Hexagon className="w-3.5 h-3.5 fill-amber-400/20 dark:fill-yellow-400/20" />
            <span>End-to-End Cryptographic Chain</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            The Honeycomb Trail
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            From smart brood frames deep in the forest apiary to your breakfast table — every step mathematically anchored.
          </p>
        </div>

        {/* 4-Step Visual Trail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Step 1 */}
          <div className="relative p-6 rounded-3xl border border-amber-200/80 dark:border-yellow-400/20 bg-white/80 dark:bg-[#0c0e14]/85 backdrop-blur-xl shadow-lg shadow-amber-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-amber-400/20 dark:bg-yellow-400/20 border border-amber-400/40 dark:border-yellow-400/30 flex items-center justify-center text-xs font-mono font-extrabold text-amber-800 dark:text-yellow-300">
                  01
                </span>
                <Cpu className="w-5 h-5 text-amber-600 dark:text-yellow-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-yellow-400/80">Edge IoT Frame</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">Apiary Telemetry</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                ESP32 brood sensors stream temperature (34.2°C), humidity, and load-cell harvest weight directly from the comb.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-amber-200/50 dark:border-white/10 text-[11px] font-mono text-amber-800 dark:text-yellow-300 font-semibold flex items-center justify-between">
              <span>MQTT over TLS</span>
              <span>Solar Active</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative p-6 rounded-3xl border border-emerald-300/70 dark:border-emerald-500/30 bg-white/85 dark:bg-[#0c0e14]/85 backdrop-blur-xl shadow-lg shadow-emerald-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/20 dark:bg-emerald-500/20 border border-emerald-500/40 dark:border-emerald-500/30 flex items-center justify-center text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-300">
                  02
                </span>
                <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Bedrock AI Voice</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                  <span className="text-emerald-700 dark:text-emerald-300">Forager Bot</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#25D366]/15 text-emerald-800 dark:text-emerald-300 border border-[#25D366]/30">WhatsApp</span>
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Rural beekeepers speak naturally in Marathi, Hindi, or Telugu. Claude 3 Haiku extracts harvest yield and assigns a batch code.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-emerald-200/50 dark:border-white/10 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-between">
              <span>Voice Note Audio</span>
              <span>Zero App Installs</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative p-6 rounded-3xl border border-amber-200/80 dark:border-yellow-400/20 bg-white/80 dark:bg-[#0c0e14]/85 backdrop-blur-xl shadow-lg shadow-amber-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-amber-400/20 dark:bg-yellow-400/20 border border-amber-400/40 dark:border-yellow-400/30 flex items-center justify-center text-xs font-mono font-extrabold text-amber-800 dark:text-yellow-300">
                  03
                </span>
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-yellow-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-yellow-400/80">Polygon Amoy</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">HoneyChain & IPFS</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                NABL lab purity certificates (&lt;1% C4 sugar) and IPFS metadata CIDs are immutably committed via smart contracts.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-amber-200/50 dark:border-white/10 text-[11px] font-mono text-amber-800 dark:text-yellow-300 font-semibold flex items-center justify-between">
              <span>SHA-256 Pinned</span>
              <span>RBAC Sealed</span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="relative p-6 rounded-3xl border border-amber-200/80 dark:border-yellow-400/20 bg-white/80 dark:bg-[#0c0e14]/85 backdrop-blur-xl shadow-lg shadow-amber-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-amber-400/20 dark:bg-yellow-400/20 border border-amber-400/40 dark:border-yellow-400/30 flex items-center justify-center text-xs font-mono font-extrabold text-amber-800 dark:text-yellow-300">
                  04
                </span>
                <QrCode className="w-5 h-5 text-amber-600 dark:text-yellow-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-yellow-400/80">Anti-Clone QR</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">Proof-of-Nectar</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Each jar receives an HMAC-SHA256 nonced QR code. Consumer scans verify provenance and geospatial scan telemetry prevents cloning.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-amber-200/50 dark:border-white/10 text-[11px] font-mono text-amber-800 dark:text-yellow-300 font-semibold flex items-center justify-between">
              <span>HMAC Nonced</span>
              <span>100% Genuine</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Provenance Sandbox */}
      <section id="sandbox" className="max-w-6xl mx-auto px-6 py-16 scroll-mt-24 relative z-10">
        <ProvenanceSandbox />
      </section>

      {/* Feature Bento Grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-24 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 dark:bg-yellow-400/10 border border-amber-400/30 dark:border-yellow-400/30 text-xs font-bold text-amber-800 dark:text-yellow-300">
            <Hexagon className="w-3.5 h-3.5 fill-amber-400/20 dark:fill-yellow-400/20" />
            <span>Blockchain Bee Ecosystem</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hive Architecture
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Engineered with EVM smart contracts, IoT brood sensors, and multimodal AI to eliminate middlemen exploitation and synthetic syrup dilution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Hive IoT */}
          <GlowCard glowColor="yellow" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 dark:bg-yellow-400/15 border border-amber-400/30 dark:border-yellow-400/30 flex items-center justify-center text-amber-600 dark:text-yellow-300 mb-5 shadow-lg shadow-amber-500/10 dark:shadow-yellow-500/10">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Smart Hive IoT Sensors</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              ESP32 microcontrollers inside the brood chamber stream temperature, humidity, and hive weight. Real-time telemetry detects swarms, honey accumulation, and colony stress.
            </p>
            <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-white/10 flex items-center justify-between text-xs font-mono text-amber-800 dark:text-yellow-300 font-semibold">
              <span>BME280 + Load Cell</span>
              <span>34.2°C Optimal</span>
            </div>
          </GlowCard>

          {/* Card 2: Smart Contract */}
          <GlowCard glowColor="gold" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-300 mb-5 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Polygon Amoy HoneyChain</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <code className="text-amber-800 dark:text-yellow-300 font-mono text-xs">HoneyChain.sol</code> enforces cryptographic roles. Only registered beekeepers create batches, and only certified labs commit test hashes.
            </p>
            <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-white/10 flex items-center justify-between text-xs font-mono text-amber-800 dark:text-yellow-300 font-semibold">
              <span>OpenZeppelin RBAC</span>
              <span>Fast & Zero-Cost</span>
            </div>
          </GlowCard>

          {/* Card 3: Anti-Clone QR */}
          <GlowCard glowColor="yellow" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 dark:bg-yellow-400/15 border border-amber-400/30 dark:border-yellow-400/30 flex items-center justify-center text-amber-600 dark:text-yellow-300 mb-5 shadow-lg shadow-amber-500/10 dark:shadow-yellow-500/10">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Anti-Clone Tamper Seal</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Each jar gets an HMAC-SHA256 signed QR with a unique cryptographic nonce. Geolocation velocity analytics flag duplicated QR scans across different cities.
            </p>
            <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-white/10 flex items-center justify-between text-xs font-mono text-amber-800 dark:text-yellow-300 font-semibold">
              <span>HMAC-SHA256 Signed</span>
              <span>Geospatial Radar</span>
            </div>
          </GlowCard>

          {/* Card 4: Forager Bot */}
          <GlowCard glowColor="emerald" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#25D366] mb-5 shadow-lg shadow-emerald-500/10">
              <WhatsAppIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <span>Multilingual WhatsApp</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Forager Bot</span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Rural beekeepers need zero app downloads. Claude 3 Haiku on Amazon Bedrock processes voice notes and messages in Hindi, Telugu, Marathi, Bengali, Tamil, and English.
            </p>
            <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-white/10 flex items-center justify-between text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
              <span>Amazon Bedrock</span>
              <span className="flex items-center gap-1 text-[#25D366] font-bold">
                <WhatsAppIcon className="w-3.5 h-3.5" />
                Live on WhatsApp
              </span>
            </div>
          </GlowCard>

          {/* Card 5: IPFS Pinning */}
          <GlowCard glowColor="yellow" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 dark:bg-yellow-400/15 border border-amber-400/30 dark:border-yellow-400/30 flex items-center justify-center text-amber-600 dark:text-yellow-300 mb-5 shadow-lg shadow-amber-500/10 dark:shadow-yellow-500/10">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Decentralized IPFS Pinning</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Lab purity certificates and harvest metadata are pinned to IPFS via Pinata. The SHA-256 hash committed on-chain makes altering even a single byte mathematically impossible.
            </p>
            <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-white/10 flex items-center justify-between text-xs font-mono text-amber-800 dark:text-yellow-300 font-semibold">
              <span>Pinata Gateway</span>
              <span>SHA-256 Verified</span>
            </div>
          </GlowCard>

          {/* Card 6: Hive Recall */}
          <GlowCard glowColor="amber" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400 mb-5 shadow-lg shadow-red-500/10">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">On-Chain Recall Kill-Switch</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              If an adulterated or cloned batch is flagged, admins trigger on-chain recall. Every consumer scan immediately displays a prominent red warning not to consume.
            </p>
            <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-white/10 flex items-center justify-between text-xs font-mono text-red-600 dark:text-red-300 font-semibold">
              <span>Smart Contract State</span>
              <span>Public Health Guard</span>
            </div>
          </GlowCard>
        </div>
      </section>

      {/* Try Consumer Verification Demo */}
      <section id="verify-demo" className="max-w-4xl mx-auto px-6 py-16 scroll-mt-24 relative z-10">
        <div className="relative overflow-hidden rounded-3xl border border-amber-300/60 dark:border-yellow-400/35 bg-gradient-to-br from-amber-100/90 via-white to-amber-50/70 dark:from-yellow-500/10 dark:via-[#0d1017] dark:to-black p-8 sm:p-12 text-center backdrop-blur-2xl shadow-xl dark:shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/20 dark:bg-yellow-400/20 border border-amber-400/40 dark:border-yellow-400/40 flex items-center justify-center text-amber-600 dark:text-yellow-300 mx-auto mb-6 shadow-lg shadow-amber-500/20 dark:shadow-yellow-500/30">
            <QrCode className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Verify a Genuine Honeycomb Jar
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-lg mx-auto mb-8">
            Try the consumer verification experience. Enter a batch code or inspect our live Polygon Amoy sample batch.
          </p>

          <form action="/verify" method="GET" className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                name="b"
                defaultValue="HC-2026-MH01-000123"
                placeholder="Enter Batch Code..."
                className="w-full px-4 py-3 rounded-full bg-white dark:bg-black/70 border border-amber-300/70 dark:border-yellow-400/25 text-xs sm:text-sm font-mono text-slate-900 dark:text-yellow-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 dark:focus:border-yellow-400 transition-colors shadow-inner"
                required
              />
              <input type="hidden" name="n" value="demo-nonce-789" />
              <input type="hidden" name="sig" value="demo-hmac-signature" />
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-black text-xs sm:text-sm font-extrabold shadow-lg shadow-yellow-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Verify Batch
            </button>
          </form>

          <p className="text-xs text-slate-600 dark:text-slate-400 mt-4">
            Live sample batch: <span className="font-mono text-amber-700 dark:text-yellow-400 font-bold">HC-2026-MH01-000123</span> (KVIC Wardha Cluster)
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-amber-200/60 dark:border-yellow-400/15 bg-[#f5efe4] dark:bg-[#06070a] py-12 px-6 relative z-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 shadow-md shadow-yellow-500/20 p-1">
              <Image
                src="/logo-mark.png"
                alt="Pollinators Logo"
                width={28}
                height={28}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-1">
                Pollinators HoneyChain
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Decentralized Honey Provenance & Hive Intelligence</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-400">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-700 dark:hover:text-yellow-400 transition-colors flex items-center gap-1 font-mono text-amber-800 dark:text-yellow-400/80 font-bold"
              >
                Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                <ArrowUpRight className="w-3 h-3" />
              </a>
            ) : (
              <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400/80">
                Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)} ({networkName})
              </span>
            )}
            <Link href="/dashboard" className="hover:text-amber-800 dark:hover:text-white transition-colors font-medium">
              Supply Chain Dashboard
            </Link>
            <Link href="/dashboard/login" className="hover:text-amber-800 dark:hover:text-white transition-colors font-medium">
              Portal Login
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-800 dark:hover:text-white transition-colors font-medium"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-amber-200/40 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-600">
          <p>© 2026 Pollinator. Aligned with KVIC National Honey Mission standards.</p>
          <p>Powered by Next.js, Polygon Amoy, IPFS, and AWS Bedrock.</p>
        </div>
      </footer>
    </div>
  );
}
