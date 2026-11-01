import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function SearchProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('projects')
        .select('id, title, description, technologies, github_url, created_at, status')
        .in('status', ['approved', 'verified'])
        .order('created_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setProjects([]);
      } else {
        setProjects(data || []);
      }

      setLoading(false);
    }

    loadProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return projects;

    return projects.filter((project) => {
      const searchableText = [
        project.title,
        project.description,
        ...(project.technologies || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(term);
    });
  }, [projects, search]);

  return (
    <main className="page-container">
      <div className="page-header">
        <h1>Search Projects</h1>
        <p>
          Explore approved college projects, discover technologies,
          and find ideas for your next project.
        </p>
      </div>

      <div style={{ margin: '20px 0' }}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, description, or technology..."
          aria-label="Search approved projects"
          style={{
            width: '100%',
            maxWidth: '650px',
            padding: '12px 14px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '15px',
          }}
        />
      </div>

      {loading && <p>Loading approved projects...</p>}

      {error && (
        <p role="alert">
          Could not load projects: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <p>{filteredProjects.length} project(s) found</p>

          {filteredProjects.length === 0 ? (
            <p>
              No approved projects found. Try another search, or check
              back when more projects have been approved.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '18px',
                marginTop: '16px',
              }}
            >
              {filteredProjects.map((project) => (
                <article
                  key={project.id}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '20px',
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '19px', marginTop: 0, marginBottom: '8px' }}>
                      {project.title}
                    </h2>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '5px 9px',
                        borderRadius: '999px',
                        background: project.status === 'verified' ? '#dcfce7' : '#e0e7ff',
                        color: project.status === 'verified' ? '#166534' : '#3730a3',
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {project.status === 'verified' ? '✓ Verified' : 'Proposal Approved'}
                    </span>
                  </div>

                  <p style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                    {project.description || 'No description provided.'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      margin: '14px 0',
                    }}
                  >
                    {(project.technologies || []).map((technology) => (
                      <span
                        key={technology}
                        style={{
                          padding: '5px 9px',
                          borderRadius: '6px',
                          background: '#eef2ff',
                          fontSize: '12px',
                        }}
                      >
                        {technology}
                      </span>
                    ))}
                  </div>

                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View GitHub Repository ↗
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

