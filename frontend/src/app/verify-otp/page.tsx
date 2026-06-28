'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { verifyOtp, resendOtp } from '@/lib/api';
import { FolderKanban, ShieldCheck, ArrowRight, ShieldAlert, RefreshCw } from 'lucide-react';

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('flowmind_verify_email');
      if (!storedEmail) {
        router.push('/login');
      } else {
        setEmail(storedEmail);
      }
    }
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otpCode) return;
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await verifyOtp(email, otpCode);
      
      // Store JWT token and user
      localStorage.setItem('flowmind_token', response.token);
      localStorage.setItem('flowmind_user', JSON.stringify(response.user));
      
      // Cleanup temp email
      localStorage.removeItem('flowmind_verify_email');
      
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await resendOtp(email);
      setMessage(response.message || 'A new verification code has been generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 overflow-hidden">
      {/* Background glow graphics */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-purple-600/10 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-900 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-md glow-indigo">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30 mb-3">
            <FolderKanban className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400">
            Verify OTP
          </h1>
          <p className="text-zinc-400 text-xs mt-2 text-center">
            A 6-digit verification code was sent to <strong className="text-indigo-400">{email}</strong>. Check your console logs.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-950/40 border border-red-900 text-red-300 rounded-lg flex items-center gap-2 animate-shake">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="p-3 text-xs bg-emerald-950/40 border border-emerald-900 text-emerald-300 rounded-lg flex items-center gap-2 animate-fade-in">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{message}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider text-center">Verification Code</label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-xl tracking-[0.5em] rounded-lg bg-zinc-950/80 border border-zinc-800/80 py-3 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otpCode.length < 6}
            className="w-full mt-6 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-zinc-400 flex flex-col gap-2">
          <span>Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:underline mx-auto"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} /> Resend OTP Code
          </button>
        </div>
      </div>
    </main>
  );
}
