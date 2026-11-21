import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isApiConfigured } from '../lib/supabase.js';
import { authClient, isNeonAuthConfigured } from '../lib/neonAuth.js';

const AuthContext = createContext(null);

function normalizeProfile(profile) {
  if (!profile) return null;

  return {
    ...profile,
    name: profile.full_name,
    full_name: profile.full_name,
    collegeId: profile.college_id,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const sessionState = authClient.useSession();
  const [profileLoading, setProfileLoading] = useState(true);
  const loading = sessionState.isPending || profileLoading;

  useEffect(() => {
    if (!isNeonAuthConfigured || !isApiConfigured || sessionState.isPending) {
      if (!sessionState.isPending) {
        setUser(null);
        setProfileLoading(false);
      }
      return;
    }

    let active = true;

    async function loadProfile(sessionUser) {
      if (!sessionUser) {
        if (active) {
          setUser(null);
          setProfileLoading(false);
        }
        return;
      }

      setProfileLoading(true);
      const { data, error } = await supabase.auth.getProjectVaultProfile();

      if (!active) return;

      if (error) {
        if (error.code !== 'email_not_verified') {
          console.error('ProjectVault profile sync failed:', error.message);
        }
        setUser(null);
        setProfileLoading(false);
        return;
      }

      if (!data || !['student', 'faculty', 'admin'].includes(data.role)) {
        console.error('The verified account has no valid ProjectVault role.');
        setUser(null);
        setProfileLoading(false);
        return;
      }

      setUser(normalizeProfile(data));
      setProfileLoading(false);
    }

    void loadProfile(sessionState.data?.user ?? null);

    return () => {
      active = false;
    };
  }, [sessionState.data?.user?.id, sessionState.isPending]);

  async function logout() {
    const result = await authClient.signOut();
    if (result.error) throw result.error;
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        loading,
        DEMO_USERS: [],
        loginAsDemoUser: () => {
          throw new Error('Demo login is disabled. Sign in with your ProjectVault account.');
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
