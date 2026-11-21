import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage({ navigate }) {
  const { user } = useAuth();
  const role = user?.role || 'guest';

  const studentActions = [
    ['Explore all colleges', 'Search approved projects across participating colleges', 'search-projects'],
    ['My projects', 'Track approved projects and final submissions', 'my-projects'],
    ['Submit a proposal', 'Send a project idea to a faculty guide', 'propose'],
  ];

  const facultyActions = [
    ['Browse projects', 'Explore previously approved projects', 'search-projects'],
    ['Proposal reviews', 'Review project proposals assigned to you', 'proposals'],
    ['Final verification', 'Review approved projects and their final submissions', 'final-verification'],
    ['Verified Project History', 'View history of projects verified by you', 'verified-history'],
  ];

  const adminActions = [
    ['Browse projects', 'Explore projects across the catalogue', 'search-projects'],
    ['Manage colleges and faculty', 'Open admin tools and workspace metrics', 'admin'],
    ['Review community questions', 'Moderate student questions and publish answers', 'faq'],
  ];

  const actions =
    role === 'admin'
      ? adminActions
      : role === 'faculty'
        ? facultyActions
        : studentActions;

  return (
    <section>
      <p className="text-sm font-bold uppercase tracking-[.14em] text-violet-700">
        {role === 'admin' ? 'Administration' : role === 'faculty' ? 'Faculty workspace' : 'Student workspace'}
      </p>
      <h1 className="mt-2 text-3xl font-bold">
        {role === 'admin' ? 'Admin dashboard' : role === 'faculty' ? 'Faculty dashboard' : 'Student dashboard'}
      </h1>

      <p className="mt-2 text-slate-600">
        Welcome, {user?.full_name || user?.name || 'ProjectVault user'}.
      </p>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        {actions.map(([title, description, page]) => (
          <button
            key={page}
            onClick={() => navigate(page)}
            className="rounded-2xl border bg-white p-6 text-left shadow-sm hover:border-violet-300"
          >
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-2 text-slate-600">{description}</p>
            <p className="mt-4 font-semibold text-violet-700">Open →</p>
          </button>
        ))}

      </div>
    </section>
  );
}
