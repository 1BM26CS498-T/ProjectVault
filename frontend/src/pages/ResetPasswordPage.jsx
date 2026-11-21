import { useState } from 'react';
import { authClient, isNeonAuthConfigured } from '../lib/neonAuth.js';

export default function ResetPasswordPage({ navigate }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const hashQuery = window.location.hash.split('?')[1] || '';
  const resetToken = new URLSearchParams(window.location.search).get('token')
    || new URLSearchParams(hashQuery).get('token');
  const token = resetToken;

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
    if (!token) {
      setError('This link is invalid or expired. Request a new email and try again.');
      return;
    }

    setBusy(true);
    try {
      if (!isNeonAuthConfigured) throw new Error('Neon Auth is not configured.');
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw result.error;

      setMessage('Your password has been updated. You can now sign in with your new password.');
      window.history.replaceState({}, document.title, window.location.pathname);
      window.setTimeout(() => navigate('login'), 1200);
    } catch (err) {
      setError(err.message || 'Unable to update your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">Reset Password</h1>
      <p className="mt-2 text-slate-600">Choose a password with at least 8 characters.</p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      {!token && !error && (
        <p role="alert" className="mt-4 rounded-lg bg-peach-50 p-3 text-sm text-peach-800">
          This link is missing its reset token. Request another password reset email.
        </p>
      )}

      {token && !message && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-new-password" className="mb-1 block text-sm font-medium">New password</label>
            <input id="reset-new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3" />
          </div>
          <div>
            <label htmlFor="reset-confirm-password" className="mb-1 block text-sm font-medium">Confirm new password</label>
            <input id="reset-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3" />
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
