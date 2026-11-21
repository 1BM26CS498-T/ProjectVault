import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const projectImages = [
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1000&q=80',
];

function getTechnologies(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export default function SearchProjectsPage({ navigate }) {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collegeLookupError, setCollegeLookupError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setLoading(true);
      setError('');
      setCollegeLookupError('');

      if (!supabase) {
        setError('The ProjectVault API is unavailable. Check that the backend is running and connected to PostgreSQL.');
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error: queryError } = await supabase
          .from('projects')
          .select('id, title, description, technologies, github_url, demo_url, college_id, team_name, created_at, status', { auth: false })
          .in('status', ['approved', 'verified', 'Approved', 'Verified'])
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;

        const projectRows = data || [];
        const collegeIds = [...new Set(projectRows.map((project) => project.college_id).filter(Boolean))];
        let collegeNames = {};

        if (collegeIds.length > 0) {
          const { data: colleges, error: collegesError } = await supabase
            .from('colleges')
            .select('id, college_name', { auth: false })
            .in('id', collegeIds);

          if (collegesError) {
            if (active) setCollegeLookupError(`Project colleges could not be loaded: ${collegesError.message}`);
          } else {
            collegeNames = Object.fromEntries(
              (colleges || []).map((college) => [String(college.id), college.college_name])
            );
          }
        }

        if (active) {
          setProjects(projectRows.map((project) => ({
            ...project,
            collegeName: collegeNames[String(project.college_id)] || '',
          })));
        }
      } catch (loadError) {
        if (active) {
          setError(`Could not load approved projects: ${loadError.message || 'Check your database connection and access policies.'}`);
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
  }, [retry]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;

    return projects.filter((project) => [
      project.title,
      project.description,
      project.team_name,
      project.collegeName,
      ...getTechnologies(project.technologies),
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [projects, search]);

  const sortedProjects = useMemo(() => [...filteredProjects].sort((a, b) => {
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'college') return (a.collegeName || '').localeCompare(b.collegeName || '') || (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'technology') {
      const techA = getTechnologies(a.technologies).join(', ');
      const techB = getTechnologies(b.technologies).join(', ');
      return techA.localeCompare(techB) || (a.title || '').localeCompare(b.title || '');
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  }), [filteredProjects, sortBy]);

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#51465a] px-6 py-9 text-white shadow-xl sm:px-9">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1800&q=80')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#383440]/90 via-[#62566b]/80 to-[#688178]/70" />
        <p className="text-sm font-bold uppercase tracking-[.16em] text-lavender-200">Explore the collection</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Projects built by curious minds</h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-50">Browse approved student work from participating colleges, see the tools behind it, and find inspiration for your next idea.</p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Project catalogue</h2>
          <p className="mt-1 text-sm text-slate-500">{loading ? 'Fetching approved projects…' : `${filteredProjects.length} ${filteredProjects.length === 1 ? 'project' : 'projects'} found`}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label>
            <span className="sr-only">Search all college projects</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project, college, team, or technology"
              className="w-full rounded-xl border border-stone-300 bg-[#fffdfb] px-4 py-3 text-sm focus:border-violet-400"
            />
          </label>
          <label>
            <span className="sr-only">Sort projects</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm"
            >
              <option value="newest">Sort: Newest</option>
              <option value="title">Sort: Project name</option>
              <option value="college">Sort: College name</option>
              <option value="technology">Sort: Technology</option>
            </select>
          </label>
        </div>
      </section>

      {collegeLookupError && (
        <p role="status" className="rounded-xl border border-sand-200 bg-sand-50 p-4 text-sm text-sand-800">
          {collegeLookupError} Projects are still shown, but college sorting may be incomplete.
        </p>
      )}

      {loading && (
        <div role="status" className="flex items-center gap-3 rounded-2xl bg-white p-6 text-slate-600 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          Loading approved projects…
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-peach-200 bg-peach-50 p-5 text-peach-900">
          <p className="font-bold">The project list couldn’t be loaded.</p>
          <p className="mt-1 text-sm">{error}</p>
          <button onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800">Try again</button>
        </div>
      )}

      {!loading && !error && filteredProjects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-lavender-50 text-2xl text-violet-700" aria-hidden="true">⌕</span>
          <h2 className="mt-4 text-xl font-black text-slate-900">{projects.length ? 'No matching projects' : 'No approved projects yet'}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{projects.length ? 'Try another search term or technology.' : 'Approved projects will show up here once faculty review is complete.'}</p>
          {search && <button onClick={() => setSearch('')} className="mt-4 font-bold text-violet-700">Clear search</button>}
        </div>
      )}

      {!loading && !error && filteredProjects.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project, index) => {
            const technologies = getTechnologies(project.technologies);
            const isVerified = project.status?.toLowerCase() === 'verified';

            return (
              <article key={project.id} className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-lavender-200 hover:shadow-xl hover:shadow-lavender-900/10">
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-violet-700 to-teal-600">
                  <img
                    src={projectImages[index % projectImages.length]}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#383440]/70 via-transparent to-transparent" />
                  <span className="absolute bottom-4 left-4 rounded-full border border-white/30 bg-[#383440]/50 px-3 py-1 text-xs font-bold capitalize text-white backdrop-blur">
                    {isVerified ? 'Verified project' : 'Approved project'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="line-clamp-2 text-xl font-black text-slate-950">{project.title}</h2>
                  {project.collegeName && (
                    <p className="mt-1 text-sm font-semibold text-teal-700">{project.collegeName}</p>
                  )}
                  {project.team_name && (
                    <p className="mt-1 text-xs font-semibold text-violet-600">Team: {project.team_name}</p>
                  )}
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">{project.description || 'No project description was provided.'}</p>
                  {technologies.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {technologies.slice(0, 5).map((technology, itemIndex) => (
                        <span key={`${technology}-${itemIndex}`} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{technology}</span>
                      ))}
                      {technologies.length > 5 && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-slate-600">+{technologies.length - 5}</span>}
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
                    <button onClick={() => navigate('project-detail', { id: project.id })} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800">Project details</button>
                    {project.demo_url && <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-violet-700 hover:underline">Live demo ↗</a>}
                    {project.github_url && <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-600 hover:text-slate-900">Repository ↗</a>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
