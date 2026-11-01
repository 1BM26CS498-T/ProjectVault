import { useAuth } from '../context/AuthContext.jsx';

export default function LandingPage({ navigate }) {
  const { user } = useAuth();

  return (
    <div className="space-y-12 py-8">
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-violet-800 px-8 py-14 text-white md:px-14">
        <p className="font-semibold uppercase tracking-widest text-violet-200">Discover. Improve. Build.</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold md:text-6xl">Find your next project with ProjectVault.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-200">Explore previous college projects, compare ideas, and work with faculty to develop something meaningful.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={() => navigate('projects')} className="rounded-xl bg-white px-5 py-3 font-bold text-slate-900">Explore projects</button>
          <button onClick={() => navigate(user ? 'propose' : 'register')} className="rounded-xl border border-white/50 px-5 py-3 font-bold text-white">Submit an idea</button>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-bold text-slate-900">How ProjectVault works</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {[['01','Discover','Search previously completed and approved projects.'],['02','Get guidance','Send your idea to your selected faculty guide for review.'],['03','Build and verify','Submit your completed project for faculty verification.']].map(([n,title,desc]) => (
            <article key={n} className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-bold text-violet-700">{n}</p><h3 className="mt-3 text-xl font-bold">{title}</h3><p className="mt-2 text-slate-600">{desc}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-violet-100 bg-violet-50 p-7">
        <h2 className="text-xl font-bold">Ready to get started?</h2>
        <p className="mt-2 text-slate-600">Sign in to access your ProjectVault workspace.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => navigate(user ? 'dashboard' : 'login')} className="rounded-lg bg-vio px-4 py-2 font-semibold text-white">{user ? 'Open dashboard' : 'Sign in'}</button>
          <button onClick={() => navigate('projects')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Browse catalogue</button>
        </div>
      </section>
    </div>
  );
}

