'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export function InteractiveHoneycomb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

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
    { id: 2, x: 250 - hexWidth, y: 220, label: 'Forager Bot', sub: 'Bedrock Claude', icon: '📱', glow: '#ffb800' },
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
      <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-yellow-500/25 via-amber-400/20 to-transparent blur-[90px] pointer-events-none animate-hive-pulse" />

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
          className="w-full h-full drop-shadow-[0_20px_60px_rgba(255,210,30,0.3)] overflow-visible"
        >
          <defs>
            {/* Standard Cell Gradient */}
            <linearGradient id="beehiveCell" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd21e" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#ffb800" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0c0e14" stopOpacity="0.85" />
            </linearGradient>

            {/* Active Highlighted Cell Gradient */}
            <linearGradient id="activeBeehiveCell" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff176" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#ffd21e" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ff9800" stopOpacity="0.4" />
            </linearGradient>

            {/* Gold Wireframe Pattern */}
            <pattern id="hexWire" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 0 0 L 8 8 M 8 0 L 0 8" fill="none" stroke="rgba(255,210,30,0.08)" strokeWidth="0.5" />
            </pattern>

            <filter id="beeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Golden Nectar Data Highways Linking Cells */}
          <g stroke="#ffd21e" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.35" className="animate-pulse">
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
                  fill={isHovered ? 'url(#activeBeehiveCell)' : 'url(#beehiveCell)'}
                  stroke={isHovered ? '#ffd21e' : 'rgba(255, 210, 30, 0.28)'}
                  strokeWidth={isHovered ? 2.5 : 1.2}
                  filter={isHovered ? 'url(#beeGlow)' : undefined}
                  className="transition-all duration-300"
                />

                {/* Inner Hexagon Bevel / Honeycomb Rim */}
                <polygon
                  points={getHexPoints(c.x, c.y, hexRadius - 9)}
                  fill="none"
                  stroke={isHovered ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 210, 30, 0.12)'}
                  strokeWidth="1"
                />

                {/* Hexagon Content */}
                <text
                  x={c.x}
                  y={c.y - 12}
                  textAnchor="middle"
                  className="text-2xl select-none pointer-events-none"
                >
                  {c.icon}
                </text>
                <text
                  x={c.x}
                  y={c.y + 13}
                  textAnchor="middle"
                  fill={isHovered ? '#000000' : '#ffffff'}
                  className="text-[12px] font-extrabold font-sans select-none pointer-events-none tracking-tight"
                >
                  {c.label}
                </text>
                <text
                  x={c.x}
                  y={c.y + 26}
                  textAnchor="middle"
                  fill={isHovered ? '#262626' : '#ffd21e'}
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
          className="absolute -bottom-4 bg-white/95 dark:bg-[#0c0e14]/90 backdrop-blur-2xl border border-amber-300/60 dark:border-yellow-400/40 px-4 py-2 rounded-full flex items-center gap-2.5 shadow-xl shadow-amber-500/10 dark:shadow-yellow-500/20"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-yellow-400 animate-ping" />
          <span className="text-xs font-mono text-slate-800 dark:text-slate-200">
            Hive Consensus: <span className="text-amber-600 dark:text-yellow-400 font-extrabold">HoneyChain Amoy</span>
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
