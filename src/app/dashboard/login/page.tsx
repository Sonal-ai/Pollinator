'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Hexagon, ShieldCheck, ArrowRight, Zap, Key } from 'lucide-react';

const ROLES = [
  { value: 'admin',       label: '🔑 Admin — Full platform & recall control' },
  { value: 'processor',   label: '🏭 Processor — Packaging & serialization' },
  { value: 'lab',         label: '🧪 QA Lab — Certificate hashing & signing' },
  { value: 'distributor', label: '🚚 Distributor — Custody handoffs' },
  { value: 'retailer',    label: '🏪 Retailer — Shelf batch audits' },
  { value: 'beekeeper',   label: '🐝 Beekeeper — IoT telemetry & harvest logs' },
];

const PRESET_WALLETS: Record<string, string> = {
  admin: '0x06a7E556dA2e1e7C40d0C3a19DDB6ED7cC7e4607',
  processor: '0x4B650a3d926A8f777f96422d790B0e36eB29b47a',
  lab: '0x321aB0e36eB29b47a98210DDB6ED7cC7e4607',
  distributor: '0x8872b0e36eB29b47a98210DDB6ED7cC7e4607',
  retailer: '0x5511b0e36eB29b47a98210DDB6ED7cC7e4607',
  beekeeper: '0x9922b0e36eB29b47a98210DDB6ED7cC7e4607',
};

export default function LoginPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState(PRESET_WALLETS.admin);
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (PRESET_WALLETS[newRole]) {
      setWalletAddress(PRESET_WALLETS[newRole]);
    }
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid EVM wallet address (0x...)');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, role }),
      });

      if (response.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Authentication failed');
      }
    } catch {
      setError('Network communication failed. Please check connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07090e] text-slate-100 p-6 relative overflow-hidden">
      {/* Ambient glowing backdrop */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[150px] pointer-events-none -z-10" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-500/30 mb-2">
            <Hexagon className="w-7 h-7 fill-white/20" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pollinator Portal
          </h1>
          <p className="text-xs text-slate-400">
            Supply Chain Actor Authentication · Polygon Amoy
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-[#0d111a]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Role selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase font-mono tracking-wider">
                Select Network Role
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value} className="bg-[#0d111a] text-white">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Wallet Address input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider">
                  Wallet Address
                </label>
                <button
                  type="button"
                  onClick={() => handleRoleChange(role)}
                  className="text-[10px] font-mono text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Zap className="w-2.5 h-2.5" /> Set Demo Wallet
                </button>
              </div>

              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1.5 font-sans">
                Prototype mode: Role is self-asserted for immediate evaluation.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Connecting to Ledger...'
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Connect to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-white/10 text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
            >
              ← Back to Public Gateway
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
