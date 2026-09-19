import Link from 'next/link';
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
import { NetworkBadge } from '@/components/ui/network-badge';
import { InteractiveHoneycomb } from '@/components/ui/interactive-honeycomb';
import { ProvenanceSandbox } from '@/components/ui/provenance-sandbox';

export default function HomePage() {
  const contractAddress = '0x4B650a3d926A8f777f96422d790B0e36eB29b47a';

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 relative overflow-hidden selection:bg-yellow-400 selection:text-black honeycomb-pattern">
      {/* Honeycomb Grid Overlay across the page */}
      <div className="absolute inset-0 honeycomb-grid-overlay pointer-events-none opacity-40 z-0" />

      {/* Radiant Beehive Yellow Aura Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b from-yellow-500/20 via-amber-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[850px] right-0 w-[550px] h-[550px] bg-yellow-500/10 blur-[160px] pointer-events-none -z-10" />
      <div className="absolute top-[1700px] left-0 w-[600px] h-[600px] bg-amber-500/10 blur-[160px] pointer-events-none -z-10" />

      {/* Floating Glass Navigation Header */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between px-6 py-3.5 rounded-full border border-yellow-400/25 bg-[#0c0e14]/85 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 text-black shadow-lg shadow-yellow-500/35 group-hover:scale-110 transition-transform duration-300">
              <Hexagon className="w-5 h-5 fill-black/25" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight group-hover:text-yellow-300 transition-colors flex items-center gap-1.5">
                Pollinator <span className="text-yellow-400">🐝</span>
              </span>
              <span className="hidden sm:inline-block ml-1 px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-yellow-400/15 text-yellow-300 border border-yellow-400/30">
                HONEYCHAIN
              </span>
            </div>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-300">
            <a href="#how-it-works" className="hover:text-yellow-300 transition-colors">
              Honeycomb Trail
            </a>
            <a href="#features" className="hover:text-yellow-300 transition-colors">
              Hive Architecture
            </a>
            <a href="#sandbox" className="hover:text-yellow-300 transition-colors">
              Live Sandbox
            </a>
            <a href="#verify-demo" className="hover:text-yellow-300 transition-colors">
              Verify Nectar
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <NetworkBadge contractAddress={contractAddress} className="hidden sm:inline-flex" />
            <RollButton href="/dashboard" size="sm" variant="primary">
              Launch Hive
            </RollButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-xs font-extrabold text-yellow-300 backdrop-blur-md">
              <Hexagon className="w-3.5 h-3.5 fill-yellow-400/30" />
              <span>Decentralized Beehive Intelligence & Provenance</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.08]">
              The Proof-of-Nectar Standard for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 drop-shadow-[0_0_35px_rgba(255,210,30,0.4)]">
                Pure Honey.
              </span>
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              77% of commercial honey is adulterated with synthetic syrups. Pollinator links smart hive IoT sensors directly to the Polygon blockchain — guaranteeing the authenticity and origin of every jar.
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
                variant="secondary"
                icon={<MessageSquareCode className="w-4 h-4 text-yellow-400" />}
              >
                Forager Bot (WhatsApp)
              </RollButton>
            </div>

            {/* Quick Proof Pills */}
            <div className="pt-6 border-t border-yellow-400/15 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div>
                <p className="text-2xl font-extrabold text-white font-mono">100%</p>
                <p className="text-xs text-slate-400">On-Chain Hashes</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-yellow-400 font-mono">Zero</p>
                <p className="text-xs text-slate-400">Adulteration Risk</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-amber-400 font-mono">6 Langs</p>
                <p className="text-xs text-slate-400">Forager Voice AI</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-yellow-300 font-mono">5 Mins</p>
                <p className="text-xs text-slate-400">Hive Telemetry</p>
              </div>
            </div>
          </div>

          {/* Right Hero: Interactive 3D Honeycomb Mesh */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <InteractiveHoneycomb />
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-xs font-bold text-yellow-300">
            <Hexagon className="w-3.5 h-3.5 fill-yellow-400/20" />
            <span>Blockchain Bee Ecosystem</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Sealed by Cryptography from Hive to Table
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Engineered with EVM smart contracts, IoT brood sensors, and multimodal AI to eliminate middlemen exploitation and synthetic syrup dilution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Hive IoT */}
          <GlowCard glowColor="yellow" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-300 mb-5 shadow-lg shadow-yellow-500/10">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Smart Hive IoT Sensors</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              ESP32 microcontrollers inside the brood chamber stream temperature, humidity, and hive weight. Real-time telemetry detects swarms, honey accumulation, and colony stress.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-yellow-300 font-semibold">
              <span>BME280 + Load Cell</span>
              <span>34.2°C Optimal</span>
            </div>
          </GlowCard>

          {/* Card 2: Smart Contract */}
          <GlowCard glowColor="gold" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 mb-5 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Polygon Amoy HoneyChain</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              <code className="text-yellow-300 font-mono text-xs">HoneyChain.sol</code> enforces cryptographic roles. Only registered beekeepers create batches, and only certified labs commit test hashes.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-yellow-300 font-semibold">
              <span>OpenZeppelin RBAC</span>
              <span>Fast & Zero-Cost</span>
            </div>
          </GlowCard>

          {/* Card 3: Anti-Clone QR */}
          <GlowCard glowColor="yellow" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-300 mb-5 shadow-lg shadow-yellow-500/10">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Anti-Clone Tamper Seal</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Each jar gets an HMAC-SHA256 signed QR with a unique cryptographic nonce. Geolocation velocity analytics flag duplicated QR scans across different cities.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-yellow-300 font-semibold">
              <span>HMAC-SHA256 Signed</span>
              <span>Geospatial Radar</span>
            </div>
          </GlowCard>

          {/* Card 4: Forager Bot */}
          <GlowCard glowColor="gold" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 mb-5 shadow-lg shadow-amber-500/10">
              <MessageSquareCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Multilingual WhatsApp Forager AI</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Rural beekeepers need zero app downloads. Claude 3 Haiku on Amazon Bedrock processes voice notes and messages in Hindi, Telugu, Marathi, Bengali, Tamil, and English.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-yellow-300 font-semibold">
              <span>Amazon Bedrock</span>
              <span>Voice Note Audio</span>
            </div>
          </GlowCard>

          {/* Card 5: IPFS Pinning */}
          <GlowCard glowColor="yellow" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-300 mb-5 shadow-lg shadow-yellow-500/10">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Decentralized IPFS Pinning</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Lab purity certificates and harvest metadata are pinned to IPFS via Pinata. The SHA-256 hash committed on-chain makes altering even a single byte mathematically impossible.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-yellow-300 font-semibold">
              <span>Pinata Gateway</span>
              <span>SHA-256 Verified</span>
            </div>
          </GlowCard>

          {/* Card 6: Hive Recall */}
          <GlowCard glowColor="amber" className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 shadow-lg shadow-red-500/10">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">On-Chain Recall Kill-Switch</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              If an adulterated or cloned batch is flagged, admins trigger on-chain recall. Every consumer scan immediately displays a prominent red warning not to consume.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-red-300 font-semibold">
              <span>Smart Contract State</span>
              <span>Public Health Guard</span>
            </div>
          </GlowCard>
        </div>
      </section>

      {/* Try Consumer Verification Demo */}
      <section id="verify-demo" className="max-w-4xl mx-auto px-6 py-16 scroll-mt-24 relative z-10">
        <div className="relative overflow-hidden rounded-3xl border border-yellow-400/35 bg-gradient-to-br from-yellow-500/10 via-[#0d1017] to-black p-8 sm:p-12 text-center backdrop-blur-2xl shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center text-yellow-300 mx-auto mb-6 shadow-lg shadow-yellow-500/30">
            <QrCode className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            Verify a Genuine Honeycomb Jar
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto mb-8">
            Try the consumer verification experience. Enter a batch code or inspect our live Polygon Amoy sample batch.
          </p>

          <form action="/verify" method="GET" className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                name="b"
                defaultValue="HC-2026-MH01-000123"
                placeholder="Enter Batch Code..."
                className="w-full px-4 py-3 rounded-full bg-black/70 border border-yellow-400/25 text-xs sm:text-sm font-mono text-yellow-300 placeholder-slate-500 focus:outline-none focus:border-yellow-400 transition-colors"
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

          <p className="text-xs text-slate-400 mt-4">
            Live sample batch: <span className="font-mono text-yellow-400 font-bold">HC-2026-MH01-000123</span> (KVIC Wardha Cluster)
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-yellow-400/15 bg-[#06070a] py-12 px-6 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold">
              <Hexagon className="w-4 h-4 fill-black/20" />
            </div>
            <div>
              <p className="font-extrabold text-white text-sm flex items-center gap-1">
                Pollinator HoneyChain <span>🐝</span>
              </p>
              <p className="text-xs text-slate-500">Decentralized Honey Provenance & Hive Intelligence</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <a
              href={`https://amoy.polygonscan.com/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow-400 transition-colors flex items-center gap-1 font-mono text-yellow-400/80"
            >
              Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
              <ArrowUpRight className="w-3 h-3" />
            </a>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Supply Chain Dashboard
            </Link>
            <Link href="/dashboard/login" className="hover:text-white transition-colors">
              Portal Login
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-600">
          <p>© 2026 Pollinator. Aligned with KVIC National Honey Mission standards.</p>
          <p>Powered by Next.js, Polygon Amoy, IPFS, and AWS Bedrock.</p>
        </div>
      </footer>
    </div>
  );
}
