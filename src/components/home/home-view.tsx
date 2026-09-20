'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';
import { 
  ShieldCheck, 
  Cpu, 
  QrCode, 
  Hexagon, 
  ArrowUpRight, 
  Search,
  Lock,
  Zap,
  FileCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { RollButton } from '@/components/ui/roll-button';
import { GlowCard } from '@/components/ui/glow-card';
import { Navbar } from '@/components/ui/navbar';
import { InteractiveHoneycomb } from '@/components/ui/interactive-honeycomb';
import { ProvenanceSandbox } from '@/components/ui/provenance-sandbox';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';

interface HomeViewProps {
  contractAddress: string;
  networkName: string;
  explorerUrl: string | null;
  isLocal: boolean;
  whatsappNumber?: string;
}

// Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

export function HomeView({
  contractAddress,
  networkName,
  explorerUrl,
  isLocal,
  whatsappNumber = '918882218036',
}: HomeViewProps) {
  const [sampleBatch, setSampleBatch] = useState('HC-2026-MH01-000123');

  return (
    <div className="min-h-screen bg-[#fbf9f4] dark:bg-[#080a0f] text-slate-900 dark:text-slate-100 relative overflow-hidden selection:bg-yellow-400 selection:text-black honeycomb-pattern transition-colors duration-300">
      {/* Honeycomb Grid Overlay */}
      <div className="absolute inset-0 honeycomb-grid-overlay pointer-events-none opacity-50 dark:opacity-40 z-0" />

      {/* Radiant Floating Aura Glows with Ambient Motion */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b from-amber-400/20 dark:from-yellow-500/25 via-yellow-300/15 dark:via-amber-500/10 to-transparent blur-[140px] pointer-events-none -z-10"
      />
      <motion.div
        animate={{
          y: [-15, 15, -15],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[850px] right-0 w-[550px] h-[550px] bg-amber-400/20 dark:bg-yellow-500/15 blur-[160px] pointer-events-none -z-10"
      />
      <motion.div
        animate={{
          y: [15, -15, 15],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[1700px] left-0 w-[600px] h-[600px] bg-yellow-400/20 dark:bg-amber-500/15 blur-[160px] pointer-events-none -z-10"
      />

      {/* Floating Animated Golden Particles / Pollen Specks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-amber-400/30 dark:bg-yellow-300/30 blur-[1px]"
            style={{
              width: `${6 + (i % 3) * 4}px`,
              height: `${6 + (i % 3) * 4}px`,
              left: `${15 + i * 15}%`,
              top: `${120 + (i % 4) * 200}px`,
            }}
            animate={{
              y: [-25, 25, -25],
              x: [-15, 15, -15],
              opacity: [0.2, 0.65, 0.2],
              scale: [0.9, 1.25, 0.9],
            }}
            transition={{
              duration: 5 + i * 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.7,
            }}
          />
        ))}
      </div>

      {/* Floating Glass Navigation Header */}
      <Navbar
        contractAddress={contractAddress}
        networkName={networkName}
        explorerUrl={explorerUrl}
        isLocal={isLocal}
      />

      {/* ============================================================ */}
      {/* Hero Section with Page Open Stagger Animations */}
      {/* ============================================================ */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-7 space-y-6 text-center lg:text-left"
          >
            {/* Tag Badge */}
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/15 dark:bg-yellow-400/10 border border-amber-400/35 dark:border-yellow-400/35 text-xs font-extrabold text-amber-800 dark:text-yellow-300 backdrop-blur-md shadow-sm">
                <motion.div
                  animate={{ rotate: [0, 60, 120, 180, 240, 300, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <Hexagon className="w-3.5 h-3.5 fill-amber-400/30 dark:fill-yellow-400/30 text-amber-600 dark:text-yellow-300" />
                </motion.div>
                <span>Decentralized Beehive Intelligence & Provenance</span>
              </div>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.08]"
            >
              The Proof-of-Nectar Standard for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-amber-600 dark:from-yellow-300 dark:via-amber-300 dark:to-yellow-500 drop-shadow-[0_2px_20px_rgba(217,119,6,0.2)] dark:drop-shadow-[0_0_35px_rgba(255,210,30,0.45)]">
                Pure Honey.
              </span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              variants={itemVariants}
              className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal"
            >
              Over 70% of commercial honey is adulterated with synthetic syrups. Pollinator links smart hive IoT sensors directly to Polygon Amoy smart contracts—guaranteeing authentic origin and purity for every single jar.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2"
            >
              <RollButton href="/dashboard" size="lg" variant="primary" icon={<Zap className="w-4 h-4 text-black" />}>
                Launch Supply Chain Portal
              </RollButton>

              <RollButton
                href={`https://wa.me/${whatsappNumber}?text=Hi`}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                variant="whatsapp"
                icon={<WhatsAppIcon className="w-4 h-4 text-[#25D366]" />}
              >
                <span className="text-emerald-900 dark:text-emerald-200 font-extrabold">
                  Forager WhatsApp Bot
                </span>
              </RollButton>
            </motion.div>

            {/* Quick Proof Stat Pills */}
            <motion.div
              variants={itemVariants}
              className="pt-6 border-t border-amber-200/80 dark:border-yellow-400/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left"
            >
              <motion.div 
                whileHover={{ y: -3, scale: 1.02 }}
                className="p-3.5 rounded-2xl bg-amber-500/[0.06] dark:bg-white/[0.03] border border-amber-300/50 dark:border-white/10 backdrop-blur-sm transition-colors"
              >
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">100%</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">On-Chain Hashes</p>
              </motion.div>
              <motion.div 
                whileHover={{ y: -3, scale: 1.02 }}
                className="p-3.5 rounded-2xl bg-amber-500/[0.06] dark:bg-white/[0.03] border border-amber-300/50 dark:border-white/10 backdrop-blur-sm transition-colors"
              >
                <p className="text-2xl font-extrabold text-amber-600 dark:text-yellow-400 font-mono">Zero</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Adulteration Risk</p>
              </motion.div>
              <motion.div 
                whileHover={{ y: -3, scale: 1.02 }}
                className="p-3.5 rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-950/30 border border-emerald-300/60 dark:border-emerald-500/30 flex flex-col justify-between transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                    6 Langs
                  </p>
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0" />
                </div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Forager Bot AI</p>
              </motion.div>
              <motion.div 
                whileHover={{ y: -3, scale: 1.02 }}
                className="p-3.5 rounded-2xl bg-amber-500/[0.06] dark:bg-white/[0.03] border border-amber-300/50 dark:border-white/10 backdrop-blur-sm transition-colors"
              >
                <p className="text-2xl font-extrabold text-amber-600 dark:text-yellow-300 font-mono">2 Sec</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Hive Telemetry</p>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Right Hero: Interactive 3D Honeycomb Mesh */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex items-center justify-center"
          >
            <InteractiveHoneycomb />
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Section 1: The Farm-to-Jar Traceability Journey (Clear Flow) */}
      {/* ============================================================ */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 sm:py-20 scroll-mt-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
          className="text-center max-w-2xl mx-auto mb-14 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/15 dark:bg-yellow-400/10 border border-amber-400/30 dark:border-yellow-400/30 text-xs font-bold text-amber-800 dark:text-yellow-300">
            <Hexagon className="w-3.5 h-3.5 fill-amber-400/20 dark:fill-yellow-400/20" />
            <span>Farm-to-Jar Cryptographic Provenance</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            The Honey Traceability Journey
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            From smart brood frames deep in the forest apiary to your breakfast table — every step mathematically anchored.
          </p>
        </motion.div>

        {/* 4-Step Visual Trail Grid with Staggered Scroll Reveal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="relative p-6 rounded-3xl border border-amber-300/70 dark:border-yellow-400/25 bg-white/85 dark:bg-[#0c0e14]/90 backdrop-blur-xl shadow-lg shadow-amber-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
          >
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
                ESP32 brood sensors stream temperature (35.1°C), humidity, and load-cell harvest weight directly from the comb every 2 seconds.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-amber-200/50 dark:border-white/10 text-[11px] font-mono text-amber-800 dark:text-yellow-300 font-semibold flex items-center justify-between">
              <span>MQTT over TLS</span>
              <span className="text-emerald-600 dark:text-emerald-400">● Live Stream</span>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="relative p-6 rounded-3xl border border-emerald-300/70 dark:border-emerald-500/30 bg-white/85 dark:bg-[#0c0e14]/90 backdrop-blur-xl shadow-lg shadow-emerald-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/20 dark:bg-emerald-500/20 border border-emerald-500/40 dark:border-emerald-500/30 flex items-center justify-center text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-300">
                  02
                </span>
                <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Conversational AI</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                  <span className="text-emerald-700 dark:text-emerald-300">Forager Bot</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#25D366]/15 text-emerald-800 dark:text-emerald-300 border border-[#25D366]/30">WhatsApp</span>
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Rural beekeepers speak naturally in regional languages. AI extracts harvest yield and initiates batch creation without complex Web3 logins.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-emerald-200/50 dark:border-white/10 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-between">
              <span>Voice Note Audio</span>
              <span>Zero App Installs</span>
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="relative p-6 rounded-3xl border border-amber-300/70 dark:border-yellow-400/25 bg-white/85 dark:bg-[#0c0e14]/90 backdrop-blur-xl shadow-lg shadow-amber-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-amber-400/20 dark:bg-yellow-400/20 border border-amber-400/40 dark:border-yellow-400/30 flex items-center justify-center text-xs font-mono font-extrabold text-amber-800 dark:text-yellow-300">
                  03
                </span>
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-yellow-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-yellow-400/80">Polygon Amoy</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">NABL Lab & IPFS</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                NABL lab purity certificates (0.0% C4 sugar) and IPFS metadata CIDs are immutably committed via smart contracts with weight locking.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-amber-200/50 dark:border-white/10 text-[11px] font-mono text-amber-800 dark:text-yellow-300 font-semibold flex items-center justify-between">
              <span>Pinata Gateway</span>
              <span>RBAC Sealed</span>
            </div>
          </motion.div>

          {/* Step 4 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="relative p-6 rounded-3xl border border-amber-300/70 dark:border-yellow-400/25 bg-white/85 dark:bg-[#0c0e14]/90 backdrop-blur-xl shadow-lg shadow-amber-500/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-amber-400/20 dark:bg-yellow-400/20 border border-amber-400/40 dark:border-yellow-400/30 flex items-center justify-center text-xs font-mono font-extrabold text-amber-800 dark:text-yellow-300">
                  04
                </span>
                <QrCode className="w-5 h-5 text-amber-600 dark:text-yellow-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-yellow-400/80">Anti-Clone QR</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">Dual-Layer Verify</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Each jar receives an HMAC-SHA256 nonced QR code. Consumer scans verify provenance and geospatial scan telemetry prevents cloning.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-amber-200/50 dark:border-white/10 text-[11px] font-mono text-amber-800 dark:text-yellow-300 font-semibold flex items-center justify-between">
              <span>HMAC Nonced</span>
              <span>100% Genuine</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Section 2: Interactive Provenance Protocol (Clear Context) */}
      {/* ============================================================ */}
      <section id="pipeline" className="max-w-6xl mx-auto px-6 py-16 scroll-mt-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
        >
          <ProvenanceSandbox />
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* Section 3: Feature Bento Grid (Hive Architecture) */}
      {/* ============================================================ */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
          className="text-center max-w-2xl mx-auto mb-14 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/15 dark:bg-yellow-400/10 border border-amber-400/30 dark:border-yellow-400/30 text-xs font-bold text-amber-800 dark:text-yellow-300">
            <Hexagon className="w-3.5 h-3.5 fill-amber-400/20 dark:fill-yellow-400/20" />
            <span>Decentralized Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            System Architecture
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Engineered with EVM smart contracts, IoT brood sensors, and multimodal AI to eliminate middlemen exploitation and synthetic syrup dilution.
          </p>
        </motion.div>

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
              <span>35.1°C Optimal</span>
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
              Rural beekeepers need zero app downloads. Claude 3 Haiku processes voice notes and messages in Hindi, Telugu, Marathi, Bengali, Tamil, and English.
            </p>
            <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-white/10 flex items-center justify-between text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
              <span>WhatsApp Cloud API</span>
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

      {/* ============================================================ */}
      {/* Section 4: Consumer Honey Verification Demo */}
      {/* ============================================================ */}
      <section id="verify-demo" className="max-w-4xl mx-auto px-6 py-16 scroll-mt-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-amber-300/70 dark:border-yellow-400/35 bg-gradient-to-br from-amber-100/90 via-white to-amber-50/70 dark:from-yellow-500/10 dark:via-[#0d1017] dark:to-black p-8 sm:p-12 text-center backdrop-blur-2xl shadow-xl dark:shadow-2xl"
        >
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="w-16 h-16 rounded-2xl bg-amber-400/20 dark:bg-yellow-400/20 border border-amber-400/40 dark:border-yellow-400/40 flex items-center justify-center text-amber-600 dark:text-yellow-300 mx-auto mb-6 shadow-lg shadow-amber-500/20 dark:shadow-yellow-500/30 cursor-pointer"
          >
            <QrCode className="w-8 h-8" />
          </motion.div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Verify a Genuine Honey Jar
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-lg mx-auto mb-8">
            Experience consumer verification in real time. Enter a registered batch code or inspect our live Polygon Amoy sample batch.
          </p>

          <form action="/verify" method="GET" className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                name="b"
                value={sampleBatch}
                onChange={(e) => setSampleBatch(e.target.value)}
                placeholder="Enter Batch Code..."
                className="w-full px-4 py-3 rounded-full bg-white dark:bg-black/70 border border-amber-300/70 dark:border-yellow-400/25 text-xs sm:text-sm font-mono text-slate-900 dark:text-yellow-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 dark:focus:border-yellow-400 transition-colors shadow-inner"
                required
              />
              <input type="hidden" name="n" value="af44726f-27cd-480b-ac60-1a8576f7a6e0" />
              <input type="hidden" name="sig" value="20eeb79f8961ccf0fa998cff8abba7d41ec42d3293ead319abf30234d0db0910" />
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-black text-xs sm:text-sm font-extrabold shadow-lg shadow-yellow-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Verify Batch</span>
            </button>
          </form>

          {/* Quick Select Batch Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Quick Test Batches:</span>
            {[
              { code: 'HC-2026-MH01-000123', label: 'Wardha Multiflora (Lab Verified)' },
              { code: 'HC-2026-MH01-000101', label: 'Retail Ready Batch' },
            ].map((b) => (
              <button
                key={b.code}
                type="button"
                onClick={() => setSampleBatch(b.code)}
                className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-amber-500/10 hover:bg-amber-500/20 dark:bg-yellow-400/10 dark:hover:bg-yellow-400/20 text-amber-800 dark:text-yellow-300 border border-amber-300/40 dark:border-yellow-400/30 transition-all"
              >
                {b.code}
              </button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* Footer */}
      {/* ============================================================ */}
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
              href="https://github.com/Sonal-ai/Pollinator"
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
          <p>Powered by Next.js, Polygon Amoy, Pinata IPFS, and AWS Bedrock.</p>
        </div>
      </footer>
    </div>
  );
}
