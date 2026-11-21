import { useState } from 'react';
import { supabase, isApiConfigured } from '../lib/supabase.js';
import { authClient, isNeonAuthConfigured } from '../lib/neonAuth.js';
import { useAuth } from '../context/AuthContext.jsx';

const roleLabels = {
  student: 'student',
  faculty: 'faculty',
  admin: 'administrator',
};

const dashboardForRole = {
  student: 'student-dashboard',
  faculty: 'faculty-dashboard',
  admin: 'admin-dashboard',
};

export default function LoginPage({ navigate, intendedRole }) {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const intendedRoleName = roleLabels[intendedRole] || intendedRole || '';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isApiConfigured || !supabase || !isNeonAuthConfigured) {
      setError('ProjectVault needs both its API and Neon Auth configuration. Check your local environment settings.');
      return;
    }

    setBusy(true);

    try {
      const loginResult = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (loginResult.error) throw loginResult.error;

      const { data: profile, error: profileError } = await supabase.auth.getProjectVaultProfile();

      if (profileError) throw profileError;
      if (!profile || !['student', 'faculty', 'admin'].includes(profile.role)) {
        throw new Error('Your account does not have a ProjectVault role yet. Ask your administrator to finish setting it up.');
      }

      if (intendedRole && profile.role !== intendedRole) {
        setNotice(`Your verified account role is ${roleLabels[profile.role] || profile.role}; opening the correct workspace.`);
      }

      setUser({
        ...profile,
        name: profile.full_name,
        full_name: profile.full_name,
        collegeId: profile.college_id,
        email: profile.email,
      });
      navigate(profile.status === 'Pending'
        ? 'pending-approval'
        : dashboardForRole[profile.role] || 'landing');
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    setError('');
    setNotice('');

    if (!isNeonAuthConfigured) {
      setError('Neon Auth is not configured. Set VITE_NEON_AUTH_URL in the frontend environment.');
      return;
    }

    if (!email.trim()) {
      setError('Enter your account email address first.');
      return;
    }

    setResetBusy(true);

    try {
      const resetResult = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/#/reset-password`,
      });
      if (resetResult.error) throw resetResult.error;

      setNotice(
        'If this email belongs to an account, a password recovery email will be sent if email delivery is configured. Check your inbox and spam folder.'
      );
    } catch (err) {
      setError(err.message || 'Unable to request password recovery.');
    } finally {
      setResetBusy(false);
    }
  }

  async function handleVerifyEmail(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isNeonAuthConfigured) {
      setError('Neon Auth is not configured. Check your local environment settings.');
      return;
    }

    setVerificationBusy(true);

    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: email.trim().toLowerCase(),
        otp: verificationCode.trim(),
      });
      if (result.error) throw result.error;

      setVerificationCode('');
      setShowVerification(false);
      setNotice('Email verified. Sign in to continue to your ProjectVault workspace.');
    } catch (err) {
      setError(err.message || 'Unable to verify your email. Check the code and try again.');
    } finally {
      setVerificationBusy(false);
    }
  }

  async function handleResendVerificationCode() {
    setError('');
    setNotice('');

    if (!isNeonAuthConfigured) {
      setError('Neon Auth is not configured. Check your local environment settings.');
      return;
    }

    if (!email.trim()) {
      setError('Enter your account email address first.');
      return;
    }

    setResendBusy(true);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: 'email-verification',
      });
      if (result.error) throw result.error;

      setNotice('A new verification code was requested. Check your inbox and spam folder.');
    } catch (err) {
      setError(err.message || 'Unable to send a new verification code.');
    } finally {
      setResendBusy(false);
    }
  }

  if (user) {
    return (
      <section className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">You are signed in</h1>
        <p className="mt-2 text-slate-600">
          Account: {user.full_name || user.name || user.email}
        </p>
        {intendedRole && user.role !== intendedRole && (
          <p role="status" className="mt-3 rounded-xl bg-peach-50 p-3 text-sm text-peach-800">
            This sign-in is for {roleLabels[intendedRole] || intendedRole} access. Your account is {roleLabels[user.role] || user.role}; use its dashboard to continue.
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 rounded-xl bg-peach-50 p-3 text-sm text-peach-800">
            {notice}
          </p>
        )}
        <button
          onClick={() => navigate(dashboardForRole[user.role] || 'landing')}
          className="mt-6 w-full rounded-lg bg-vio px-4 py-3 font-semibold text-white"
        >
          Go to dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">
        {intendedRoleName
          ? `${intendedRoleName[0].toUpperCase()}${intendedRoleName.slice(1)} sign in`
          : 'Welcome back'}
      </h1>
      <p className="mt-2 text-slate-600">
        {intendedRole
          ? `Sign in with your ${roleLabels[intendedRole] || intendedRole} account.`
          : 'Sign in to continue to ProjectVault.'}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Confirmed email and the account role stored by ProjectVault determine which workspace opens. Email text alone never grants faculty or admin access.
      </p>
      {intendedRole && (
        <p className="mt-4 rounded-xl border border-lavender-200 bg-lavender-50 p-3 text-sm text-lavender-800">
          This sign-in is for the {roleLabels[intendedRole] || intendedRole} workspace. Your account role determines which dashboards you can access.
        </p>
      )}

      {(!isApiConfigured || !isNeonAuthConfigured) && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          The ProjectVault API is not configured. Check your local environment settings.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-peach-50 p-3 text-sm text-peach-800">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-4 rounded-lg bg-sage-50 p-3 text-sm text-sage-800">
          {notice}
        </p>
      )}

      {showVerification ? (
        <form onSubmit={handleVerifyEmail} className="mt-6 space-y-4">
          <div>
            <label htmlFor="verification-email" className="mb-1 block text-sm font-medium">
              Email address
            </label>
            <input
              id="verification-email"
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
            <label htmlFor="verification-code" className="mb-1 block text-sm font-medium">
              Email verification code
            </label>
            <input
              id="verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-violet-500"
              placeholder="Enter the code from your email"
            />
          </div>
          <button
            type="submit"
            disabled={verificationBusy || resendBusy}
            className="w-full rounded-lg bg-vio px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verificationBusy ? 'Verifying...' : 'Verify email'}
          </button>
          <button
            type="button"
            onClick={handleResendVerificationCode}
            disabled={verificationBusy || resendBusy}
            className="w-full rounded-lg border border-violet-200 px-4 py-3 font-semibold text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendBusy ? 'Sending code...' : 'Send a new code'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowVerification(false);
              setError('');
              setNotice('');
            }}
            className="w-full text-sm font-semibold text-violet-700 underline"
          >
            Back to sign in
          </button>
        </form>
      ) : (
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
            disabled={resetBusy || busy || !isApiConfigured}
            className="text-sm font-semibold text-violet-700 underline disabled:opacity-60"
          >
            {resetBusy ? 'Sending request...' : 'Forgot password?'}
          </button>
        </div>

        <button
          type="submit"
          disabled={busy || resetBusy || !isApiConfigured}
          className="w-full rounded-lg bg-vio px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        {showVerification ? (
          'Use the numeric code sent to your email address.'
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setShowVerification(true);
                setError('');
                setNotice('');
              }}
              className="font-semibold text-violet-700 underline"
            >
              I have a verification code
            </button>
            <br />
            New to ProjectVault?{' '}
            <button onClick={() => navigate('register')} className="font-semibold text-violet-700">
              Create an account
            </button>
          </>
        )}
      </p>
    </section>
  );
}
