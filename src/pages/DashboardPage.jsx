import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage({ navigate }) {
  const { user } = useAuth();
  const role = user?.role || 'guest';

  const studentActions = [
    ['My projects', 'Track approved projects and final submissions', 'my-projects'],
    ['Submit a proposal', 'Send a project idea to a faculty guide', 'propose'],
  ];

  const facultyActions = [
    ['Browse projects', 'Explore previously approved projects', 'projects'],
    ['My guided projects', 'Track projects assigned to you', 'my-projects'],
    ['Proposal reviews', 'Review project proposals assigned to you', 'proposals'],
    ['Verified Project History', 'View history of projects verified by you', 'verified-history'],
  ];

  const adminActions = [
    ['Proposal reviews', 'Review submitted project proposals', 'proposals'],
    ['Administration', 'Manage colleges and faculty accounts', 'admin'],
  ];

  const actions =
    role === 'admin'
      ? adminActions
      : role === 'faculty'
        ? facultyActions
        : studentActions;

  return (
    <section>
      <h1 className="text-3xl font-bold">Dashboard</h1>

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

        {role === 'faculty' && (
          <button
            onClick={() => navigate('my-projects')}
            className="rounded-2xl border bg-white p-6 text-left shadow-sm hover:border-violet-300"
          >
            <h2 className="text-xl font-bold">Project verification</h2>
            <p className="mt-2 text-slate-600">
              Open project tracking to review project progress and submissions.
            </p>
            <p className="mt-4 font-semibold text-violet-700">Open →</p>
          </button>
        )}
      </div>
    </section>
  );
}

