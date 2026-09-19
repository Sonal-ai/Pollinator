'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Hexagon } from 'lucide-react';

interface NetworkBadgeProps {
  contractAddress?: string;
  className?: string;
  networkName?: string;
  explorerUrl?: string | null;
  isLocal?: boolean;
}

export function NetworkBadge({
  contractAddress = '0x4B650a3d926A8f777f96422d790B0e36eB29b47a',
  className = '',
  networkName,
  explorerUrl,
  isLocal,
}: NetworkBadgeProps) {
  const [copied, setCopied] = useState(false);

  const isLocalNetwork =
    isLocal !== undefined
      ? isLocal
      : (process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK === 'local' ||
         process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK === 'localhost');

  const label = networkName || (isLocalNetwork ? 'Local Hive' : 'HoneyChain Amoy');
  const targetExplorerUrl =
    explorerUrl !== undefined
      ? explorerUrl
      : isLocalNetwork
      ? null
      : `https://amoy.polygonscan.com/address/${contractAddress}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-amber-300/60 dark:border-yellow-400/25 bg-amber-50/90 dark:bg-[#12151f]/85 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-yellow-300 backdrop-blur-md transition-all shadow-sm shrink-0 ${className}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
            isLocalNetwork ? 'bg-emerald-500' : 'bg-yellow-400'
          }`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            isLocalNetwork ? 'bg-emerald-500' : 'bg-yellow-400'
          }`}
        />
      </span>

      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Hexagon
          className={`h-3.5 w-3.5 shrink-0 ${
            isLocalNetwork ? 'text-emerald-500 fill-emerald-500/20' : 'text-yellow-500 dark:text-yellow-400 fill-yellow-400/20'
          }`}
        />
        <span className="font-extrabold text-[11px] sm:text-xs">{label}</span>
      </span>

      <span className="hidden xl:inline-block h-3 w-px bg-amber-200 dark:bg-yellow-400/25" />

      <button
        type="button"
        onClick={copyToClipboard}
        className="hidden xl:inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        title="Click to copy contract address"
      >
        <span>{shortAddress}</span>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500 dark:text-yellow-400" />
        ) : (
          <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />
        )}
      </button>

      {targetExplorerUrl && (
        <a
          href={targetExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 dark:text-yellow-400/80 hover:text-amber-700 dark:hover:text-yellow-300 transition-colors ml-0.5 shrink-0"
          title="View on Explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
