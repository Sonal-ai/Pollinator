'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Hexagon, Menu, X, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RollButton } from './roll-button';
import { NetworkBadge } from './network-badge';
import { ThemeToggle } from './theme-toggle';

interface NavItem {
  id: string;
  label: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'how-it-works', label: 'Traceability Flow' },
  { id: 'features', label: 'Architecture' },
  { id: 'pipeline', label: 'Live Protocol', badge: '5-Stage' },
  { id: 'verify-demo', label: 'Verify Honey' },
];

interface NavbarProps {
  contractAddress?: string;
  networkName?: string;
  explorerUrl?: string | null;
  isLocal?: boolean;
}

export function Navbar({
  contractAddress,
  networkName,
  explorerUrl,
  isLocal,
}: NavbarProps) {
  const [activeSection, setActiveSection] = useState<string>('how-it-works');
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scroll position to update active nav tab and header elevation
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sectionIds = ['how-it-works', 'features', 'pipeline', 'verify-demo'];
      const scrollPosition = window.scrollY + 140;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(sectionIds[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveSection(id);
    setMobileMenuOpen(false);

    const target = document.getElementById(id);
    if (target) {
      const headerOffset = 90;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Trigger temporary glowing halo animation on the target section
      target.classList.remove('glow-target-pulse');
      void target.offsetWidth; // trigger reflow
      target.classList.add('glow-target-pulse');
      setTimeout(() => {
        target.classList.remove('glow-target-pulse');
      }, 1800);
    }
  };

  return (
    <header className="sticky top-4 z-50 max-w-7xl mx-auto px-3 sm:px-4">
      {/* Floating Pill Container */}
      <div
        className={`flex items-center justify-between px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full border transition-all duration-300 ${
          scrolled
            ? 'border-amber-400/40 dark:border-yellow-400/35 bg-white/95 dark:bg-[#0c0e14]/95 shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_45px_rgba(0,0,0,0.8)] backdrop-blur-2xl'
            : 'border-amber-300/40 dark:border-yellow-400/25 bg-white/80 dark:bg-[#0c0e14]/85 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl'
        }`}
      >
        {/* Left: Brand Identity (Strictly Single-Line) */}
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 group">
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 shadow-md shadow-yellow-500/30 group-hover:scale-105 transition-transform duration-300 shrink-0 p-1">
            <Image
              src="/logo-mark.png"
              alt="Pollinators Logo"
              width={28}
              height={28}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight group-hover:text-amber-500 dark:group-hover:text-yellow-300 transition-colors">
              Pollinators
            </span>
            <span className="hidden sm:inline-block ml-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase tracking-widest bg-yellow-400/15 text-yellow-700 dark:text-yellow-300 border border-yellow-400/30">
              HONEYCHAIN
            </span>
          </div>
        </Link>

        {/* Center: Planned Creative Navigation Capsule (Strictly Single-Line, Never Wraps) */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center p-1 rounded-full bg-amber-100/60 dark:bg-black/40 border border-amber-200/60 dark:border-white/5 backdrop-blur-xl shrink-0 mx-1 lg:mx-2"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            const isHovered = hoveredSection === item.id;

            return (
              <motion.a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleNavClick(e, item.id)}
                onMouseEnter={() => setHoveredSection(item.id)}
                onMouseLeave={() => setHoveredSection(null)}
                whileTap={{ scale: 0.94 }}
                className={`relative px-2.5 lg:px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors duration-200 select-none ${
                  isActive
                    ? 'text-black dark:text-black font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {/* Gliding Spring Background Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="navbar-active-pill"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 shadow-md shadow-yellow-500/25 -z-10"
                  />
                )}

                {/* Hover Aura when not active */}
                {!isActive && isHovered && (
                  <motion.div
                    layoutId="navbar-hover-pill"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/5 -z-10"
                  />
                )}

                <span className="relative z-10 flex items-center gap-1.5">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="hidden lg:inline-block w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-yellow-400 animate-pulse" />
                  )}
                </span>
              </motion.a>
            );
          })}
        </nav>

        {/* Right: Network, Theme Toggle, Launch CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <NetworkBadge
            contractAddress={contractAddress}
            networkName={networkName}
            explorerUrl={explorerUrl}
            isLocal={isLocal}
            className="hidden lg:inline-flex"
          />
          <ThemeToggle />
          
          <RollButton href="/dashboard" size="sm" variant="primary" className="hidden sm:inline-flex shrink-0">
            Launch Hive
          </RollButton>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full bg-amber-50 dark:bg-white/5 border border-amber-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-yellow-500 transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden mt-2 p-4 rounded-3xl border border-amber-300/50 dark:border-yellow-400/25 bg-white/95 dark:bg-[#0c0e14]/95 backdrop-blur-2xl shadow-2xl space-y-3"
          >
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleNavClick(e, item.id)}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    activeSection === item.id
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-black shadow-md'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span>{item.label}</span>
                  {activeSection === item.id && <span>✓</span>}
                </a>
              ))}
            </div>

            <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
              <NetworkBadge
                contractAddress={contractAddress}
                networkName={networkName}
                explorerUrl={explorerUrl}
                isLocal={isLocal}
              />
              <RollButton href="/dashboard" size="sm" variant="primary" className="flex-1">
                Launch Hive
              </RollButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
