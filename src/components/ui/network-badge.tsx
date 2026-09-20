'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Copy, Check, Hexagon, Fuel, ChevronDown, Wallet, FileCode2 } from 'lucide-react';

interface ChainStatus {
  network: string;
  isLocal: boolean;
  contractAddress: string | null;
  walletAddress: string | null;
  balance: string;
  balanceRaw?: string;
  contractUrl: string | null;
  walletUrl: string | null;
}

interface NetworkBadgeProps {
  contractAddress?: string;
  className?: string;
  networkName?: string;
  explorerUrl?: string | null;
  isLocal?: boolean;
}

export function NetworkBadge({
  contractAddress: initialContract = '0x4B650a3d926A8f777f96422d790B0e36eB29b47a',
  className = '',
  networkName: initialNetworkName,
  isLocal: initialIsLocal,
}: NetworkBadgeProps) {
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'contract' | 'wallet' | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/blockchain/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) {
          setStatus(data);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isLocalNetwork =
    initialIsLocal !== undefined
      ? initialIsLocal
      : status
      ? status.isLocal
      : (process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK === 'local' ||
         process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK === 'localhost');

  const label = initialNetworkName || status?.network || (isLocalNetwork ? 'Local Hive' : 'Polygon Amoy');
  const activeContract = status?.contractAddress || initialContract;
  const activeWallet = status?.walletAddress || '0x06a7E556dA2e1e7C40d0C3a19DDB6ED7cC7e4607';
  const balance = status?.balance || '0.1009 POL';

  const copyToClipboard = (text: string, type: 'contract' | 'wallet') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-all shadow-sm shrink-0 cursor-pointer select-none ${
          isLocalNetwork
            ? 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
            : 'border-purple-500/30 bg-[#161226]/85 text-purple-200 hover:bg-[#201938]'
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              isLocalNetwork ? 'bg-emerald-500' : 'bg-purple-400'
            }`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              isLocalNetwork ? 'bg-emerald-500' : 'bg-purple-400'
            }`}
          />
        </span>

        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Hexagon
            className={`h-3.5 w-3.5 shrink-0 ${
              isLocalNetwork
                ? 'text-emerald-400 fill-emerald-500/20'
                : 'text-purple-400 fill-purple-500/20'
            }`}
          />
          <span className="font-extrabold text-[11px] sm:text-xs tracking-tight">{label}</span>
        </span>

        {!isLocalNetwork && (
          <>
            <span className="hidden sm:inline-block h-3 w-px bg-white/10" />
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
              <Fuel className="h-3 w-3" />
              <span>{balance}</span>
            </span>
          </>
        )}

        <ChevronDown
          className={`h-3 w-3 opacity-60 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-purple-500/25 bg-[#0f0c1b] text-slate-200 shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-purple-500/20 text-purple-300">
                <Hexagon className="h-4 w-4 fill-purple-500/30" />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">{label}</p>
                <p className="text-[10px] text-slate-400">
                  {isLocalNetwork ? 'Chain ID: 31337' : 'Chain ID: 80002 (Testnet)'}
                </p>
              </div>
            </div>
            {!isLocalNetwork && (
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {balance}
              </span>
            )}
          </div>

          <div className="space-y-2 text-[11px]">
            {/* Smart Contract Card */}
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/30 transition-colors">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-purple-300">
                  <FileCode2 className="h-3.5 w-3.5 text-purple-400" />
                  Smart Contract
                </span>
                {!isLocalNetwork && activeContract && (
                  <a
                    href={`https://amoy.polygonscan.com/address/${activeContract}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-200 transition-colors inline-flex items-center gap-0.5 font-mono text-[10px]"
                  >
                    <span>Polygonscan</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between bg-black/30 px-2 py-1 rounded-lg font-mono text-[11px] text-slate-300">
                <span className="truncate mr-2">{activeContract ? shortAddr(activeContract) : 'Not deployed'}</span>
                {activeContract && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeContract, 'contract')}
                    className="text-slate-400 hover:text-white transition-colors shrink-0"
                    title="Copy smart contract address"
                  >
                    {copiedType === 'contract' ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Relayer / Gas Wallet Card */}
            {!isLocalNetwork && activeWallet && (
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/30 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-300">
                    <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                    Relayer / Gas Wallet
                  </span>
                  <a
                    href={`https://amoy.polygonscan.com/address/${activeWallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-200 transition-colors inline-flex items-center gap-0.5 font-mono text-[10px]"
                  >
                    <span>Polygonscan</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <div className="flex items-center justify-between bg-black/30 px-2 py-1 rounded-lg font-mono text-[11px] text-slate-300">
                  <span className="truncate mr-2">{shortAddr(activeWallet)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-emerald-400 font-bold">{balance}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeWallet, 'wallet')}
                      className="text-slate-400 hover:text-white transition-colors"
                      title="Copy relayer wallet address"
                    >
                      {copiedType === 'wallet' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/10 text-[10px] text-slate-400 leading-tight">
            💡 Gas wallet automatically pays tx fees for harvests, lab certificates, and custody handoffs.
          </div>
        </div>
      )}
    </div>
  );
}
