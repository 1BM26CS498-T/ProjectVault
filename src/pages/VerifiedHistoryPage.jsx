import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import Modal from '../components/Modal.jsx';

export default function VerifiedHistoryPage({ navigate }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);

  const loadVerifiedProjects = useCallback(async () => {
    if (!user?.id || user.role !== 'faculty' || !supabase) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Query projects verified by the currently logged-in faculty member
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(
          'id, title, description, technologies, github_url, student_id, faculty_guide_id, status, faculty_feedback, created_at, updated_at'
        )
        .eq('faculty_guide_id', user.id)
        .in('status', ['verified', 'Verified'])
        .order('updated_at', { ascending: false });

      if (projectError) throw projectError;

      const rawProjects = projectData || [];

      if (rawProjects.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // Fetch student profiles for student names if student_ids exist
      const studentIds = [
        ...new Set(rawProjects.map((p) => p.student_id).filter(Boolean)),
      ];
      let profilesMap = {};
      if (studentIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds);

          if (profilesData) {
            profilesMap = Object.fromEntries(
              profilesData.map((profile) => [profile.id, profile])
            );
          }
        } catch (profileErr) {
          console.warn('Could not load student profiles:', profileErr);
        }
      }

      // Fetch team members if project_team_members table is present
      const projectIds = rawProjects.map((p) => p.id);
      let teamMap = {};
      try {
        const { data: teamData } = await supabase
          .from('project_team_members')
          .select('project_id, member_name')
          .in('project_id', projectIds);

        if (teamData) {
          teamData.forEach((row) => {
            if (!teamMap[row.project_id]) teamMap[row.project_id] = [];
            if (row.member_name) teamMap[row.project_id].push(row.member_name);
          });
        }
      } catch (teamErr) {
        console.warn('Could not load team members:', teamErr);
      }

      // Fetch final review records to retrieve specific verification date and feedback
      let reviewMap = {};
      try {
        const { data: reviewData } = await supabase
          .from('project_reviews')
          .select('project_id, faculty_id, review_type, decision, comments, created_at')
          .eq('faculty_id', user.id)
          .eq('review_type', 'final')
          .eq('decision', 'verified')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false });

        if (reviewData) {
          reviewData.forEach((rev) => {
            if (!reviewMap[rev.project_id]) {
              reviewMap[rev.project_id] = rev;
            }
          });
        }
      } catch (revErr) {
        console.warn('Could not load project reviews:', revErr);
      }

      // Combine and format the data
      const combined = rawProjects.map((project) => {
        const studentProfile = project.student_id
          ? profilesMap[project.student_id]
          : null;
        const review = reviewMap[project.id];
        const team =
          teamMap[project.id] ||
          (Array.isArray(project.team_members) ? project.team_members : []);

        const verificationDate =
          review?.created_at || project.updated_at || project.created_at;

        let techList = [];
        if (Array.isArray(project.technologies)) {
          techList = project.technologies;
        } else if (
          typeof project.technologies === 'string' &&
          project.technologies.trim()
        ) {
          techList = project.technologies
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }

        return {
          ...project,
          student_name: studentProfile?.full_name || null,
          student_email: studentProfile?.email || null,
          team_members: team,
          technologies: techList,
          verification_date: verificationDate,
          verification_comments:
            review?.comments || project.faculty_feedback || null,
        };
      });

      setProjects(combined);
    } catch (err) {
      console.error('Error loading verified history:', err);
      setError(err.message || 'Unable to load verified project history.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    void loadVerifiedProjects();
  }, [loadVerifiedProjects]);

  function formatVerificationDate(dateString) {
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

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;

    return projects.filter((project) => {
      const searchContent = [
        project.title,
        project.description,
        project.student_name,
        project.student_email,
        ...(project.team_members || []),
        ...(project.technologies || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchContent.includes(term);
    });
  }, [projects, search]);

  if (user?.role !== 'faculty') {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Verified Project History</h1>
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
          <h1 className="text-3xl font-bold">Verified Project History</h1>
          <p className="mt-2 text-slate-600">
            Review completed projects that you have verified.
          </p>
        </div>

        <button
          onClick={loadVerifiedProjects}
          disabled={loading}
          className="rounded-lg border bg-white px-4 py-2 font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="mt-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, student, description, or technology..."
            aria-label="Search verified projects"
            className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
          />
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-slate-600">Loading verified project history...</p>
      ) : projects.length === 0 ? (
        <div className="mt-6 rounded-xl border bg-white p-8 text-center">
          <h2 className="text-xl font-semibold">No verified projects yet</h2>
          <p className="mt-2 text-slate-600">
            Completed projects that you evaluate and verify will appear here in your
            verification history.
          </p>
          <button
            onClick={() => navigate('final-verification')}
            className="mt-5 rounded-lg bg-violet-700 px-5 py-2.5 font-semibold text-white hover:bg-violet-800"
          >
            Go to Final Verification
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="mt-6 rounded-xl border bg-white p-6 text-center text-slate-600">
          No verified projects matched &quot;{search}&quot;.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-slate-600">
            {filteredProjects.length} verified project
            {filteredProjects.length === 1 ? '' : 's'} found
          </p>

          {filteredProjects.map((project) => (
            <article
              key={project.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {project.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Verified on {formatVerificationDate(project.verification_date)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                    ✓ Verified
                  </span>
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    View Details
                  </button>
                </div>
              </div>

              {/* Student or team information */}
              {(project.student_name ||
                project.team_members?.length > 0 ||
                project.student_id) && (
                <div className="mt-3 text-sm text-slate-600">
                  {project.student_name && (
                    <p>
                      <span className="font-semibold text-slate-700">Student: </span>
                      {project.student_name}
                      {project.student_email && (
                        <span className="ml-1 text-xs text-slate-500">
                          ({project.student_email})
                        </span>
                      )}
                    </p>
                  )}
                  {!project.student_name && project.student_id && (
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">Student ID: </span>
                      {project.student_id}
                    </p>
                  )}
                  {project.team_members?.length > 0 && (
                    <p className="mt-1">
                      <span className="font-semibold text-slate-700">Team: </span>
                      {project.team_members.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {project.description && (
                <p className="mt-3 whitespace-pre-wrap text-slate-700">
                  {project.description}
                </p>
              )}

              {project.technologies?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700">Technologies</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {project.technologies.map((tech, index) => (
                      <span
                        key={`${tech}-${index}`}
                        className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {project.github_url && (
                <p className="mt-4 break-all text-sm">
                  <span className="font-semibold text-slate-700">GitHub Repository: </span>
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-700 underline hover:text-violet-900"
                  >
                    {project.github_url}
                  </a>
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        open={Boolean(selectedProject)}
        title="Verified Project Details"
        onClose={() => setSelectedProject(null)}
      >
        {selectedProject && (
          <div className="space-y-4">
            <div>
              <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                ✓ Verified
              </span>
              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {selectedProject.title}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Verified on{' '}
                {formatVerificationDate(selectedProject.verification_date)}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Student & Team
              </h4>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedProject.student_name ||
                  (selectedProject.student_id
                    ? `Student ID: ${selectedProject.student_id}`
                    : 'Student not specified')}
              </p>
              {selectedProject.student_email && (
                <p className="text-xs text-slate-500">
                  {selectedProject.student_email}
                </p>
              )}
              {selectedProject.team_members?.length > 0 && (
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-semibold">Team members: </span>
                  {selectedProject.team_members.join(', ')}
                </p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
              </h4>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {selectedProject.description || 'No description provided.'}
              </p>
            </div>

            {selectedProject.technologies?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Technologies
                </h4>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedProject.technologies.map((tech, idx) => (
                    <span
                      key={`${tech}-${idx}`}
                      className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedProject.github_url && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  GitHub Repository
                </h4>
                <a
                  href={selectedProject.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block break-all text-sm font-medium text-violet-700 underline hover:text-violet-900"
                >
                  {selectedProject.github_url}
                </a>
              </div>
            )}

            {selectedProject.verification_comments && (
              <div className="rounded-lg bg-slate-50 p-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Verification Feedback / Notes
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {selectedProject.verification_comments}
                </p>
              </div>
            )}

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedProject(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <button
        onClick={() => navigate('dashboard')}
        className="mt-6 rounded-lg border bg-white px-4 py-2 hover:bg-slate-50"
      >
        Back to dashboard
      </button>
    </section>
  );
}
