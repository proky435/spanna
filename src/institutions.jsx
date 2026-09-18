import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth.jsx';
import { apiRequest } from './api.js';

const ACTIVE_KEY = 'vm.activeInstitutionId';
const InstitutionContext = createContext(null);

export function InstitutionProvider({ children }) {
  const { token, apiUrl, isAuthenticated, isGuest } = useAuth();
  const [institutions, setInstitutions] = useState([]);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!isAuthenticated || isGuest || !token) {
      setInstitutions([]);
      setActiveId(null);
      try { localStorage.removeItem(ACTIVE_KEY); } catch {}
      return [];
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(apiUrl, token, '/api/institutions');
      setInstitutions(data.institutions);
      setActiveId((current) => {
        const next = data.institutions.some((institution) => institution.id === current) ? current : data.institutions[0]?.id || null;
        try {
          if (next) localStorage.setItem(ACTIVE_KEY, next);
          else localStorage.removeItem(ACTIVE_KEY);
        } catch {}
        return next;
      });
      return data.institutions;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiUrl, isAuthenticated, isGuest, token]);

  useEffect(() => { refresh(); }, [refresh]);

  const setActiveInstitutionId = useCallback((id) => {
    setActiveId(id);
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }, []);

  const activeInstitution = useMemo(
    () => institutions.find((institution) => institution.id === activeId) || null,
    [institutions, activeId]
  );

  return (
    <InstitutionContext.Provider value={{ institutions, activeInstitution, activeInstitutionId: activeId, setActiveInstitutionId, refresh, loading, error }}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitutions() {
  const context = useContext(InstitutionContext);
  if (!context) throw new Error('useInstitutions az InstitutionProvider-en belül kell legyen');
  return context;
}
