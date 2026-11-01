import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

export default function MyProjectsPage({ navigate }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [verifiers, setVerifiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      if (!user?.id) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('id, title, description, technologies, github_url, status, faculty_feedback, created_at, updated_at')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        console.error('Could not load projects:', fetchError.message);
        setError(fetchError.message);
        setProjects([]);
      } else {
        const projectList = data || [];
        setProjects(projectList);

        const verifiedIds = projectList
          .filter((p) => (p.status || '').toLowerCase() === 'verified')
          .map((p) => p.id);

        if (verifiedIds.length > 0) {
          try {
            const { data: reviewData } = await supabase
              .from('project_reviews')
              .select('project_id, faculty_id')
              .in('project_id', verifiedIds)
              .eq('review_type', 'final')
              .eq('decision', 'verified');

            if (reviewData && reviewData.length > 0) {
              const facultyIds = [
                ...new Set(reviewData.map((r) => r.faculty_id).filter(Boolean)),
              ];

              if (facultyIds.length > 0) {
                const { data: profilesData } = await supabase
                  .from('profiles')
                  .select('id, full_name')
                  .in('id', facultyIds);

                const nameMap = Object.fromEntries(
                  (profilesData || []).map((prof) => [prof.id, prof.full_name])
                );

                const verifierMap = {};
                reviewData.forEach((rev) => {
                  if (!verifierMap[rev.project_id] && nameMap[rev.faculty_id]) {
                    verifierMap[rev.project_id] = nameMap[rev.faculty_id];
                  }
                });

                if (active) {
                  setVerifiers(verifierMap);
                }
              }
            }
          } catch (revErr) {
            console.warn('Could not load verifier names:', revErr);
          }
        }
      }

      setLoading(false);
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [user?.id]);

  function formatStatus(status) {
    const val = (status || 'pending').toLowerCase();
    if (val === 'approved') return 'Approved (Awaiting Final Verification)';
    if (val === 'submitted') return 'Awaiting Final Verification';
    if (val === 'verified') return 'Verified';
    if (val === 'pending') return 'Pending Faculty Review';
    if (val === 'changes_requested') return 'Changes Requested';
    if (val === 'rejected') return 'Rejected';
    return (status || 'pending')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function statusStyle(status) {
    const value = (status || 'pending').toLowerCase();
    if (value.includes('reject')) return 'bg-red-100 text-red-700';
    if (value === 'verified') return 'bg-green-100 text-green-700';
    if (value === 'approved' || value === 'submitted') {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-amber-100 text-amber-800';
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="mt-2 text-slate-600">
            Track project progress, final submissions, feedback and verification.
          </p>
        </div>

        <button
          onClick={() => navigate('propose')}
          className="rounded-lg bg-vio px-4 py-2 font-semibold text-white"
        >
          + Submit proposal
        </button>
      </div>

      {!user && (
        <div className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-800">
          Please sign in to view your projects.
        </div>
      )}

      {user && loading && (
        <div className="mt-6 rounded-xl border bg-white p-6 text-slate-600">
          Loading your projects...
        </div>
      )}

      {user && !loading && error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="font-semibold">Unable to load your projects.</p>
          <p className="mt-2 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2"
          >
            Try again
          </button>
        </div>
      )}

      {user && !loading && !error && projects.length === 0 && (
        <div className="mt-6 rounded-xl border bg-white p-8 text-center">
          <h2 className="text-xl font-semibold">No projects yet</h2>
          <p className="mt-2 text-slate-600">
            Your submitted proposals will appear here so you can track their progress.
          </p>
          <button
            onClick={() => navigate('propose')}
            className="mt-5 rounded-lg bg-vio px-5 py-2 font-semibold text-white"
          >
            Submit your first proposal
          </button>
        </div>
      )}

      {user && !loading && !error && projects.length > 0 && (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-slate-600">
            {projects.length} project{projects.length === 1 ? '' : 's'} found
          </p>

          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{project.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Submitted{' '}
                    {project.created_at
                      ? new Date(project.created_at).toLocaleDateString()
                      : 'date unavailable'}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyle(project.status)}`}
                >
                  {formatStatus(project.status)}
                </span>
              </div>

              {((project.status || '').toLowerCase() === 'approved' ||
                (project.status || '').toLowerCase() === 'submitted') && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-sm text-blue-900">
                  <p className="font-medium">
                    Proposal approved. Project is awaiting final faculty verification.
                  </p>
                </div>
              )}

              {(project.status || '').toLowerCase() === 'verified' && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50/70 px-3.5 py-2 text-sm text-green-900">
                  <span className="font-semibold">Verified By: </span>
                  {verifiers[project.id] ? (
                    <span className="font-bold">{verifiers[project.id]}</span>
                  ) : (
                    <span className="text-slate-600">
                      Verification record unavailable
                    </span>
                  )}
                </div>
              )}

              {project.description && (
                <p className="mt-4 whitespace-pre-line text-slate-700">
                  {project.description}
                </p>
              )}

              {project.technologies?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Technologies
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {project.technologies.map((technology, index) => (
                      <span
                        key={`${technology}-${index}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                      >
                        {technology}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {project.github_url && (
                <p className="mt-4">
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-violet-700 underline"
                  >
                    View GitHub repository
                  </a>
                </p>
              )}

              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <h3 className="font-semibold">Faculty feedback</h3>
                <p className="mt-2 whitespace-pre-line text-slate-600">
                  {project.faculty_feedback || 'No feedback has been added yet.'}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  onClick={() => navigate('project-detail', { id: project.id })}
                  className="text-sm font-semibold text-violet-700 hover:text-violet-900"
                >
                  View project details →
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
