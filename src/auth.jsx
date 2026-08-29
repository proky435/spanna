// src/auth.jsx
// Auth kontextus: bejelentkezett felhasználó kezelése + API hívások.
// Token localStorage-ban tárolva; email/jelszó regisztráció + bejelentkezés.
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TOKEN_KEY = 'vm.token';
const USER_KEY = 'vm.user';

// Backend API URL — prod-ban környezeti változó, dev-ben localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Vendég mód: user.id === 0, nincs token → isAuthenticated true, de sync nem fut
  const isGuest = user && user.id === 0;

  // Token érvényesítése indításkor (ha van mentett token)
  useEffect(() => {
    if (!token) return;
    // Vendég módnak nincs tokenje — nem validálunk
    if (isGuest) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          // Token lejárt vagy érvénytelen — kijelentkeztetünk
          logout();
        } else {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Hálózati hiba — megtartjuk a tokent, később újrapróbáljuk
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regisztrációs hiba.');
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bejelentkezési hiba.');
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const value = {
    token,
    user,
    loading,
    error,
    register,
    login,
    logout,
    isAuthenticated: !!user, // vendég (id:0) vagy bejelentkezett
    isGuest,
    apiUrl: API_URL,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth az AuthProvider-en belül kell legyen');
  return ctx;
}
