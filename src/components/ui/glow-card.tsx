'use client';

import React, { useRef, useState } from 'react';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'yellow' | 'gold' | 'amber' | 'emerald' | 'cyan' | 'purple';
  onClick?: () => void;
}

export function GlowCard({
  children,
  className = '',
  glowColor = 'yellow',
  onClick,
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  const glowRGB = {
    yellow: '255, 210, 30',
    gold: '255, 184, 0',
    amber: '245, 158, 11',
    emerald: '16, 185, 129',
    cyan: '56, 189, 248',
    purple: '168, 85, 247',
  }[glowColor];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePos({ x: -1000, y: -1000 });
      }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl border border-yellow-400/15 bg-[#0d1017]/85 backdrop-blur-2xl transition-all duration-300 hover:border-yellow-400/40 hover:shadow-[0_15px_50px_-10px_rgba(255,210,30,0.18)] ${className}`}
    >
      {/* Radial Beehive Yellow Spotlight following cursor */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(450px circle at ${mousePos.x}px ${mousePos.y}px, rgba(${glowRGB}, 0.18), transparent 80%)`,
        }}
      />

      {/* Honeycomb border highlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(280px circle at ${mousePos.x}px ${mousePos.y}px, rgba(${glowRGB}, 0.6), transparent 70%)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px',
        }}
      />

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
