import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export default function RegisterPage({ navigate }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [colleges, setColleges] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadColleges() {
      if (!supabase || !isSupabaseConfigured) {
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

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured. Check your .env.local file.');
      return;
    }

    if (!collegeId) {
      setError('Please select your college.');
      return;
    }

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    setBusy(true);

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (signupError) throw signupError;

      if (!data.user) {
        throw new Error('Supabase did not return a user. Please try again.');
      }

      if (data.session) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          role: 'student',
          college_id: Number(collegeId),
        });

        if (profileError) {
          throw new Error(
            'Your account was created, but the student profile could not be saved: ' +
            profileError.message +
            '. Ask the project administrator to check the profile policy.'
          );
        }

        setMessage('Account created successfully. You can now sign in.');
      } else {
        setMessage(
          'Signup started. Check your email for the confirmation link. ' +
          'Your profile must be created securely after confirmation before you can use the app.'
        );
      }
    } catch (err) {
      setError(err.message || 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-2 text-slate-600">
        Register as a student to discover and submit projects.
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
            className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-violet-500"
            placeholder="you@college.edu"
          />
        </div>

        <div>
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
        </div>

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
          Public registration creates student accounts only. Faculty and admin roles must be assigned through an authorized process.
        </p>

        <button
          type="submit"
          disabled={busy || loadingColleges || colleges.length === 0 || !isSupabaseConfigured}
          className="w-full rounded-lg bg-vio px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Creating account...' : 'Create student account'}
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
