import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

export default function FinalVerificationPage({ navigate }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadProjects = useCallback(async () => {
    if (!user?.id || user.role !== 'faculty' || !supabase) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('projects')
      .select('id, title, description, technologies, github_url, student_id, faculty_guide_id, status, faculty_feedback, updated_at')
      .eq('faculty_guide_id', user.id)
      .in('status', ['approved', 'Approved', 'submitted', 'Submitted'])
      .order('updated_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setProjects([]);
    } else {
      setProjects(data || []);
    }

    setLoading(false);
  }, [user?.id, user?.role]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function reviewFinal(project, decision) {
    if (!supabase || !user?.id || savingId !== null) return;

    const comment = (comments[project.id] || '').trim();

    if (
      (decision === 'changes_requested' || decision === 'rejected') &&
      !comment
    ) {
      setError('Please provide feedback when requesting changes or rejecting a submission.');
      return;
    }

    setSavingId(project.id);
    setError('');
    setMessage('');

    try {
      const { error: reviewError } = await supabase
        .from('project_reviews')
        .insert({
          project_id: project.id,
          faculty_id: user.id,
          review_type: 'final',
          decision,
          comments: comment || null,
        });

      if (reviewError) throw reviewError;

      const statusByDecision = {
        verified: 'verified',
        rejected: 'rejected',
        changes_requested: 'changes_requested',
      };

      const { data: updatedProject, error: updateError } = await supabase
        .from('projects')
        .update({
          status: statusByDecision[decision],
          faculty_feedback: comment || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)
        .eq('faculty_guide_id', user.id)
        .in('status', ['approved', 'Approved', 'submitted', 'Submitted'])
        .select('id')
        .maybeSingle();

      if (updateError) {
        throw new Error(
          'The review record was saved, but the project status update failed: ' +
          updateError.message
        );
      }

      if (!updatedProject) {
        throw new Error(
          'The review record was saved, but the project status was not updated. Refresh and check the project.'
        );
      }

      const labels = {
        verified: 'Final project verified successfully.',
        rejected: 'Final submission rejected. Feedback saved.',
        changes_requested: 'Changes requested. Feedback saved.',
      };

      setMessage(labels[decision]);
      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );
    } catch (err) {
      setError(err.message || 'Could not save the final review.');
    } finally {
      setSavingId(null);
    }
  }

  if (user?.role !== 'faculty') {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Final Verification</h1>
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
          <h1 className="text-3xl font-bold">Final Verification</h1>
          <p className="mt-2 text-slate-600">
            Review completed projects assigned to you and record the final decision.
          </p>
        </div>

        <button
          onClick={loadProjects}
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
        <p className="mt-6 text-slate-600">Loading final submissions...</p>
      ) : projects.length === 0 ? (
        <div className="mt-6 rounded-xl border bg-white p-8 text-center">
          <h2 className="text-xl font-semibold">No projects awaiting final verification</h2>
          <p className="mt-2 text-slate-600">
            Approved projects assigned to you will appear here for final verification.
          </p>
          <button
            onClick={loadProjects}
            className="mt-5 rounded-lg bg-violet-700 px-5 py-2.5 font-semibold text-white"
          >
            Check again
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {projects.map((project) => (
            <article key={project.id} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-bold">{project.title}</h2>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  Awaiting final verification
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {project.description}
              </p>

              <p className="mt-3 break-all text-sm text-slate-500">
                Student ID: {project.student_id}
              </p>

              {project.technologies?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold">Technologies</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {project.technologies.map((technology, index) => (
                      <span
                        key={`${technology}-${index}`}
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
                  <span className="font-semibold">Final repository: </span>
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
                  htmlFor={`final-feedback-${project.id}`}
                  className="block text-sm font-semibold text-slate-700"
                >
                  Feedback for student
                </label>
                <textarea
                  id={`final-feedback-${project.id}`}
                  value={comments[project.id] || ''}
                  onChange={(event) =>
                    setComments((current) => ({
                      ...current,
                      [project.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={3000}
                  placeholder="Enter verification notes or explain required changes..."
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-600"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={savingId !== null}
                  onClick={() => reviewFinal(project, 'verified')}
                  className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {savingId === project.id ? 'Saving...' : 'Verify Project'}
                </button>

                <button
                  disabled={savingId !== null}
                  onClick={() => reviewFinal(project, 'changes_requested')}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  Request Changes
                </button>

                <button
                  disabled={savingId !== null}
                  onClick={() => reviewFinal(project, 'rejected')}
                  className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  Reject Final Submission
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
