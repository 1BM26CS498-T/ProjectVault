import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function ResetPasswordPage({ navigate }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (data?.session) {
        setReady(true);
      } else if (sessionError) {
        setError(sessionError.message);
      }
    });

    const timer = window.setTimeout(() => {
      if (active && !window.location.hash.includes('type=recovery')) {
        setError('This recovery link may be expired or invalid. Request a new password reset email.');
      }
    }, 2500);

    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        throw new Error('Your recovery session has expired. Request a new reset email.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('Your password has been updated. You can now sign in with your new password.');
      await supabase.auth.signOut();
      window.history.replaceState({}, document.title, window.location.pathname);
      window.setTimeout(() => navigate('login'), 1200);
    } catch (err) {
      setError(err.message || 'Unable to reset your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">Reset Password</h1>
      <p className="mt-2 text-slate-600">Choose a new password for your ProjectVault account.</p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      {!ready && !error && (
        <p className="mt-4 text-sm text-slate-600">Checking your recovery link...</p>
      )}

      {ready && !message && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-new-password" className="mb-1 block text-sm font-medium">New password</label>
            <input id="reset-new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3" />
          </div>
          <div>
            <label htmlFor="reset-confirm-password" className="mb-1 block text-sm font-medium">Confirm new password</label>
            <input id="reset-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3" />
          </div>
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {busy ? 'Updating password...' : 'Update Password'}
          </button>
        </form>
      )}

      <button onClick={() => navigate('login')} className="mt-5 text-sm font-semibold text-violet-700 underline">
        Back to login
      </button>
    </section>
  );
}
