import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export default function DatabaseSetupPage() {
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function testConnection() {
    if (!isSupabaseConfigured || !supabase) {
      setResult('Supabase environment variables are not configured.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('colleges').select('id').limit(1);
    setResult(error ? `Connection/query failed: ${error.message}` : 'Supabase connection successful. The colleges table is readable under the current policies.');
    setBusy(false);
  }

  return <section className="rounded-2xl border bg-white p-7">
    <h1 className="text-3xl font-bold">Database Connection</h1>
    <p className="mt-2 text-slate-600">Test the configured Supabase connection without exposing credentials.</p>
    <button disabled={busy} onClick={testConnection} className="mt-5 rounded-lg bg-vio px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Checking...' : 'Test connection'}</button>
    {result && <p role="status" className="mt-4 rounded-lg bg-slate-50 p-4">{result}</p>}
  </section>;
}
