import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

export default function ProjectDetailPage({ id, navigate }) {
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [verifierName, setVerifierName] = useState(null);
  const [verificationDate, setVerificationDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProjectDetails() {
      if (!id) {
        setError('No project selected.');
        setLoading(false);
        return;
      }

      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setVerifierName(null);
      setVerificationDate(null);

      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select(
            'id, title, description, technologies, github_url, student_id, faculty_guide_id, status, faculty_feedback, created_at, updated_at'
          )
          .eq('id', id)
          .maybeSingle();

        if (projectError) throw projectError;
        if (!projectData) {
          throw new Error('Project not found.');
        }

        if (!active) return;
        setProject(projectData);

        const isVerified =
          (projectData.status || '').toLowerCase() === 'verified';

        if (isVerified) {
          try {
            // Retrieve the verification record from project_reviews
            const { data: reviewData, error: reviewError } = await supabase
              .from('project_reviews')
              .select('faculty_id, reviewed_at, review_type, decision')
              .eq('project_id', id)
              .eq('review_type', 'final')
              .eq('decision', 'verified')
              .order('reviewed_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (reviewError) {
              console.error('Final verification lookup failed:', reviewError);
              throw reviewError;
            }

            if (reviewData?.faculty_id) {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', reviewData.faculty_id)
                .maybeSingle();

              if (profileError) {
                console.error('Verifier profile lookup failed:', profileError);
                throw profileError;
              }

              if (active && profileData?.full_name) {
                setVerifierName(profileData.full_name);
              } else if (active) {
                console.error(
                  'Final review exists, but no matching profile full_name was found.',
                  { facultyId: reviewData.faculty_id }
                );
              }

              if (active && reviewData.reviewed_at) {
                setVerificationDate(reviewData.reviewed_at);
              }
            } else {
              console.error(
                'No visible final review with decision verified was found.',
                { projectId: id }
              );

              if (active && projectData.updated_at) {
                setVerificationDate(projectData.updated_at);
              }
            }
          } catch (reviewErr) {
            console.warn('Could not load verifier information:', reviewErr);
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load project details.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProjectDetails();

    return () => {
      active = false;
    };
  }, [id]);

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

  function formatDate(dateString) {
    if (!dateString) return 'Date unavailable';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return 'Date unavailable';
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Date unavailable';
    }
  }

  const statusLower = (project?.status || '').toLowerCase();
  const isVerified = statusLower === 'verified';
  const isApproved = statusLower === 'approved' || statusLower === 'submitted';

  let techList = [];
  if (Array.isArray(project?.technologies)) {
    techList = project.technologies;
  } else if (
    typeof project?.technologies === 'string' &&
    project.technologies.trim()
  ) {
    techList = project.technologies
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <button
        onClick={() => navigate('my-projects')}
        className="text-sm font-semibold text-violet-700 hover:text-violet-900"
      >
        â† Back to my projects
      </button>

      {loading && (
        <p className="mt-6 text-slate-600">Loading project details...</p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {!loading && !error && project && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                {project.title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Submitted on {formatDate(project.created_at)}
              </p>
            </div>

            <span
              className={`rounded-full px-3.5 py-1 text-sm font-semibold ${statusStyle(project.status)}`}
            >
              {formatStatus(project.status)}
            </span>
          </div>

          {/* Verification Status & Verifier Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold text-slate-800">Proposal Approval: </span>
                {isApproved || isVerified ? (
                  <span className="font-semibold text-green-700">Approved</span>
                ) : (
                  <span className="text-slate-600">{formatStatus(project.status)}</span>
                )}
              </p>
              <p className="text-sm">
                <span className="font-semibold text-slate-800">Final Verification: </span>
                {isVerified ? (
                  <span className="font-bold text-green-800">Completed</span>
                ) : isApproved ? (
                  <span className="font-medium text-blue-700">
                    Awaiting final verification
                  </span>
                ) : (
                  <span className="text-slate-500">Pending proposal approval</span>
                )}
              </p>
            </div>

            <p className="text-sm">
              <span className="font-semibold text-slate-800">Verified By: </span>
              {isVerified ? (
                verifierName ? (
                  <span className="font-bold text-slate-900">{verifierName}</span>
                ) : (
                  <span className="text-slate-600">
                    Verification record unavailable
                  </span>
                )
              ) : (
                <span className="text-slate-500">Not yet verified</span>
              )}
            </p>

            {isVerified && verificationDate && (
              <p className="text-xs text-slate-500">
                Verification date: {formatDate(verificationDate)}
              </p>
            )}

            {isApproved && !isVerified && (
              <p className="text-xs text-slate-500">
                Your proposal has been approved. Once you complete the project, your faculty guide will perform final verification, and their name will appear here.
              </p>
            )}
          </div>

          {project.description && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">
                {project.description}
              </p>
            </div>
          )}

          {techList.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Technologies
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {techList.map((technology, index) => (
                  <span
                    key={`${technology}-${index}`}
                    className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-800"
                  >
                    {technology}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.github_url && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Repository
              </h2>
              <a
                href={project.github_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block break-all font-semibold text-violet-700 underline hover:text-violet-900"
              >
                {project.github_url}
              </a>
            </div>
          )}

          {project.faculty_feedback && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-800">
                Faculty Feedback
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {project.faculty_feedback}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}


