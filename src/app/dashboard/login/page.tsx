'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Key } from 'lucide-react';
import {safeDashboardReturn} from '@/lib/login-return';
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (response.ok) {
        router.replace(safeDashboardReturn(new URLSearchParams(window.location.search).get('next')));
        router.refresh();
      }
      else {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Sign-in failed.');
      }
    } catch { setError('Could not connect. Please try again.'); }
    finally { setLoading(false); }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <Image src="/logo-mark.png" alt="Pollinator" width={56} height={56} className="mx-auto brand-mark" priority />
          <h1 className="text-3xl font-extrabold">Pollinator Portal</h1>
          <p className="text-sm text-[var(--text-muted)]">Sign in to your supply chain account.</p>
        </div>
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-8 space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold mb-2">Email or phone number</label>
              <input id="identifier" name="username" autoComplete="username" type="text" required maxLength={254}
                value={identifier} onChange={(event) => setIdentifier(event.target.value)}
                placeholder="name@company.com or +919876543210"
                className="w-full rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] px-4 py-3 text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold mb-2">Password</label>
              <input id="password" name="password" autoComplete="current-password" type="password" required maxLength={1024}
                value={password} onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] px-4 py-3 text-sm focus:outline-none focus:border-amber-400" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-black disabled:opacity-50">
              <Key className="h-4 w-4" /> {loading ? 'Signing in…' : 'Sign in'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Your administrator provides your account and permissions. Contact them for access or a password reset.
            Phone-number accounts also require a password.
          </p>
          <Link href="/" className="block text-center text-sm text-[var(--accent-ink)]">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
