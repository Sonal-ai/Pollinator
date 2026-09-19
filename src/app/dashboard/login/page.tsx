'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Hexagon, ShieldCheck, ArrowRight, Zap, Key } from 'lucide-react';

const ROLES = [
  { value: 'admin',       label: '🔑 Admin — Full platform & recall control' },
  { value: 'processor',   label: '🏭 Processor — Packaging & serialization' },
  { value: 'lab',         label: '🧪 QA Lab — Certificate hashing & signing' },
  { value: 'distributor', label: '🚚 Distributor — Custody handoffs' },
  { value: 'retailer',    label: '🏪 Retailer — Shelf batch audits' },
  { value: 'beekeeper',   label: '🐝 Beekeeper — IoT telemetry & harvest logs' },
];

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isPhone = /^\+?[0-9\s-]{7,15}$/.test(identifier.trim());

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isPhone) {
      if (!identifier.includes('@')) {
        setError('Please enter a valid email address or phone number');
        return;
      }
      
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: identifier,
          identifier,
          password: isPhone ? undefined : password,
          role: isPhone ? 'beekeeper' : role,
        }),
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 shadow-xl shadow-yellow-500/25 mb-2 p-2">
            <Image
              src="/logo-mark.png"
              alt="Pollinators Logo"
              width={48}
              height={48}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pollinators Portal
          </h1>
          <p className="text-xs text-slate-400">
            Supply Chain Actor Authentication · Polygon Amoy
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-[#0d111a]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Quick 1-Click Demo Persona Switcher */}
          <div className="space-y-2 pb-4 border-b border-white/10">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
              ⚡ 1-Click Demo Personas:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIdentifier('8882218036');
                  setRole('beekeeper');
                  setPassword('');
                }}
                className="px-2.5 py-1 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-[11px] font-mono text-yellow-300 transition-all active:scale-95"
              >
                🐝 Beekeeper (Sonal)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('transporter@pollinator.com');
                  setRole('distributor');
                  setPassword('Pollinator@2026');
                }}
                className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-[11px] font-mono text-orange-300 transition-all active:scale-95"
              >
                🚚 Transporter
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('lab@pollinator.com');
                  setRole('lab');
                  setPassword('Pollinator@2026');
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 transition-all active:scale-95"
              >
                🧪 QA Lab
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('processor@pollinator.com');
                  setRole('processor');
                  setPassword('Pollinator@2026');
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-[11px] font-mono text-purple-300 transition-all active:scale-95"
              >
                🏭 Processor
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('admin@pollinator.com');
                  setRole('admin');
                  setPassword('Pollinator@2026');
                }}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 transition-all active:scale-95"
              >
                🔑 Admin
              </button>
            </div>
          </div>

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

            {/* Identifier input (Email or WhatsApp Phone) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase font-mono tracking-wider">
                Email Address or WhatsApp Phone
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@company.com or +919876543210"
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
                required
              />
              {isPhone && (
                <p className="text-[11px] text-emerald-400 mt-1.5 font-sans flex items-center gap-1.5">
                  <span>📱</span> WhatsApp Beekeeper detected: Instant passwordless login.
                </p>
              )}
            </div>

            {/* Password input (hidden for phone logins) */}
            {!isPhone && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase font-mono tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-xs text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
                  required={!isPhone}
                />
                <p className="text-[10px] text-slate-500 mt-1.5 font-sans">
                  Web2 Abstraction Mode: Your EVM wallet is automatically generated and secured by the server.
                </p>
              </div>
            )}

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
