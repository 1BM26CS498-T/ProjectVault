import { useAuth } from '../context/AuthContext.jsx';

const dashboardLabels = {
  student: 'Student dashboard',
  faculty: 'Faculty dashboard',
  admin: 'Admin dashboard',
};

const rolePages = {
  student: [
    ['Submit a proposal', 'propose'],
    ['My projects', 'my-projects'],
  ],
  faculty: [
    ['Proposal reviews', 'proposals'],
    ['Final verification', 'final-verification'],
    ['Verified history', 'verified-history'],
  ],
  admin: [
    ['Manage ProjectVault', 'admin'],
  ],
};

export default function Sidebar({ navigate, currentPage }) {
  const { user } = useAuth();

  function navButton(label, page, params = {}, active = currentPage === page) {
    return (
      <button
        key={`${page}-${params.role || ''}`}
        type="button"
        onClick={() => navigate(page, params)}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
          active
            ? 'bg-[#f3e8f0] text-[#633d65]'
            : 'text-slate-600 hover:bg-white hover:text-[#633d65]'
        }`}
      >
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-[#8a658d]' : 'bg-[#d6c8d8]'}`} />
        {label}
      </button>
    );
  }

  return (
    <aside className="h-fit rounded-3xl border border-[#e9dfe6] bg-[#fffaf8] p-4 shadow-sm lg:sticky lg:top-24">
      <div className="px-3 pb-3 pt-2">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#947a91]">Navigate</p>
        <p className="mt-1 text-sm text-slate-500">Your campus project space</p>
      </div>

      <nav aria-label="Main navigation" className="grid grid-cols-2 gap-1 lg:flex lg:flex-col">
        {navButton('Home', 'landing')}
        {navButton('Explore projects', 'search-projects')}
        {navButton('Explore online projects', 'explore-online-projects')}
        {navButton('FAQ & help', 'faq')}
        {user ? (
          <>
            {navButton(dashboardLabels[user.role], `${user.role}-dashboard`)}
            {(rolePages[user.role] || []).map(([label, page]) => navButton(label, page))}
            {navButton('My profile', 'profile')}
          </>
        ) : (
          <>
            {navButton('Student workspace', 'login', { role: 'student' }, false)}
            {navButton('Faculty workspace', 'login', { role: 'faculty' }, false)}
            {navButton('Create account', 'register')}
          </>
        )}
      </nav>

      <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#f5ecef] to-[#f4eee8] p-4">
        <p className="text-sm font-bold text-[#5b4359]">A better place for ideas</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Discover campus projects, connect with faculty, and keep every milestone in one space.
        </p>
      </div>
    </aside>
  );
}
