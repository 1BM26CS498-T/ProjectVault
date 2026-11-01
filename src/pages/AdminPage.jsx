import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export default function AdminPage() {
  const { user } = useAuth();

  const [collegeName, setCollegeName] = useState('');
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCollege, setSavingCollege] = useState(false);

  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyCollegeId, setFacultyCollegeId] = useState('');
  const [savingFaculty, setSavingFaculty] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadColleges = useCallback(async () => {
    if (!supabase || user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error: loadError } = await supabase
      .from('colleges')
      .select('id, college_name, created_at')
      .order('college_name');

    if (loadError) {
      setError(loadError.message);
    } else {
      setColleges(data || []);
    }

    setLoading(false);
  }, [user?.role]);

  useEffect(() => {
    void loadColleges();
  }, [loadColleges]);

  async function handleCreateCollege(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const name = collegeName.trim();

    if (!name) {
      setError('Please enter a college name.');
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      setError('Supabase is not configured. Check your environment settings.');
      return;
    }

    setSavingCollege(true);

    const { data, error: insertError } = await supabase
      .from('colleges')
      .insert({ college_name: name })
      .select('id, college_name, created_at')
      .single();

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'This college already exists.'
          : insertError.message
      );
    } else {
      setColleges((previous) =>
        [...previous, data].sort((a, b) =>
          a.college_name.localeCompare(b.college_name)
        )
      );
      setCollegeName('');
      setMessage('College created successfully!');
    }

    setSavingCollege(false);
  }

  async function handleCreateFaculty(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!supabase || !isSupabaseConfigured) {
      setError('Supabase is not configured.');
      return;
    }

    if (!facultyName.trim() || !facultyEmail.trim() || !facultyCollegeId) {
      setError('Enter the faculty name, email, and college.');
      return;
    }

    setSavingFaculty(true);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke('create-faculty', {
          body: {
            full_name: facultyName.trim(),
            email: facultyEmail.trim().toLowerCase(),
            college_id: Number(facultyCollegeId),
          },
        });

      if (functionError) {
        let detail = functionError.message;

        try {
          const response = functionError.context;
          if (response && typeof response.json === 'function') {
            const body = await response.json();
            if (body?.error) detail = body.error;
          }
        } catch {
          // Keep the original function error message.
        }

        throw new Error(detail || 'Could not create faculty invitation.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setMessage(
        'Invitation sent successfully! Check your email for the invitation and follow the instructions to set up your account.' 
      );
      setFacultyName('');
      setFacultyEmail('');
      setFacultyCollegeId('');
    } catch (err) {
      setError(err.message || 'Could not create faculty invitation.');
    } finally {
      setSavingFaculty(false);
    }
  }

  if (user?.role !== 'admin') {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p className="mt-2 text-slate-600">
          Only an administrator can access this page.
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">
          ProjectVault
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Administration
        </h1>
        <p className="mt-2 text-slate-600">
          Manage colleges and invite faculty members.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Create College</h2>
        <p className="mt-1 text-sm text-slate-600">
          Each college name must be unique.
        </p>

        <form onSubmit={handleCreateCollege} className="mt-5 space-y-4">
          <div>
            <label htmlFor="collegeName" className="mb-2 block text-sm font-medium text-slate-700">
              College Name
            </label>
            <input
              id="collegeName"
              value={collegeName}
              onChange={(event) => setCollegeName(event.target.value)}
              placeholder="Enter your college name"
              maxLength={200}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-violet-600"
            />
          </div>
          <button
            type="submit"
            disabled={savingCollege}
            className="rounded-lg bg-violet-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {savingCollege ? 'Creating...' : 'Create College'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Create Faculty Account</h2>
        <p className="mt-1 text-sm text-slate-600">
          Send an invitation to a faculty member. They will use the email invitation to set up their account.
        </p>

        <form onSubmit={handleCreateFaculty} className="mt-5 space-y-4">
          <div>
            <label htmlFor="facultyName" className="mb-2 block text-sm font-medium text-slate-700">
              Faculty Full Name
            </label>
            <input
              id="facultyName"
              value={facultyName}
              onChange={(event) => setFacultyName(event.target.value)}
              maxLength={120}
              autoComplete="name"
              required
              placeholder="Enter faculty full name"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-violet-600"
            />
          </div>

          <div>
            <label htmlFor="facultyEmail" className="mb-2 block text-sm font-medium text-slate-700">
              Faculty Email
            </label>
            <input
              id="facultyEmail"
              type="email"
              value={facultyEmail}
              onChange={(event) => setFacultyEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              required
              placeholder="faculty@example.edu"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-violet-600"
            />
          </div>

          <div>
            <label htmlFor="facultyCollege" className="mb-2 block text-sm font-medium text-slate-700">
              Assign College
            </label>
            <select
              id="facultyCollege"
              value={facultyCollegeId}
              onChange={(event) => setFacultyCollegeId(event.target.value)}
              required
              disabled={loading || colleges.length === 0}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-violet-600 disabled:bg-slate-100"
            >
              <option value="">
                {loading ? 'Loading colleges...' : 'Select a college'}
              </option>
              {colleges.map((college) => (
                <option key={college.id} value={college.id}>
                  {college.college_name}
                </option>
              ))}
            </select>
            {!loading && colleges.length === 0 && (
              <p className="mt-1 text-sm text-amber-700">
                Create a college before adding faculty.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={savingFaculty || loading || colleges.length === 0}
            className="rounded-lg bg-violet-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingFaculty ? 'Sending invitation...' : 'Create Faculty & Send Invitation'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Registered Colleges</h2>
          <button
            type="button"
            onClick={loadColleges}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-slate-500">Loading colleges...</p>
        ) : colleges.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-slate-600">
            No colleges have been created yet.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {colleges.map((college) => (
              <div key={college.id} className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 font-bold text-violet-700">
                  {college.college_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{college.college_name}</p>
                  <p className="text-xs text-slate-500">College ID: {college.id}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

