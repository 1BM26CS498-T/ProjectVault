import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadProfile(sessionUser) {
      if (!sessionUser) {
        if (active) setUser(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('Profile lookup failed:', error.message);
        setUser(null);
        return;
      }

      setUser(normalizeProfile(data));
    }

    async function initialise() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;
        await loadProfile(data.session?.user ?? null);
      } catch (error) {
        console.error('Session loading failed:', error.message);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialise();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          if (active) setUser(null);
          return;
        }

        // Defer the profile query to avoid running Supabase queries
        // inside the authentication event callback.
        Promise.resolve().then(() => {
          if (active) {
            loadProfile(session.user);
          }
        });
      }
    );

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  async function logout() {
    if (!supabase) {
      setUser(null);
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) throw error;
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
          throw new Error('Demo login is disabled. Use a Supabase account.');
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
