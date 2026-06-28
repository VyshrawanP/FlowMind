'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, resendOtp } from '@/lib/api';
import { FolderKanban, Lock, Mail, ArrowRight, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError('');
    setUnverified(false);

    try {
      const response = await login(email, password);
      // Store JWT token & User details
      localStorage.setItem('flowmind_token', response.token);
      localStorage.setItem('flowmind_user', JSON.stringify(response.user));
      
      router.push('/');
    } catch (err: any) {
      console.error(err);
      if (err.status === 403) {
        // Account unverified, redirect to OTP page
        setUnverified(true);
        setError(err.message || 'Account is unverified. Please verify via OTP.');
      } else {
        setError(err.message || 'Invalid email address or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      await resendOtp(email);
      // Redirect to OTP verification page
      localStorage.setItem('flowmind_verify_email', email);
      router.push('/verify-otp');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 overflow-hidden">
      {/* Dynamic Background glow graphics */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-purple-600/10 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-900 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-md glow-indigo">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30 mb-3">
            <FolderKanban className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400">
            FlowMind Sign In
          </h1>
          <p className="text-zinc-400 text-xs mt-2 text-center">
            Log in to manage real-time synchronized workspaces
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-950/40 border border-red-900 text-red-300 rounded-lg flex items-start gap-2 animate-shake">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              <div>
                <span>{error}</span>
                {unverified && (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="block text-indigo-400 hover:text-indigo-300 font-bold mt-1.5 underline cursor-pointer"
                  >
                    Verify account now & resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">EMAIL ADDRESS</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-zinc-950/80 border border-zinc-800/80 pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">PASSWORD</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-zinc-950/80 border border-zinc-800/80 pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {isLoading ? 'Processing...' : 'Sign In'} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-zinc-400">
          Don't have an account?{' '}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-bold underline">
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
