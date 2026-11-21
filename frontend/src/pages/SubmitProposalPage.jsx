
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

export default function SubmitProposalPage({ setDraftProposal, navigate }) {
  const { user } = useAuth();

  const [faculty, setFaculty] = useState([]);
  const [loadingFaculty, setLoadingFaculty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    problem: '',
    solution: '',
    features: '',
    tech: '',
    domain: 'Web Development',
    repo: '',
    demoUrl: '',
    teamName: '',
    team: '',
    guideId: ''
  });

  useEffect(() => {
    async function loadFaculty() {
      if (!user?.id || !supabase) {
        setError('The ProjectVault API is unavailable or you are not logged in.');
        setLoadingFaculty(false);
        return;
      }

      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, college_id')
          .eq('role', 'faculty')
          .eq('college_id', user.collegeId);

        if (profileError) throw profileError;

        setFaculty(data || []);

        if (data?.length) {
          setForm(previous => ({
            ...previous,
            guideId: previous.guideId || data[0].id
          }));
        }
      } catch (err) {
        setError(`Could not load faculty: ${err.message}`);
      } finally {
        setLoadingFaculty(false);
      }
    }

    loadFaculty();
  }, [user?.id, user?.collegeId]);

  if (!user || user.role !== 'student') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h3 className="font-bold">Student Access Only</h3>
        <p className="mt-1 text-sm">
          Only students can submit project proposals.
        </p>
      </div>
    );
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (
      !form.title.trim() ||
      !form.problem.trim() ||
      !form.solution.trim() ||
      !form.features.trim() ||
      !form.tech.trim() ||
      !form.teamName.trim()
    ) {
      setError('Please fill out all required fields.');
      return;
    }

    if (!form.repo.trim()) {
      setError('GitHub Repository URL is required.');
      return;
    }

    if (
      !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(form.repo.trim())
    ) {
      setError('Enter a valid GitHub repository URL.');
      return;
    }

    const teammates = form.team
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);

    if (teammates.length === 0) {
      setError('Please enter at least one teammate.');
      return;
    }

    if (!form.guideId) {
      setError('Please select a faculty guide.');
      return;
    }

    if (
      form.repo.trim() &&
      !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(form.repo.trim())
    ) {
      setError('Enter a valid GitHub repository URL.');
      return;
    }

    if (form.demoUrl.trim()) {
      try {
        const demoUrl = new URL(form.demoUrl.trim());
        if (!['http:', 'https:'].includes(demoUrl.protocol)) {
          throw new Error();
        }
      } catch {
        setError('Enter a valid demo link starting with https://.');
        return;
      }
    }

    if (!supabase || !user.collegeId) {
      setError('The ProjectVault API is unavailable. Check your environment settings.');
      return;
    }

    setSaving(true);

    try {
      const selectedFaculty = faculty.find(
        member => member.id === form.guideId
      );

      if (!selectedFaculty) {
        throw new Error('Please select a valid faculty member from your college.');
      }

      // Combine fields because the current projects table stores
      // the project description in one column.
      const description = [
        `Domain: ${form.domain}`,
        `Problem Statement:\n${form.problem.trim()}`,
        `Proposed Solution:\n${form.solution.trim()}`,
        `Key Features:\n${form.features.trim()}`
      ].join('\n\n');

      const technologies = form.tech
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

      const projectId = crypto.randomUUID();
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          id: projectId,
          college_id: user.collegeId,
          title: form.title.trim(),
          description,
          technologies,
          team_name: form.teamName.trim(),
          github_url: form.repo.trim(),
          demo_url: form.demoUrl.trim() || null,
          student_id: user.id,
          faculty_guide_id: selectedFaculty.id,
          status: 'pending',
          faculty_feedback: null
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Save teammates separately, linked to the new project.

      if (teammates.length > 0) {
        const teamRows = teammates.map(memberName => ({
          project_id: project.id,
          member_name: memberName,
          member_email: ''
        }));

        const { error: teamError } = await supabase
          .from('project_team_members')
          .insert(teamRows);

        if (teamError) {
          throw new Error(
            `Project saved, but teammates could not be saved: ${teamError.message}`
          );
        }
      }

      const draft = {
        ...form,
        team: teammates,
        teamName: form.teamName.trim(),
        studentName: user.name,
        studentId: user.id,
        college: user.college,
        projectId: project.id,
        facultyName: selectedFaculty.full_name
      };

      setDraftProposal(draft);
      navigate('similar');
    } catch (err) {
      setError(err.message || 'Could not save the proposal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">
          Submit Project Proposal
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Submit your project idea to a faculty guide in your college.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Project Title *
          </label>
          <input
            name="title"
            value={form.title}
            onChange={updateField}
            required
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            placeholder="Enter project title"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
              Faculty Guide *
            </label>
            <select
              name="guideId"
              value={form.guideId}
              onChange={updateField}
              required
              disabled={loadingFaculty || faculty.length === 0}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
            >
              <option value="">
                {loadingFaculty ? 'Loading faculty...' : 'Select faculty'}
              </option>
              {faculty.map(member => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
            {!loadingFaculty && faculty.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                No faculty found for your college.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
              Domain
            </label>
            <select
              name="domain"
              value={form.domain}
              onChange={updateField}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
            >
              <option>Web Development</option>
              <option>Mobile Development</option>
              <option>Machine Learning</option>
              <option>Data Science</option>
              <option>IoT</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Problem Statement *
          </label>
          <textarea
            name="problem"
            value={form.problem}
            onChange={updateField}
            required
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Proposed Solution *
          </label>
          <textarea
            name="solution"
            value={form.solution}
            onChange={updateField}
            required
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Key Features *
          </label>
          <textarea
            name="features"
            value={form.features}
            onChange={updateField}
            required
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Technologies (comma-separated) *
          </label>
          <input
            name="tech"
            value={form.tech}
            onChange={updateField}
            required
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            placeholder="React, Node.js, PostgreSQL"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            GitHub Repository URL *
          </label>
          <input
            name="repo"
            type="url"
            value={form.repo}
            onChange={updateField}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            placeholder="https://github.com/username/repository"
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-stone-50 p-5">
          <div>
            <p className="text-sm font-bold text-slate-900">Prototype demo</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">If you have a working prototype, share its demo link here. You can upload the final report and recorded demo video after your proposal is approved.</p>
          </div>
          <div className="mt-4">
            <label htmlFor="demoUrl" className="mb-1 block text-xs font-bold uppercase text-slate-600">Live demo link (optional)</label>
            <input
              id="demoUrl"
              name="demoUrl"
              type="url"
              value={form.demoUrl || ''}
              onChange={(event) => setForm((previous) => ({ ...previous, demoUrl: event.target.value }))}
              placeholder="https://your-demo.example"
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            />
          </div>
        </section>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Team name *
          </label>
          <input
            name="teamName"
            value={form.teamName}
            onChange={updateField}
            required
            maxLength={100}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            placeholder="e.g. The Innovators"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Teammates (comma-separated) *
          </label>
          <input
            name="team"
            value={form.team}
            onChange={updateField}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            placeholder="Student One, Student Two"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loadingFaculty || faculty.length === 0}
            className="rounded-lg bg-vio px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Check Similar Projects →'}
          </button>
        </div>
      </form>
    </div>
  );
}
