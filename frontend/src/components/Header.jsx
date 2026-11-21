import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ navigate }) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const navigateTo = (page, params = {}) => {
    navigate(page, params);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');

    try {
      await logout();
      navigate('landing');
    } catch (err) {
      console.error('Sign-out error:', err);
      setSignOutError(err.message || 'Unable to sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#fffaf7] shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
        <div
          className="flex cursor-pointer items-center space-x-3"
          onClick={() => navigate('landing')}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-vio via-vio to-teal-700 font-black text-white shadow">
            PV
          </div>
          <div>
            <div className="font-bold tracking-tight text-navy text-lg leading-none">ProjectVault</div>
            <div className="text-xs text-slate-500 font-medium">College Project Discovery & Verification</div>
          </div>
        </div>

        {!user && (
          <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {[
              ['Home', 'landing'],
              ['Explore projects', 'search-projects'],
              ['FAQ & help', 'faq'],
              ['Create account', 'register'],
            ].map(([label, page]) => (
              <button
                key={page}
                type="button"
                onClick={() => navigateTo(page)}
                className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#633d65] sm:px-3 sm:text-sm"
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              {signOutError && (
                <span role="alert" className="text-xs text-red-600 font-medium">
                  {signOutError}
                </span>
              )}
              <button
                type="button"
                onClick={() => navigateTo('profile')}
                className="rounded-lg px-3 py-2 text-right transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
                title="Open your profile"
                aria-label="Open profile"
              >
                <span className="block text-xs font-bold text-navy">
                  {user.name || user.email || 'My Profile'}
                </span>
                <span className="mt-0.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-vio">
                  {user.role}
                </span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signingOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigateTo('login')}
              className="rounded-lg bg-vio px-4 py-2 text-xs font-semibold text-white shadow hover:bg-violet-700"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
