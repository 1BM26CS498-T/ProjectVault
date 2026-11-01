import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into',
  'using', 'use', 'used', 'are', 'was', 'were', 'will', 'can',
  'its', 'our', 'their', 'your', 'has', 'have', 'had', 'not',
  'but', 'all', 'any', 'each', 'more', 'than', 'project', 'system',
  'application', 'based', 'which', 'who', 'how', 'what', 'when',
  'where', 'why', 'a', 'an', 'the', 'to', 'of', 'in', 'on', 'by',
  'or', 'as', 'at', 'is', 'be', 'it'
]);

function getTerms(project) {
  const text = [
    project.title || '',
    project.description || '',
    ...(Array.isArray(project.technologies) ? project.technologies : [])
  ].join(' ');

  return new Set(
    text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^a-z0-9+#.]+/g, ' ')
      .split(/\s+/)
      .map(term => term.trim())
      .filter(term => term.length > 2 && !STOP_WORDS.has(term))
  );
}

function compareProjects(proposal, existingProjects) {
  const proposalTerms = getTerms(proposal);

  return existingProjects.map(project => {
    const existingTerms = getTerms(project);
    const sharedTerms = [...proposalTerms].filter(term =>
      existingTerms.has(term)
    );

    const unionSize = new Set([
      ...proposalTerms,
      ...existingTerms
    ]).size;

    const titleTerms = getTerms({ title: proposal.title });
    const existingTitleTerms = getTerms({ title: project.title });
    const sharedTitleTerms = [...titleTerms].filter(term =>
      existingTitleTerms.has(term)
    );

    const titleUnion = new Set([
      ...titleTerms,
      ...existingTitleTerms
    ]).size;

    const textScore = unionSize
      ? (sharedTerms.length / unionSize) * 100
      : 0;

    const titleScore = titleUnion
      ? (sharedTitleTerms.length / titleUnion) * 100
      : 0;

    const technologySet = new Set(
      (proposal.technologies || []).map(value => value.toLowerCase().trim())
    );

    const sharedTechnologies = (project.technologies || []).filter(value =>
      technologySet.has(value.toLowerCase().trim())
    );

    // A simple comparison score, not an AI or plagiarism score.
    const score = Math.round(
      Math.min(100, textScore * 0.7 + titleScore * 0.3)
    );

    return {
      ...project,
      score,
      sharedTerms: sharedTerms.slice(0, 10),
      sharedTechnologies
    };
  }).sort((a, b) => b.score - a.score);
}

export default function SimilarCheckPage({ draftProposal, navigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setLoading(true);
      setError('');

      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('projects')
        .select('id, title, description, technologies, github_url, status')
        .in('status', ['approved', 'in_progress', 'submitted', 'verified']);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setProjects([]);
      } else {
        setProjects(
          (data || []).filter(
            project => String(project.id) !== String(draftProposal?.projectId)
          )
        );
      }

      setLoading(false);
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, [draftProposal?.projectId]);

  const results = useMemo(() => {
    if (!draftProposal) return [];

    const proposal = {
      title: draftProposal.title,
      description: [
        draftProposal.problem,
        draftProposal.solution,
        draftProposal.features,
        draftProposal.domain
      ].filter(Boolean).join(' '),
      technologies: (draftProposal.tech || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
    };

    return compareProjects(proposal, projects);
  }, [draftProposal, projects]);

  if (!draftProposal) {
    return (
      <section className="rounded-2xl border bg-white p-7">
        <h1 className="text-2xl font-bold">Similar Project Check</h1>
        <p className="mt-3 text-slate-600">No proposal draft found.</p>
        <button
          onClick={() => navigate('propose')}
          className="mt-4 rounded-lg bg-vio px-4 py-2 text-white"
        >
          Create proposal
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Similar Project Checker</h1>
        <p className="mt-2 text-sm text-slate-600">
          Compare your idea with existing visible projects before proceeding.
          Similarity scores are basic text comparisons, not plagiarism detection.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-bold">{draftProposal.title}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
          {[
            draftProposal.problem && `Problem: ${draftProposal.problem}`,
            draftProposal.solution && `Solution: ${draftProposal.solution}`,
            draftProposal.features && `Features: ${draftProposal.features}`,
            draftProposal.tech && `Technologies: ${draftProposal.tech}`
          ].filter(Boolean).join('\n\n')}
        </p>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Similarity results</h2>
          {!loading && (
            <span className="text-sm text-slate-500">
              {results.length} project(s) compared
            </span>
          )}
        </div>

        {loading && (
          <p className="mt-4 text-slate-600">Searching existing projects...</p>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Could not search projects: {error}
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <p className="mt-4 text-slate-600">
            No other visible approved or completed projects were found to compare.
          </p>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="mt-4 space-y-4">
            {results.map(project => (
              <article key={project.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-bold">{project.title}</h3>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-800">
                    {project.score}% text similarity
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {project.description || 'No description provided.'}
                </p>

                {project.sharedTerms.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      Shared terms
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {project.sharedTerms.map(term => (
                        <span
                          key={term}
                          className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {project.sharedTechnologies.length > 0 && (
                  <p className="mt-3 text-sm text-slate-600">
                    Shared technologies: {project.sharedTechnologies.join(', ')}
                  </p>
                )}

                {project.github_url && (
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block font-semibold text-violet-700 underline"
                  >
                    View GitHub Repository ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm leading-6 text-amber-900">
          A high score indicates shared wording or keywords, not necessarily
          duplicate functionality. Review the results and discuss any concerns
          with your faculty guide.
        </p>

        <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={event => setConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>
            I reviewed the similarity results and am ready to continue with
            my proposal.
          </span>
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={!confirmed}
            onClick={() => navigate('dashboard')}
            className="rounded-lg bg-vio px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
          <button
            onClick={() => navigate('propose')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold"
          >
            Edit Proposal
          </button>
          <button
            onClick={() => navigate('my-projects')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold"
          >
            View My Projects
          </button>
        </div>
      </div>
    </section>
  );
}
