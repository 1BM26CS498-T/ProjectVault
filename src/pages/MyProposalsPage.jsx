import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

export default function MyProposalsPage({ navigate }) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadProposals = useCallback(async () => {
    if (!user?.id || user.role !== 'faculty' || !supabase) {
      setProposals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('projects')
      .select('id, title, description, technologies, github_url, student_id, faculty_guide_id, status, created_at')
      .eq('faculty_guide_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setProposals([]);
    } else {
      setProposals(data || []);
    }

    setLoading(false);
  }, [user?.id, user?.role]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  async function reviewProposal(project, decision) {
    if (!supabase || !user?.id) return;

    setError('');
    setMessage('');

    const comments = (feedback[project.id] || '').trim();

    if (decision === 'changes_requested' && !comments) {
      setError('Please explain what changes the student needs to make.');
      return;
    }

    setSavingId(project.id);

    try {
      const { error: reviewError } = await supabase
        .from('project_reviews')
        .insert({
          project_id: project.id,
          faculty_id: user.id,
          review_type: 'proposal',
          decision,
          comments: comments || null,
        });

      if (reviewError) throw reviewError;

      const statusByDecision = {
        approved: 'approved',
        rejected: 'rejected',
        changes_requested: 'changes_requested',
      };

      const { data: updatedProject, error: updateError } = await supabase
        .from('projects')
        .update({
          status: statusByDecision[decision],
          faculty_feedback: comments || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)
        .eq('faculty_guide_id', user.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (updateError) {
        throw new Error(
          'The review was recorded, but the project status could not be updated: ' +
          updateError.message
        );
      }

      if (!updatedProject) {
        throw new Error(
          'The review was recorded, but the project status was not updated. Refresh and check the project.'
        );
      }

      const labels = {
        approved: 'Proposal approved.',
        rejected: 'Proposal rejected.',
        changes_requested: 'Changes requested from the student.',
      };

      setMessage(labels[decision]);
      setProposals((current) => current.filter((item) => item.id !== project.id));
    } catch (err) {
      setError(err.message || 'Could not save the review.');
    } finally {
      setSavingId(null);
    }
  }

  if (user?.role !== 'faculty') {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Faculty Proposal Reviews</h1>
        <p className="mt-2 text-slate-600">
          This page is available to faculty members only.
        </p>
        <button
          onClick={() => navigate('dashboard')}
          className="mt-4 rounded-lg border px-4 py-2"
        >
          Back to dashboard
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Proposal Reviews</h1>
          <p className="mt-2 text-slate-600">
            Review project ideas assigned to you and record your decision.
          </p>
        </div>

        <button
          onClick={loadProposals}
          disabled={loading}
          className="rounded-lg border bg-white px-4 py-2 font-medium disabled:opacity-60"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-800">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-slate-600">Loading assigned proposals...</p>
      ) : proposals.length === 0 ? (
        <div className="mt-6 rounded-xl border bg-white p-8 text-center">
          <h2 className="text-xl font-semibold">No proposals assigned yet</h2>
          <p className="mt-2 text-slate-600">
            New proposals assigned to you will appear here when students submit them.
          </p>
          <button
            onClick={loadProposals}
            className="mt-5 rounded-lg bg-violet-700 px-5 py-2.5 font-semibold text-white"
          >
            Check again
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {proposals.map((project) => (
            <article key={project.id} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-bold">{project.title}</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  Pending review
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {project.description}
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Student ID: {project.student_id}
              </p>

              {Array.isArray(project.technologies) && project.technologies.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700">Technologies</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {project.technologies.map((technology) => (
                      <span
                        key={technology}
                        className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800"
                      >
                        {technology}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {project.github_url && (
                <p className="mt-4 break-all text-sm">
                  <span className="font-semibold">GitHub: </span>
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-700 underline"
                  >
                    {project.github_url}
                  </a>
                </p>
              )}

              <div className="mt-5">
                <label
                  htmlFor={`feedback-${project.id}`}
                  className="block text-sm font-semibold text-slate-700"
                >
                  Feedback for student
                </label>
                <textarea
                  id={`feedback-${project.id}`}
                  value={feedback[project.id] || ''}
                  onChange={(event) =>
                    setFeedback((current) => ({
                      ...current,
                      [project.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={3000}
                  placeholder="Write feedback or explain requested changes..."
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-600"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={savingId !== null}
                  onClick={() => reviewProposal(project, 'approved')}
                  className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {savingId === project.id ? 'Saving...' : 'Approve'}
                </button>

                <button
                  disabled={savingId !== null}
                  onClick={() => reviewProposal(project, 'changes_requested')}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  Request Changes
                </button>

                <button
                  disabled={savingId !== null}
                  onClick={() => reviewProposal(project, 'rejected')}
                  className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('dashboard')}
        className="mt-6 rounded-lg border bg-white px-4 py-2"
      >
        Back to dashboard
      </button>
    </section>
  );
}
