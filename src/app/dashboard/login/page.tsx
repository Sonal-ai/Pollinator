'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = [
  { value: 'admin',       label: '🔑 Admin — Full access' },
  { value: 'processor',   label: '🏭 Processor — Packaging & Serialization' },
  { value: 'lab',         label: '🧪 QA Lab — Certificate upload' },
  { value: 'distributor', label: '🚚 Distributor — Custody transfer' },
  { value: 'retailer',    label: '🏪 Retailer — Batch lookup' },
  { value: 'beekeeper',   label: '🐝 Beekeeper — IoT & harvests' },
];

export default function LoginPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState('');
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid Ethereum wallet address (0x...)');
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
        setError(data.error ?? 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-white text-center">
            <div className="text-4xl mb-2">🐝</div>
            <h1 className="text-xl font-bold">Pollinator Dashboard</h1>
            <p className="text-amber-100 text-sm mt-1">Supply Chain Portal</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="px-8 py-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Wallet Address
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Your Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Prototype: role is self-selected. Production requires wallet signature verification.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition text-sm"
            >
              {loading ? 'Signing in...' : 'Access Dashboard →'}
            </button>
          </form>

          <div className="px-8 pb-6 text-center">
            <a href="/" className="text-sm text-gray-400 hover:text-gray-600">
              ← Back to home
            </a>
          </div>
        </div>

        {/* Note */}
        <p className="text-center text-xs text-gray-400 mt-4">
          For consumer honey verification, scan the QR code on your jar.
        </p>
      </div>
    </div>
  );
}
