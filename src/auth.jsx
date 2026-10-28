import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { get, onSessionExpired, post, setAccessToken } from './api.js';

const AuthContext = createContext(null);

export const HOME_BY_ROLE = {
  student: '/student/dashboard',
  mentor: '/mentor/dashboard',
  admin: '/admin/dashboard',
};

export const homeFor = (role) => HOME_BY_ROLE[role] || '/login';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // In this standalone copy, the service restores a local demo user ID, not a cookie.
  useEffect(() => {
    let alive = true;
    post('/auth/refresh')
      .then((envelope) => {
        if (!alive) return;
        setAccessToken(envelope.data.access_token);
        setUser(envelope.data.user);
      })
      .catch(() => {
        /* no session — the login page will handle it */
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => onSessionExpired(() => {
    setUser(null);
    navigate('/session-expired', { replace: true });
  }), [navigate]);

  const login = useCallback(async (email, password) => {
    const envelope = await post('/auth/login', { email, password });
    setAccessToken(envelope.data.access_token);
    setUser(envelope.data.user);
    return envelope.data.user;
  }, []);

  const register = useCallback(async ({ full_name, email, password, role }) => {
    await post('/auth/register', { full_name, email, password, role });
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } catch {
      /* the local session is cleared even if the server call fails */
    } finally {
      setAccessToken(null);
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    const envelope = await get('/users/me');
    setUser(envelope.data);
    return envelope.data;
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, refreshUser, setUser }),
    [user, ready, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="spinner-page">
        <div className="text-center text-muted">
          <div className="spinner-border text-secondary mb-2" role="status" />
          <div className="small">Restoring your local demo…</div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return children;
}
