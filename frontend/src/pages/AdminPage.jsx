import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase, isApiConfigured } from '../lib/supabase.js';

const emptyStats = {
  colleges: null,
  users: null,
  projects: null,
  pending: null,
  verified: null,
  faq: null,
};

function StatCard({ label, value, detail, color }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-1.5 w-12 rounded-full ${color}`} />
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
        {value ?? '—'}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export default function AdminPage({ navigate }) {
  const { user } = useAuth();

  const [collegeName, setCollegeName] = useState('');
  const [collegeBatch, setCollegeBatch] = useState('');
  const [colleges, setColleges] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [pendingFaqs, setPendingFaqs] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [savingCollege, setSavingCollege] = useState(false);

  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyCollegeId, setFacultyCollegeId] = useState('');
  const [savingFaculty, setSavingFaculty] = useState(false);
  const [faqAnswers, setFaqAnswers] = useState({});
  const [faqActionId, setFaqActionId] = useState(null);
  const [profileActionId, setProfileActionId] = useState(null);
  const [projectActionId, setProjectActionId] = useState(null);
  const [search, setSearch] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    if (!isApiConfigured || !supabase) {
      setConnectionError(
        'The ProjectVault API is not configured. Set VITE_API_URL when deployed or start the backend locally.'
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setConnectionError('');

    try {
      const [
      collegesResult,
      usersCountResult,
      profilesResult,
      projectsCountResult,
      pendingCountResult,
      verifiedCountResult,
      projectsResult,
      pendingFaqCountResult,
      pendingFaqsResult,
      ] = await Promise.all([
        supabase.from('colleges').select('id, college_name, created_at').order('college_name'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase
          .from('profiles')
          .select('id, full_name, email, role, college_id, status, email_verified_at, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
        supabase
          .from('projects')
          .select('id, title, status, created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('faq_questions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('faq_questions')
          .select('id, question, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(10),
      ]);

      const failures = [
        ['colleges', collegesResult.error],
        ['user totals', usersCountResult.error],
        ['user directory', profilesResult.error],
        ['project totals', projectsCountResult.error],
        ['pending project totals', pendingCountResult.error],
        ['verified project totals', verifiedCountResult.error],
        ['recent projects', projectsResult.error],
        ['pending FAQ total', pendingFaqCountResult.error],
        ['pending FAQ questions', pendingFaqsResult.error],
      ].filter(([, queryError]) => queryError);

      setColleges(collegesResult.data || []);
      setProfiles(profilesResult.data || []);
      setRecentProjects(projectsResult.data || []);
      setPendingFaqs(pendingFaqsResult.data || []);
      setStats({
        colleges: collegesResult.error ? null : collegesResult.data?.length ?? 0,
        users: usersCountResult.error ? null : usersCountResult.count ?? 0,
        projects: projectsCountResult.error ? null : projectsCountResult.count ?? 0,
        pending: pendingCountResult.error ? null : pendingCountResult.count ?? 0,
        verified: verifiedCountResult.error ? null : verifiedCountResult.count ?? 0,
        faq: pendingFaqCountResult.error ? null : pendingFaqCountResult.count ?? 0,
      });

      if (failures.length) {
        setConnectionError(
          failures
            .map(([resource, queryError]) => `${resource}: ${queryError.message}`)
            .join(' • ')
        );
      }
    } catch (loadError) {
      setConnectionError(`Database request failed: ${loadError.message || 'Check the PostgreSQL API, network, and account permissions.'}`);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;

    return profiles.filter((profile) =>
      [profile.full_name, profile.email, profile.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [profiles, search]);

  async function handleCreateCollege(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const name = collegeName.trim();
    if (!name) {
      setError('Please enter a college name.');
      return;
    }
    if (!supabase || !isApiConfigured) {
      setError('The ProjectVault API is not configured.');
      return;
    }

    setSavingCollege(true);
    try {
      const { error: insertError } = await supabase
        .from('colleges')
        .insert({ college_name: name });

      if (insertError) {
        throw new Error(
          insertError.code === '23505'
            ? 'This college already exists.'
            : insertError.message
        );
      }

      setCollegeName('');
      setMessage('College created successfully.');
      await loadDashboard();
    } catch (createError) {
      setError(createError.message || 'Could not create the college.');
    } finally {
      setSavingCollege(false);
    }
  }

  async function handleImportColleges(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const pastedNames = collegeBatch
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (pastedNames.some((name) => name.length > 200)) {
      setError('College names must be 200 characters or fewer.');
      return;
    }

    const names = [...new Map(pastedNames.map((name) => [name.toLowerCase(), name])).values()];

    if (names.length === 0) {
      setError('Paste at least one college name, one per line.');
      return;
    }
    if (names.length > 100) {
      setError('Import up to 100 unique college names at a time.');
      return;
    }
    if (!supabase || !isApiConfigured) {
      setError('The ProjectVault API is not configured.');
      return;
    }

    setSavingCollege(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from('colleges')
        .select('college_name');
      if (existingError) throw existingError;

      const existingNames = new Set((existing || []).map((college) => college.college_name.trim().toLowerCase()));
      const newNames = names.filter((name) => !existingNames.has(name.toLowerCase()));
      if (newNames.length === 0) {
        setMessage('All pasted college names are already registered.');
        return;
      }

      const { error: importError } = await supabase
        .from('colleges')
        .insert(newNames.map((college_name) => ({ college_name })));
      if (importError) throw importError;

      setCollegeBatch('');
      setMessage(`${newNames.length} college${newNames.length === 1 ? '' : 's'} added; ${names.length - newNames.length} duplicate${names.length - newNames.length === 1 ? '' : 's'} skipped.`);
      await loadDashboard();
    } catch (importError) {
      setError(`Could not import colleges: ${importError.message}`);
    } finally {
      setSavingCollege(false);
    }
  }

  async function handleFaqDecision(faq, decision) {
    if (!supabase || faqActionId) return;
    setError('');
    setMessage('');

    const answer = (faqAnswers[faq.id] || '').trim();
    if (decision === 'published' && answer.length < 5) {
      setError('Write an answer of at least 5 characters before publishing.');
      return;
    }

    setFaqActionId(faq.id);
    try {
      const update = decision === 'published'
        ? {
            answer,
            status: 'published',
            answered_by: user.id,
            answered_at: new Date().toISOString(),
          }
        : {
            status: 'rejected',
            answered_by: user.id,
            answered_at: new Date().toISOString(),
          };

      const { data: updatedQuestion, error: updateError } = await supabase
        .from('faq_questions')
        .update(update)
        .eq('id', faq.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedQuestion) throw new Error('The question changed before it could be reviewed. Refresh and try again.');
      setMessage(decision === 'published' ? 'FAQ answer published.' : 'Question rejected.');
      setFaqAnswers((previous) => {
        const next = { ...previous };
        delete next[faq.id];
        return next;
      });
      await loadDashboard();
    } catch (actionError) {
      setError(`Could not update the FAQ: ${actionError.message}`);
    } finally {
      setFaqActionId(null);
    }
  }

  async function handleFacultyApproval(profile) {
    if (!supabase || profileActionId) return;
    setError('');
    setMessage('');
    setProfileActionId(profile.id);
    try {
      const { error: approvalError } = await supabase.admin.approveFaculty(profile.id);
      if (approvalError) throw approvalError;
      setMessage(`${profile.full_name || profile.email} is now an active faculty member.`);
      await loadDashboard();
    } catch (approvalError) {
      setError(`Could not approve faculty account: ${approvalError.message}`);
    } finally {
      setProfileActionId(null);
    }
  }

  async function handleProfileStatus(profile, status) {
    if (!supabase || profileActionId) return;
    setError('');
    setMessage('');
    setProfileActionId(profile.id);
    try {
      const { error: statusError } = await supabase.admin.setProfileStatus(profile.id, status);
      if (statusError) throw statusError;
      setMessage(`${profile.full_name || profile.email} is now ${status.toLowerCase()}.`);
      await loadDashboard();
    } catch (statusError) {
      setError(`Could not update account status: ${statusError.message}`);
    } finally {
      setProfileActionId(null);
    }
  }

  async function handleProjectModeration(project, status) {
    if (!supabase || projectActionId) return;
    setError('');
    setMessage('');
    setProjectActionId(project.id);
    try {
      const { error: moderationError } = await supabase.admin.moderateProject(project.id, status);
      if (moderationError) throw moderationError;
      setMessage(`Project "${project.title}" marked ${status.replaceAll('_', ' ')}.`);
      await loadDashboard();
    } catch (moderationError) {
      setError(`Could not moderate project: ${moderationError.message}`);
    } finally {
      setProjectActionId(null);
    }
  }

  async function handleCreateFaculty(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!supabase || !isApiConfigured) {
      setError('The ProjectVault API is not configured.');
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
        const response = functionError.context;
        if (response && typeof response.json === 'function') {
          try {
            const body = await response.json();
            if (body?.error) detail = body.error;
          } catch {
            // Keep the original function error message.
          }
        }
        throw new Error(detail || 'Could not create faculty invitation.');
      }
      if (data?.error) throw new Error(data.error);

      setMessage('Invitation sent successfully. The faculty member can follow the email instructions to set up their account.');
      setFacultyName('');
      setFacultyEmail('');
      setFacultyCollegeId('');
      await loadDashboard();
    } catch (inviteError) {
      setError(inviteError.message || 'Could not create faculty invitation.');
    } finally {
      setSavingFaculty(false);
    }
  }

  if (user?.role !== 'admin') {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p className="mt-2 text-slate-600">Only an administrator can access this page.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#291927] via-[#4b2e43] to-[#a83e31] px-6 py-8 text-white shadow-xl shadow-[#352033]/10 sm:px-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.16em] text-amber-300">ProjectVault · Control center</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Admin dashboard</h1>
            <p className="mt-2 text-rose-100">Welcome, {user.full_name || user.name || 'Administrator'}. Manage your community and keep an eye on project activity.</p>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
          >
            {loading ? 'Refreshing…' : 'Refresh dashboard'}
          </button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${connectionError ? 'bg-[#ffad94]' : loading ? 'animate-pulse bg-[#bd8eae]' : 'bg-emerald-300'}`} />
          <span>{!isApiConfigured ? 'API setup required' : connectionError ? 'Database needs attention' : loading ? 'Checking database…' : 'Database connected'}</span>
        </div>
      </section>

      {connectionError && (
        <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-bold">Database connection / access issue</h2>
          <p className="mt-1 text-sm leading-6">{connectionError}</p>
          {!isApiConfigured && (
            <ol className="mt-3 list-inside list-decimal space-y-1 text-sm">
              <li>Copy <code>.env.example</code> to <code>.env.local</code> in the repository root.</li>
              <li>Set <code>VITE_API_URL</code> to the public URL of your ProjectVault API.</li>
              <li>Restart the Vite server. Never put a service-role key in the frontend.</li>
            </ol>
          )}
          {isApiConfigured && (
            <p className="mt-3 text-sm">Check that the required tables and columns match the app and that the signed-in admin has the required row-level security permissions.</p>
          )}
        </section>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Workspace overview</h2>
            <p className="mt-1 text-sm text-slate-600">Live totals from the PostgreSQL-backed API.</p>
          </div>
          <button onClick={() => navigate('search-projects')} className="text-sm font-bold text-blue-700 hover:text-blue-900">
            Browse project catalogue →
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <StatCard label="Colleges" value={stats.colleges} detail="Registered institutions" color="bg-amber-400" />
          <StatCard label="Accounts" value={stats.users} detail="Student and faculty profiles" color="bg-blue-500" />
          <StatCard label="Projects" value={stats.projects} detail="All project records" color="bg-indigo-500" />
          <StatCard label="Needs review" value={stats.pending} detail="Awaiting faculty review" color="bg-orange-400" />
          <StatCard label="Verified" value={stats.verified} detail="Completed and verified" color="bg-emerald-500" />
          <StatCard label="FAQ review" value={stats.faq} detail="Questions awaiting answers" color="bg-rose-500" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Recent projects</h2>
              <p className="mt-1 text-sm text-slate-500">Latest activity across the project catalogue.</p>
            </div>
            <button onClick={() => navigate('search-projects')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Open catalogue
            </button>
          </div>
          {loading ? (
            <p className="mt-5 text-sm text-slate-500">Loading projects…</p>
          ) : recentProjects.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No recent projects to show.</p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {recentProjects.map((project) => (
                <div key={project.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('project-detail', { id: project.id })}
                      className="min-w-0 flex-1 text-left hover:bg-slate-50"
                    >
                      <span className="block truncate font-semibold text-slate-900">{project.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Date unavailable'}</span>
                    </button>
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold capitalize text-blue-800">{(project.status || 'unknown').replaceAll('_', ' ')}</span>
                  </div>
                  {project.status === 'pending' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={projectActionId === project.id}
                        onClick={() => handleProjectModeration(project, 'approved')}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={projectActionId === project.id}
                        onClick={() => handleProjectModeration(project, 'rejected')}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {project.status === 'submitted' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={projectActionId === project.id}
                        onClick={() => handleProjectModeration(project, 'verified')}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        disabled={projectActionId === project.id}
                        onClick={() => handleProjectModeration(project, 'changes_requested')}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-60"
                      >
                        Request changes
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-slate-950">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">Jump to the most-used admin tools.</p>
          <div className="mt-5 grid gap-3">
            <button onClick={() => document.getElementById('create-college')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-between rounded-xl bg-amber-50 p-4 text-left font-bold text-amber-950 hover:bg-amber-100">
              <span><span className="block">Add a college</span><span className="mt-1 block text-xs font-medium text-amber-800">Register an institution</span></span><span aria-hidden="true">＋</span>
            </button>
            <button onClick={() => document.getElementById('invite-faculty')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-between rounded-xl bg-blue-50 p-4 text-left font-bold text-blue-950 hover:bg-blue-100">
              <span><span className="block">Invite faculty</span><span className="mt-1 block text-xs font-medium text-blue-800">Send an account invitation</span></span><span aria-hidden="true">＋</span>
            </button>
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-800">Registered colleges</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{stats.colleges ?? '—'}</p>
            <p className="text-xs text-slate-500">Colleges available to new student accounts</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Accounts</h2>
            <p className="mt-1 text-sm text-slate-500">Search the latest registered accounts. Showing up to 100.</p>
          </div>
          <label className="w-full sm:w-72">
            <span className="sr-only">Search accounts</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or role"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500"
            />
          </label>
        </div>
        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Loading accounts…</p>
        ) : filteredProfiles.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No accounts match your search.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Role</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">College ID</th><th className="py-3 pr-4">Joined</th><th className="py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{profile.full_name || 'Unnamed account'}</td>
                    <td className="py-3 pr-4 text-slate-600">{profile.email || '—'}</td>
                    <td className="py-3 pr-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-800">{profile.role || 'unknown'}</span></td>
                    <td className="py-3 pr-4">
                      <span className="block capitalize text-slate-700">{profile.status || 'unknown'}</span>
                      <span className="text-xs text-slate-500">{profile.email_verified_at ? 'Email verified' : 'Email not verified'}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{profile.college_id || '—'}</td>
                    <td className="py-3 pr-4 text-slate-500">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3">
                      {profile.role === 'faculty' && profile.status === 'Pending' ? (
                        <button
                          type="button"
                          disabled={profileActionId === profile.id}
                          onClick={() => handleFacultyApproval(profile)}
                          className="whitespace-nowrap rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {profileActionId === profile.id ? 'Saving…' : 'Approve faculty'}
                        </button>
                      ) : ['student', 'faculty'].includes(profile.role) && ['Active', 'Suspended'].includes(profile.status) ? (
                        <button
                          type="button"
                          disabled={profileActionId === profile.id}
                          onClick={() => handleProfileStatus(profile, profile.status === 'Active' ? 'Suspended' : 'Active')}
                          className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-60"
                        >
                          {profileActionId === profile.id ? 'Saving…' : profile.status === 'Active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="faq-review" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">FAQ moderation</h2>
            <p className="mt-1 text-sm text-slate-500">Answer questions to publish them for everyone, or reject them.</p>
          </div>
          <button onClick={() => navigate('faq')} className="text-sm font-bold text-[#873d4a] hover:text-[#5a2c39]">View public FAQ →</button>
        </div>
        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Loading questions…</p>
        ) : pendingFaqs.length === 0 ? (
          <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-slate-600">No questions are waiting for review.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pendingFaqs.map((faq) => (
              <article key={faq.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-bold text-slate-900">{faq.question}</p>
                  <time className="text-xs text-slate-500">{faq.created_at ? new Date(faq.created_at).toLocaleDateString() : ''}</time>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Answer to publish</span>
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={faqAnswers[faq.id] || ''}
                    onChange={(event) => setFaqAnswers((previous) => ({ ...previous, [faq.id]: event.target.value }))}
                    placeholder="Write a helpful answer…"
                    className="w-full rounded-xl border border-stone-300 bg-white p-3 text-sm"
                  />
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <button disabled={faqActionId === faq.id} onClick={() => handleFaqDecision(faq, 'rejected')} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-white disabled:opacity-60">Reject</button>
                  <button disabled={faqActionId === faq.id} onClick={() => handleFaqDecision(faq, 'published')} className="rounded-lg bg-[#873d4a] px-4 py-2 text-sm font-bold text-white hover:bg-[#71323d] disabled:opacity-60">{faqActionId === faq.id ? 'Saving…' : 'Answer & publish'}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <section id="create-college" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Create college</h2>
          <p className="mt-1 text-sm text-slate-600">College names must be unique.</p>
          <form onSubmit={handleCreateCollege} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">College name</span>
              <input
                value={collegeName}
                onChange={(event) => setCollegeName(event.target.value)}
                placeholder="Enter college name"
                maxLength={200}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </label>
            <button type="submit" disabled={savingCollege || loading} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60">
              {savingCollege ? 'Creating…' : 'Add college'}
            </button>
          </form>
          <form onSubmit={handleImportColleges} className="mt-5 border-t border-slate-100 pt-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Add a list (up to 100 names, one per line)</span>
              <textarea
                value={collegeBatch}
                onChange={(event) => setCollegeBatch(event.target.value)}
                rows={5}
                maxLength={24000}
                placeholder="Paste verified college names here, one per line"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
            <button type="submit" disabled={savingCollege || loading} className="mt-3 rounded-xl bg-violet-700 px-5 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-60">
              {savingCollege ? 'Adding colleges…' : 'Add college list'}
            </button>
          </form>
          <div className="mt-5 max-h-52 divide-y divide-slate-100 overflow-y-auto">
            {colleges.map((college) => (
              <div key={college.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 font-bold text-amber-900">{college.college_name?.charAt(0).toUpperCase() || 'C'}</span>
                <span className="min-w-0 truncate font-medium text-slate-800">{college.college_name}</span>
              </div>
            ))}
            {!loading && colleges.length === 0 && <p className="py-3 text-sm text-slate-500">No colleges have been created yet.</p>}
          </div>
        </section>

        <section id="invite-faculty" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Invite faculty</h2>
          <p className="mt-1 text-sm text-slate-600">Send an invitation and assign a college.</p>
          <form onSubmit={handleCreateFaculty} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</span>
              <input value={facultyName} onChange={(event) => setFacultyName(event.target.value)} maxLength={120} autoComplete="name" required placeholder="Faculty full name" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Email</span>
              <input type="email" value={facultyEmail} onChange={(event) => setFacultyEmail(event.target.value)} autoComplete="email" maxLength={254} required placeholder="faculty@example.edu" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">College</span>
              <select value={facultyCollegeId} onChange={(event) => setFacultyCollegeId(event.target.value)} required disabled={loading || colleges.length === 0} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100">
                <option value="">{loading ? 'Loading colleges…' : 'Select a college'}</option>
                {colleges.map((college) => <option key={college.id} value={college.id}>{college.college_name}</option>)}
              </select>
            </label>
            <button type="submit" disabled={savingFaculty || loading || colleges.length === 0} className="w-full rounded-xl bg-[#352033] px-5 py-3 font-bold text-white hover:bg-[#4b2e43] disabled:cursor-not-allowed disabled:opacity-60">
              {savingFaculty ? 'Sending invitation…' : 'Invite faculty member'}
            </button>
          </form>
        </section>
      </section>
    </div>
  );
}
