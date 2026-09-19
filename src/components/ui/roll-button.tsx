'use client';

import React from 'react';
import Link from 'next/link';

interface RollButtonProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
  target?: string;
  rel?: string;
}

export function RollButton({
  href,
  onClick,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  target,
  rel,
}: RollButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-xs font-bold',
    md: 'px-6 py-3 text-xs sm:text-sm font-bold',
    lg: 'px-8 py-4 text-sm sm:text-base font-extrabold',
  }[size];

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-black shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/45 border border-yellow-300/80 hover:scale-[1.02]',
    secondary:
      'bg-[#12151f]/90 hover:bg-[#181d2b] text-slate-100 border border-yellow-400/20 hover:border-yellow-400/50 backdrop-blur-md hover:text-yellow-400',
    outline:
      'bg-transparent hover:bg-yellow-400/10 text-yellow-400 border border-yellow-400/40 hover:border-yellow-300',
    ghost:
      'bg-transparent hover:bg-white/5 text-slate-300 hover:text-yellow-400 border-transparent',
  }[variant];

  const content = (
    <span className="relative inline-flex items-center justify-center gap-2 overflow-hidden">
      {icon && <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">{icon}</span>}
      <span className="relative block overflow-hidden leading-tight">
        {/* Layer 1: Normal text rolling up */}
        <span className="block transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full">
          {children}
        </span>
        {/* Layer 2: Hover text rolling in */}
        <span className="absolute inset-0 block translate-y-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
          {children}
        </span>
      </span>
    </span>
  );

  const baseClasses = `group relative inline-flex items-center justify-center rounded-full tracking-wide transition-all duration-300 active:scale-95 ${sizeClasses} ${variantClasses} ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClasses} target={target} rel={rel}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClasses}>
      {content}
    </button>
  );
}
