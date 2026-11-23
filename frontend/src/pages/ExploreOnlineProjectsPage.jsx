import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function ExploreOnlineProjectsPage() {
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();

    if (!search.trim()) return;

    setLoading(true);
    setError('');
    setSearched(true);

    const result = await supabase.onlineProjects.search(search.trim());

    if (result.error) {
      setError(result.error.message || 'Unable to load projects.');
      setProjects([]);
    } else {
      setProjects(result.data?.projects || []);
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
          ProjectVault
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Explore Online Projects
        </h1>

        <p className="mt-2 text-slate-600">
          Discover real projects from developers around the world.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects... (e.g. AI chatbot, hospital management)"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <button
            type="submit"
            disabled={loading || !search.trim()}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search Projects'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="py-12 text-center text-slate-500">
          Searching GitHub projects...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && searched && !error && projects.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h3 className="font-semibold text-slate-900">No projects found</h3>
          <p className="mt-2 text-sm text-slate-500">
            Try another search term.
          </p>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              Search Results
            </h2>

            <span className="text-sm text-slate-500">
              {projects.length} projects
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-4 flex items-center gap-3">
                  {project.avatar && (
                    <img
                      src={project.avatar}
                      alt=""
                      className="h-10 w-10 rounded-full"
                    />
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-500">
                      {project.owner}
                    </p>

                    <p className="text-xs text-slate-400">
                      GitHub Repository
                    </p>
                  </div>
                </div>

                <h3 className="mb-2 line-clamp-2 text-lg font-bold text-slate-900">
                  {project.name}
                </h3>

                <p className="mb-4 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
                  {project.description || 'No description provided.'}
                </p>

                <div className="mb-4 flex flex-wrap gap-2">
                  {project.language && (
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      {project.language}
                    </span>
                  )}

                  {(project.topics || []).slice(0, 3).map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                    >
                      {topic}
                    </span>
                  ))}
                </div>

                <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                  <span>⭐ {project.stars?.toLocaleString() || 0}</span>

                  <span>
                    Updated{' '}
                    {project.updatedAt
                      ? new Date(project.updatedAt).toLocaleDateString()
                      : '—'}
                  </span>
                </div>

                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  View Repository ↗
                </a>
              </article>
            ))}
          </div>
        </>
      )}

      {!searched && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <div className="mb-3 text-4xl">🌍</div>

          <h2 className="text-lg font-semibold text-slate-800">
            Discover projects worldwide
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Search for any project topic to explore real GitHub repositories.
          </p>
        </div>
      )}
    </div>
  );
}