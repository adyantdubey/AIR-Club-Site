/**
 * Log-in state for the whole site.
 *
 *   const { user, role, loading, signIn, signOut } = useAuth();
 *
 * Supabase mode: real email + password accounts (Supabase Auth). Each account has a row in
 * the `profiles` table that says its role. New sign-ups start as 'viewer'.
 * Demo mode: the six demo accounts in src/data/seed.js (password demo1234).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isDemo, getClient, setActor, list } from './db';
import { DEMO_PASSWORD } from '../data/seed';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const SESSION_KEY = 'air-demo-session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, email, full_name, role }
  const [loading, setLoading] = useState(true);

  // ---------- restore session on first load ----------
  useEffect(() => {
    let alive = true;
    let sub = null;
    if (isDemo) {
      (async () => {
        let saved = null;
        try {
          saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        } catch {
          /* ignore */
        }
        if (saved?.email) {
          // re-read the role in case it was changed in Admin → Settings → Access
          const profiles = await list('profiles', { order: null });
          saved = profiles.find((p) => p.email === saved.email) || null;
        }
        if (alive) {
          setUser(saved);
          setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }
    getClient().then(async (sb) => {
      const { data } = await sb.auth.getSession();
      if (alive) await applySession(sb, data.session);
      const res = sb.auth.onAuthStateChange((_event, session) => {
        // defer: supabase recommends not awaiting other calls inside this callback
        setTimeout(() => alive && applySession(sb, session), 0);
      });
      sub = res.data.subscription;
      if (alive) setLoading(false);
    });
    async function applySession(sb, session) {
      if (!session) return setUser(null);
      const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      setUser({
        id: session.user.id,
        email: session.user.email,
        full_name: profile?.full_name || session.user.email,
        role: profile?.role || 'viewer',
      });
    }
    return () => {
      alive = false;
      sub?.unsubscribe();
    };
  }, []);

  useEffect(() => setActor(user), [user]);

  // ---------- actions ----------
  const signIn = useCallback(async (email, password) => {
    const e = email.trim().toLowerCase();
    if (isDemo) {
      const profiles = await list('profiles', { order: null });
      const found = profiles.find((p) => p.email === e);
      if (!found || password !== DEMO_PASSWORD) throw new Error('Wrong email or password');
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ email: found.email }));
      } catch {
        /* ignore */
      }
      setUser(found);
      return found;
    }
    const sb = await getClient();
    const { data, error } = await sb.auth.signInWithPassword({ email: e, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message);
    const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    const u = { id: data.user.id, email: data.user.email, full_name: profile?.full_name || e, role: profile?.role || 'viewer' };
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    if (isDemo) {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
    } else {
      const sb = await getClient();
      await sb.auth.signOut();
    }
    setUser(null);
  }, []);

  /** Supabase only: email a password-reset link. */
  const resetPassword = useCallback(async (email) => {
    if (isDemo) throw new Error('Not available in demo mode — the password is demo1234');
    const sb = await getClient();
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(() => ({ user, role: user?.role || null, loading, signIn, signOut, resetPassword }), [user, loading, signIn, signOut, resetPassword]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
