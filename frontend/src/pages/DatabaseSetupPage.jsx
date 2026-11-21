import { useState } from 'react';
import { supabase, isApiConfigured } from '../lib/supabase.js';

const checks = [
  {
    name: 'colleges',
    query: () => supabase.from('colleges').select('id, college_name').limit(1),
  },
  {
    name: 'profiles',
    query: () => supabase.from('profiles').select('id, role').limit(1),
  },
  {
    name: 'projects',
    query: () =>
      supabase
        .from('projects')
        .select('id, title, status, technologies, demo_url, report_path, demo_video_path')
        .limit(1),
  },
  {
    name: 'project_reviews',
    query: () =>
      supabase
        .from('project_reviews')
        .select('id, faculty_id, review_type, decision, comments, created_at, reviewed_at')
        .limit(1),
  },
  {
    name: 'project_team_members',
    query: () =>
      supabase.from('project_team_members').select('id, project_id, member_name').limit(1),
  },
  {
    name: 'faq_questions',
    query: () =>
      supabase.from('faq_questions').select('id, question, answer, status').limit(1),
  },
];

export default function DatabaseSetupPage() {
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  async function testConnection() {
    if (!isApiConfigured || !supabase) {
      setResults([]);
      return;
    }

    setBusy(true);
    try {
      const outcomes = await Promise.all(
        checks.map(async ({ name, query }) => {
          try {
            const { error } = await query();
            return { name, error: error?.message || '' };
          } catch (error) {
            return { name, error: error.message || 'Request failed.' };
          }
        })
      );
      setResults(outcomes);
    } finally {
      setBusy(false);
    }
  }

  const failedChecks = results.filter((result) => result.error);

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-extrabold uppercase tracking-[.16em] text-blue-700">ProjectVault setup</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">Database connection</h1>
      <p className="mt-2 leading-6 text-slate-600">
        Check that the PostgreSQL API is responding and the application schema is available.
      </p>

      {!isApiConfigured || !supabase ? (
        <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-bold">The PostgreSQL API is unavailable.</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6">
            <li>Copy <code>.env.example</code> to <code>.env.local</code> in the repository root.</li>
            <li>Start the backend with a valid PostgreSQL <code>DATABASE_URL</code>.</li>
            <li>Set <code>VITE_API_URL</code> to the API's public URL for a deployed frontend.</li>
            <li>Restart the frontend after changing environment variables.</li>
          </ol>
          <p className="mt-3 text-sm font-semibold">Never put the PostgreSQL connection string or JWT secret in a Vite environment variable.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={testConnection}
            className="mt-6 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {busy ? 'Checking database…' : 'Test database and schema'}
          </button>

          {results.length > 0 && (
            <div className="mt-6 space-y-3" aria-live="polite">
              <p className={`rounded-xl p-4 text-sm font-semibold ${failedChecks.length ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>
                {failedChecks.length
                  ? `${failedChecks.length} of ${results.length} checks need attention. See the table/column details below.`
                  : 'Connection and app schema checks passed for the current access policies.'}
              </p>
              {results.map((result) => (
                <div key={result.name} className={`rounded-xl border p-4 ${result.error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <p className={`font-bold ${result.error ? 'text-red-800' : 'text-emerald-800'}`}>
                    {result.error ? 'Needs attention' : 'Available'}: <code>{result.name}</code>
                  </p>
                  {result.error && <p className="mt-1 break-words text-sm text-red-700">{result.error}</p>}
                </div>
              ))}
              {failedChecks.length > 0 && (
                <p className="text-sm leading-6 text-slate-600">
                  A missing table or column means the PostgreSQL schema does not match this app. This check requests at most one row per table and does not display record contents.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
