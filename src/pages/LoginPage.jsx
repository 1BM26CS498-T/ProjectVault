import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage({ navigate }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured. Check your .env.local file.');
      return;
    }

    setBusy(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) throw loginError;
      navigate('dashboard');
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    setError('');
    setNotice('');

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured. Check your .env.local file.');
      return;
    }

    if (!email.trim()) {
      setError('Enter your account email address first.');
      return;
    }

    setResetBusy(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: window.location.origin,
        }
      );

      if (resetError) throw resetError;

      setNotice(
        'If this email belongs to an account, a password recovery email will be sent if email delivery is configured. Check your inbox and spam folder.'
      );
    } catch (err) {
      setError(err.message || 'Unable to request password recovery.');
    } finally {
      setResetBusy(false);
    }
  }

  if (user) {
    return (
      <section className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">You are signed in</h1>
        <p className="mt-2 text-slate-600">
          Account: {user.full_name || user.name || user.email}
        </p>
        <button
          onClick={() => navigate('dashboard')}
          className="mt-6 w-full rounded-lg bg-vio px-4 py-3 font-semibold text-white"
        >
          Go to dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-2 text-slate-600">
        Sign in to continue to ProjectVault.
      </p>

      {!isSupabaseConfigured && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Supabase is not configured. Check your local environment settings.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-violet-500"
            placeholder="you@college.edu"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-violet-500"
            placeholder="Enter your password"
          />
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetBusy || busy || !isSupabaseConfigured}
            className="text-sm font-semibold text-violet-700 underline disabled:opacity-60"
          >
            {resetBusy ? 'Sending request...' : 'Forgot password?'}
          </button>
        </div>

        <button
          type="submit"
          disabled={busy || resetBusy || !isSupabaseConfigured}
          className="w-full rounded-lg bg-vio px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New to ProjectVault?{' '}
        <button onClick={() => navigate('register')} className="font-semibold text-violet-700">
          Create a student account
        </button>
      </p>
    </section>
  );
}

