'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Hexagon } from 'lucide-react';

interface NetworkBadgeProps {
  contractAddress?: string;
  className?: string;
}

export function NetworkBadge({
  contractAddress = '0x4B650a3d926A8f777f96422d790B0e36eB29b47a',
  className = '',
}: NetworkBadgeProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-[#12151f]/80 px-3.5 py-1.5 text-xs font-medium text-yellow-300 backdrop-blur-md transition-all hover:border-yellow-400/60 hover:bg-[#181d2b] shadow-lg shadow-yellow-500/10 ${className}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
      </span>

      <span className="flex items-center gap-1.5 text-slate-200">
        <Hexagon className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400/20" />
        <span className="font-bold text-yellow-300">HoneyChain Amoy</span>
      </span>

      <span className="h-3 w-px bg-yellow-400/30" />

      <button
        type="button"
        onClick={copyToClipboard}
        className="group/copy flex items-center gap-1 font-mono text-slate-400 hover:text-white transition-colors"
        title="Click to copy contract address"
      >
        <span>{shortAddress}</span>
        {copied ? (
          <Check className="h-3 w-3 text-yellow-400" />
        ) : (
          <Copy className="h-3 w-3 opacity-60 group-hover/copy:opacity-100" />
        )}
      </button>

      <a
        href={`https://amoy.polygonscan.com/address/${contractAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-yellow-400/70 hover:text-yellow-300 transition-colors ml-0.5"
        title="View on Polygonscan"
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
