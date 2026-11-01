import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ navigate, currentPage }) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

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

  const navClass = (page) =>
    `px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
      currentPage === page
        ? 'bg-indigo-50 text-vio'
        : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <div
          className="flex cursor-pointer items-center space-x-3"
          onClick={() => navigate('landing')}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-900 via-navy to-vio font-black text-white shadow">
            PV
          </div>
          <div>
            <div className="font-bold tracking-tight text-navy text-lg leading-none">ProjectVault</div>
            <div className="text-xs text-slate-500 font-medium">College Project Discovery & Verification</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-1">
          

          {user && (
            <>
              <button onClick={() => navigate('dashboard')} className={navClass('dashboard')}>
                Dashboard
              </button>

              {user.role === 'student' && (
                <>
                  <button
                    onClick={() => navigate('search-projects')}
                    className={navClass('search-projects')}
                  >
                    Search Projects
                  </button>
                  <button onClick={() => navigate('propose')} className={navClass('propose')}>
                    Submit Proposal
                  </button>
                  <button onClick={() => navigate('my-projects')} className={navClass('my-projects')}>
                    My Projects
                  </button>
                </>
              )}

              {user.role === 'faculty' && (
                <>
                  <button onClick={() => navigate('proposals')} className={navClass('proposals')}>
                    Proposal Reviews
                  </button>
                  <button onClick={() => navigate('final-verification')} className={navClass('final-verification')}>
                    Final Verification
                  </button>
                  <button onClick={() => navigate('verified-history')} className={navClass('verified-history')}>
                    Verified History
                  </button>
                </>
              )}

              {user.role === 'admin' && (
                <button onClick={() => navigate('admin')} className={navClass('admin')}>
                  Admin Panel
                </button>
              )}
            </>
          )}

          
        </nav>

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
                onClick={() => navigate('profile')}
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
              onClick={() => navigate('login')}
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






