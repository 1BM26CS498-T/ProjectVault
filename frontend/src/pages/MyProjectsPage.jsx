import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import {
  DEMO_VIDEO_MAX_BYTES,
  REPORT_MAX_BYTES,
  removeSubmissionFiles,
  uploadSubmissionFiles,
} from '../lib/projectFiles.js';

export default function MyProjectsPage({ navigate }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [verifiers, setVerifiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadForms, setUploadForms] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      if (!user?.id) {
        setProjects([]);
        setLoading(false);
        return;
      }

      if (!supabase) {
        setError('The ProjectVault API is unavailable. Check that the backend is running and connected to PostgreSQL.');
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const { data, error: fetchError } = await supabase
          .from('projects')
          .select('id, title, description, technologies, github_url, demo_url, team_name, report_path, demo_video_path, status, faculty_feedback, created_at, updated_at')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        if (!active) return;

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
            console.error('Could not load verifier names:', revErr);
          }
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError.message || 'Could not load projects.');
          setProjects([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [user?.id]);

  function updateUploadForm(projectId, field, value) {
    setUploadForms((previous) => ({
      ...previous,
      [projectId]: {
        ...(previous[projectId] || {}),
        [field]: value,
      },
    }));
  }

  async function submitFinalProject(event, project) {
    event.preventDefault();
    setUploadError('');
    setUploadMessage('');

    if (!supabase || !user?.id) {
      setUploadError('Please sign in with your ProjectVault account before submitting final files.');
      return;
    }

    const form = uploadForms[project.id] || {};
    if (!form.reportFile || !form.videoFile || !form.demoUrl?.trim()) {
      setUploadError('Add the final report, demo video, and a live demo link before submitting.');
      return;
    }
    if (form.reportFile.size > REPORT_MAX_BYTES) {
      setUploadError('The project report must be 20 MB or smaller.');
      return;
    }
    if (form.videoFile.size > DEMO_VIDEO_MAX_BYTES) {
      setUploadError('The demo video must be 500 MB or smaller.');
      return;
    }

    try {
      const demoUrl = new URL(form.demoUrl.trim());
      if (!['http:', 'https:'].includes(demoUrl.protocol)) throw new Error();
    } catch {
      setUploadError('Enter a valid demo link starting with https://.');
      return;
    }

    setUploadingId(project.id);
    setVideoProgress(0);

    let uploadedPaths = [];
    try {
      const uploads = await uploadSubmissionFiles({
        userId: user.id,
        projectId: project.id,
        reportFile: form.reportFile,
        videoFile: form.videoFile,
        onVideoProgress: setVideoProgress,
      });
      uploadedPaths = uploads.uploadedPaths;

      try {
        const { error: submitError } = await supabase.rpc('submit_project_final', {
          p_project_id: project.id,
          p_demo_url: form.demoUrl.trim(),
          p_report_path: uploads.reportPath,
          p_demo_video_path: uploads.videoPath,
        });
        if (submitError) throw submitError;
      } catch (updateError) {
        try {
          await removeSubmissionFiles(uploadedPaths);
        } catch (cleanupError) {
          throw new Error(`${updateError.message}. ${cleanupError.message}`);
        }
        throw updateError;
      }

      setProjects((current) => current.map((item) => item.id === project.id
        ? {
            ...item,
            demo_url: form.demoUrl.trim(),
            report_path: uploads.reportPath,
            demo_video_path: uploads.videoPath,
            status: 'submitted',
            updated_at: new Date().toISOString(),
          }
        : item));
      setUploadForms((previous) => ({ ...previous, [project.id]: {} }));
      setUploadMessage('Final report and demo submitted for faculty verification.');
    } catch (submitError) {
      setUploadError(submitError.message || 'Could not submit the final project files.');
    } finally {
      setUploadingId(null);
    }
  }

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
          {uploadError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {uploadError}
            </div>
          )}
          {uploadMessage && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {uploadMessage}
            </div>
          )}

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
                    {(project.status || '').toLowerCase() === 'submitted'
                      ? 'Final submission received. The project is awaiting faculty verification.'
                      : 'Proposal approved. Submit your final report and demo for faculty verification.'}
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

              {project.team_name && (
                <p className="mt-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Team: </span>{project.team_name}
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

              {['approved', 'changes_requested'].includes((project.status || '').toLowerCase()) && (
                <form
                  onSubmit={(event) => submitFinalProject(event, project)}
                  className="mt-5 rounded-xl border border-rose-200 bg-rose-50/60 p-5"
                >
                  <h3 className="font-semibold text-slate-900">Submit final project</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Upload your final report and demo video, then provide a working demo link for faculty verification.
                    Reports: PDF/DOC/DOCX up to 20 MB. Videos: MP4/MOV/WEBM/M4V up to 500 MB.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor={`report-${project.id}`} className="mb-1 block text-xs font-bold uppercase text-slate-600">
                        Final report
                      </label>
                      <input
                        id={`report-${project.id}`}
                        type="file"
                        required
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => updateUploadForm(project.id, 'reportFile', event.target.files?.[0] || null)}
                        className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {uploadForms[project.id]?.reportFile?.name || 'Required · max 20 MB'}
                      </p>
                    </div>

                    <div>
                      <label htmlFor={`video-${project.id}`} className="mb-1 block text-xs font-bold uppercase text-slate-600">
                        Demo video
                      </label>
                      <input
                        id={`video-${project.id}`}
                        type="file"
                        required
                        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
                        onChange={(event) => updateUploadForm(project.id, 'videoFile', event.target.files?.[0] || null)}
                        className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {uploadForms[project.id]?.videoFile
                          ? `${uploadForms[project.id].videoFile.name} · ${(uploadForms[project.id].videoFile.size / (1024 * 1024)).toFixed(1)} MB`
                          : 'Required · max 500 MB'}
                      </p>
                    </div>

                    <div>
                      <label htmlFor={`demo-${project.id}`} className="mb-1 block text-xs font-bold uppercase text-slate-600">
                        Live demo link
                      </label>
                      <input
                        id={`demo-${project.id}`}
                        type="url"
                        required
                        value={uploadForms[project.id]?.demoUrl ?? project.demo_url ?? ''}
                        onChange={(event) => updateUploadForm(project.id, 'demoUrl', event.target.value)}
                        placeholder="https://your-demo.example"
                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                      />
                    </div>
                  </div>

                  {uploadingId === project.id && (
                    <div className="mt-4" aria-live="polite">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span>Uploading demo video</span><span>{videoProgress}%</span>
                      </div>
                      <progress className="mt-1 h-2 w-full accent-vio" max="100" value={videoProgress} />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={uploadingId !== null}
                    className="mt-4 rounded-lg bg-vio px-5 py-2.5 text-sm font-bold text-white transition hover:bg-vio-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingId === project.id ? 'Uploading final submission…' : 'Submit for faculty verification'}
                  </button>
                </form>
              )}

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
