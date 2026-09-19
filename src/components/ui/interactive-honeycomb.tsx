'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useTheme } from '@/components/theme-provider';

export function InteractiveHoneycomb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Mouse coordinates with spring physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 24, stiffness: 120 };
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [15, -15]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], [-15, 15]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setHoveredCell(null);
  };

  // Honeycomb hexagon coordinates (7 cells: center + 6 surrounding)
  const hexRadius = 66;
  const hexWidth = Math.sqrt(3) * hexRadius; // ~114.3
  const hexHeight = 2 * hexRadius; // 132
  const vertSpacing = hexHeight * 0.75; // 99

  const cells = [
    { id: 0, x: 250, y: 220, label: 'Hive Node', sub: 'ESP32 Telemetry', icon: '🐝', glow: '#ffd21e' },
    { id: 1, x: 250 + hexWidth, y: 220, label: 'HoneyChain', sub: 'Polygon Amoy', icon: '⛓️', glow: '#ffd21e' },
    { id: 2, x: 250 - hexWidth, y: 220, label: 'Forager Bot', sub: 'WhatsApp AI', icon: '📱', glow: '#25d366' },
    { id: 3, x: 250 + hexWidth / 2, y: 220 - vertSpacing, label: 'Nectar Lab', sub: 'IPFS SHA-256', icon: '🧪', glow: '#ffe566' },
    { id: 4, x: 250 - hexWidth / 2, y: 220 - vertSpacing, label: 'Hive Custody', sub: 'Queen RBAC', icon: '👑', glow: '#ffb800' },
    { id: 5, x: 250 + hexWidth / 2, y: 220 + vertSpacing, label: 'Tamper Seal', sub: 'HMAC Nonce', icon: '🛡️', glow: '#ffd21e' },
    { id: 6, x: 250 - hexWidth / 2, y: 220 + vertSpacing, label: 'Pure Nectar', sub: '100% Genuine', icon: '🍯', glow: '#ffea75' },
  ];

  const getHexPoints = (cx: number, cy: number, r: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center w-full max-w-[550px] aspect-square mx-auto select-none perspective-[1200px]"
    >
      {/* Radiant Beehive Yellow Background Glow */}
      <div className={`absolute inset-4 rounded-full pointer-events-none animate-hive-pulse ${
        isDark
          ? 'bg-gradient-to-tr from-yellow-500/25 via-amber-400/20 to-transparent blur-[90px]'
          : 'bg-gradient-to-tr from-amber-400/30 via-yellow-300/20 to-transparent blur-[85px]'
      }`} />

      {/* 3D Motion Canvas */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="relative w-full h-full flex items-center justify-center"
      >
        <svg
          viewBox="0 0 500 440"
          className={`w-full h-full overflow-visible ${
            isDark
              ? 'drop-shadow-[0_20px_60px_rgba(255,210,30,0.3)]'
              : 'drop-shadow-[0_16px_35px_rgba(217,119,6,0.18)]'
          }`}
        >
          <defs>
            {/* Dark Mode Standard Cell Gradient */}
            <linearGradient id="beehiveCellDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd21e" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#ffb800" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0c0e14" stopOpacity="0.88" />
            </linearGradient>

            {/* Dark Mode Active Highlighted Cell Gradient */}
            <linearGradient id="activeBeehiveCellDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff176" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#ffd21e" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ff9800" stopOpacity="0.4" />
            </linearGradient>

            {/* Light Mode Standard Cell Gradient (Creamy Warm Ivory Honey) */}
            <linearGradient id="beehiveCellLight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#fde047" stopOpacity="0.85" />
            </linearGradient>

            {/* Light Mode Active Highlighted Cell Gradient (Electric Honey Amber) */}
            <linearGradient id="activeBeehiveCellLight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd21e" stopOpacity="1" />
              <stop offset="50%" stopColor="#ffb800" stopOpacity="1" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
            </linearGradient>

            <filter id="beeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Golden Nectar Data Highways Linking Cells */}
          <g
            stroke={isDark ? '#ffd21e' : '#d97706'}
            strokeWidth={isDark ? '1.5' : '1.8'}
            strokeDasharray="3 3"
            opacity={isDark ? 0.35 : 0.5}
            className="animate-pulse"
          >
            <line x1="250" y1="220" x2={250 + hexWidth} y2="220" />
            <line x1="250" y1="220" x2={250 - hexWidth} y2="220" />
            <line x1="250" y1="220" x2={250 + hexWidth / 2} y2={220 - vertSpacing} />
            <line x1="250" y1="220" x2={250 - hexWidth / 2} y2={220 - vertSpacing} />
            <line x1="250" y1="220" x2={250 + hexWidth / 2} y2={220 + vertSpacing} />
            <line x1="250" y1="220" x2={250 - hexWidth / 2} y2={220 + vertSpacing} />
          </g>

          {/* Hexagonal Cells */}
          {cells.map((c) => {
            const isHovered = hoveredCell === c.id;
            return (
              <g
                key={c.id}
                onMouseEnter={() => setHoveredCell(c.id)}
                onMouseLeave={() => setHoveredCell(null)}
                className="cursor-pointer transition-transform duration-300"
                style={{
                  transformOrigin: `${c.x}px ${c.y}px`,
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {/* Hexagon Outer Cell */}
                <polygon
                  points={getHexPoints(c.x, c.y, hexRadius - 3)}
                  fill={
                    isDark
                      ? (isHovered ? 'url(#activeBeehiveCellDark)' : 'url(#beehiveCellDark)')
                      : (isHovered ? 'url(#activeBeehiveCellLight)' : 'url(#beehiveCellLight)')
                  }
                  stroke={
                    isDark
                      ? (isHovered ? '#ffd21e' : 'rgba(255, 210, 30, 0.28)')
                      : (isHovered ? '#b45309' : 'rgba(217, 119, 6, 0.45)')
                  }
                  strokeWidth={isHovered ? 2.5 : 1.4}
                  filter={isHovered ? 'url(#beeGlow)' : undefined}
                  className="transition-all duration-300"
                />

                {/* Inner Hexagon Bevel / Honeycomb Rim */}
                <polygon
                  points={getHexPoints(c.x, c.y, hexRadius - 9)}
                  fill="none"
                  stroke={
                    isDark
                      ? (isHovered ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 210, 30, 0.12)')
                      : (isHovered ? 'rgba(180, 83, 9, 0.35)' : 'rgba(217, 119, 6, 0.2)')
                  }
                  strokeWidth="1"
                />

                {/* Hexagon Content */}
                {c.id === 2 ? (
                  <g transform={`translate(${c.x - 13}, ${c.y - 32})`} className="select-none pointer-events-none">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </g>
                ) : (
                  <text
                    x={c.x}
                    y={c.y - 12}
                    textAnchor="middle"
                    className="text-2xl select-none pointer-events-none"
                  >
                    {c.icon}
                  </text>
                )}
                <text
                  x={c.x}
                  y={c.y + 13}
                  textAnchor="middle"
                  fill={isHovered ? '#000000' : (c.id === 2 ? (isDark ? '#34d399' : '#059669') : (isDark ? '#ffffff' : '#0f172a'))}
                  className="text-[12px] font-extrabold font-sans select-none pointer-events-none tracking-tight"
                >
                  {c.label}
                </text>
                <text
                  x={c.x}
                  y={c.y + 26}
                  textAnchor="middle"
                  fill={isHovered ? (isDark ? '#1a1a1a' : '#451a03') : (c.id === 2 ? (isDark ? '#10b981' : '#047857') : (isDark ? '#ffd21e' : '#92400e'))}
                  className="text-[9px] font-bold font-mono select-none pointer-events-none"
                >
                  {c.sub}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Blockchain Bee Status Pill */}
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="absolute -bottom-4 bg-white/95 dark:bg-[#0c0e14]/90 backdrop-blur-2xl border-2 border-amber-300/80 dark:border-yellow-400/40 px-4 py-2 rounded-full flex items-center gap-2.5 shadow-xl shadow-amber-500/15 dark:shadow-yellow-500/20"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-yellow-400 animate-ping" />
          <span className="text-xs font-mono text-slate-800 dark:text-slate-200 font-semibold">
            Hive Consensus: <span className="text-amber-700 dark:text-yellow-400 font-extrabold">HoneyChain Amoy</span>
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
