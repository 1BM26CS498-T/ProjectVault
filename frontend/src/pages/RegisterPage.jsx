import { useEffect, useState } from 'react';
import { supabase, isApiConfigured } from '../lib/supabase.js';
import { authClient, isNeonAuthConfigured } from '../lib/neonAuth.js';

export default function RegisterPage({ navigate }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('student');
  const [collegeId, setCollegeId] = useState('');
  const [colleges, setColleges] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [invitation, setInvitation] = useState(null);
  const inviteToken = new URLSearchParams(window.location.hash.split('?')[1] || '').get('invite');

  useEffect(() => {
    let active = true;

    async function loadInvitation() {
      if (!inviteToken) return;
      const { data, error: inviteError } = await supabase.auth.getInvite(inviteToken);
      if (!active) return;
      if (inviteError) {
        setError(`Could not load faculty invitation: ${inviteError.message}`);
        return;
      }
      setInvitation(data);
      setFullName(data.full_name || '');
      setEmail(data.email || '');
      setCollegeId(String(data.college_id || ''));
    }

    async function loadColleges() {
      if (!supabase || !isApiConfigured) {
        setLoadingColleges(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('colleges')
        .select('id, college_name')
        .order('college_name');

      if (!active) return;

      if (queryError) {
        setError('Could not load colleges: ' + queryError.message);
      } else {
        setColleges(data || []);
      }

      setLoadingColleges(false);
    }

    void loadColleges();
    void loadInvitation();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!isApiConfigured || !supabase || !isNeonAuthConfigured) {
      setError('The ProjectVault API is not configured. Check your local environment settings.');
      return;
    }

    if (!invitation && !collegeId) {
      setError('Please select your college.');
      return;
    }

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    setBusy(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!invitation) {
        const { error: registrationError } = await supabase.auth.prepareRegistration({
          email: cleanEmail,
          full_name: fullName.trim(),
          college_id: Number(collegeId),
          role: accountType,
        });
        if (registrationError) throw registrationError;
      }

      const signup = await authClient.signUp.email({
        email: cleanEmail,
        password,
        name: fullName.trim(),
      });
      if (signup.error) throw signup.error;
      if (!signup.data?.user) {
        throw new Error('The API did not accept the account registration. Please try again.');
      }

      setMessage(invitation || accountType === 'faculty'
        ? 'Check your inbox and spam folder for a verification email. To enter a numeric code, go to Sign in and choose “I have a verification code.” Faculty access stays disabled until an administrator approves your account.'
        : 'Check your inbox and spam folder for a verification email. To enter a numeric code, go to Sign in and choose “I have a verification code.” After verification, sign in to open your student workspace.');
    } catch (err) {
      setError(err.message || 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">
        {invitation ? 'Accept faculty invitation' : 'Create your account'}
      </h1>
      <p className="mt-2 text-slate-600">
        {invitation
          ? `Create your account to join ${invitation.college_name || 'your college'} as faculty.`
          : 'Create a student or faculty account using Neon Auth.'}
      </p>

      {(!isApiConfigured || !isNeonAuthConfigured) && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          The ProjectVault API is not configured. Check your local environment settings.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="register-name" className="mb-1 block text-sm font-medium">
            Full name
          </label>
          <input
            id="register-name"
            required
            maxLength={120}
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            readOnly={Boolean(invitation)}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-violet-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1 block text-sm font-medium">
            College email
          </label>
          <input
            id="register-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(invitation)}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-violet-500"
            placeholder="you@college.edu"
          />
        </div>

        {!invitation && <div>
          <label htmlFor="register-role" className="mb-1 block text-sm font-medium">
            Account type
          </label>
          <select
            id="register-role"
            required
            value={accountType}
            onChange={(event) => setAccountType(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-violet-500"
          >
            <option value="student">Student</option>
            <option value="faculty">Faculty (requires admin approval)</option>
          </select>
        </div>}

        {!invitation && <div>
          <label htmlFor="register-college" className="mb-1 block text-sm font-medium">
            College
          </label>
          <select
            id="register-college"
            required
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value)}
            disabled={loadingColleges || colleges.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-violet-500 disabled:bg-slate-100"
          >
            <option value="">
              {loadingColleges ? 'Loading colleges...' : 'Select your college'}
            </option>
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.college_name}
              </option>
            ))}
          </select>
          {!loadingColleges && colleges.length === 0 && (
            <p className="mt-1 text-sm text-slate-500">
              No colleges are available yet. Ask an administrator to add your college.
            </p>
          )}
        </div>}

        <div>
          <label htmlFor="register-password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-violet-500"
            placeholder="At least 8 characters"
          />
        </div>

        <p className="text-sm text-slate-500">
          Faculty accounts remain pending until an administrator approves them. Admin accounts can only be initialized through the configured administrator setup.
        </p>

        <button
          type="submit"
          disabled={busy || (!invitation && (loadingColleges || colleges.length === 0)) || !isApiConfigured || !isNeonAuthConfigured}
          className="w-full rounded-lg bg-vio px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Creating account...' : invitation ? 'Accept invitation' : `Create ${accountType} account`}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <button onClick={() => navigate('login')} className="font-semibold text-violet-700">
          Sign in
        </button>
      </p>
    </section>
  );
}
