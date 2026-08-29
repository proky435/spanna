// src/sync.js
// Szinkronizációs logika: push/pull a backend-nek.
// Stratégia: localStorage a primer forrás (offline is működik).
// Ha be van jelentkezve + online: state változás → push (debounce 2s).
// App indításkor + online váltáskor: pull + merge.
import { useAuth } from './auth.jsx';

const LAST_SYNC_KEY = 'vm.lastSync';
const DEBOUNCE_MS = 2000;

// Állapot merge: a frissebb nyer (last-write-wins a updatedAt alapján).
// Ha a backend frissebb → backend nyer (kivéve ha a lokális új adatokat tartalmaz).
// Egyszerűsített stratégia: ha a backend updatedAt > lokális lastSync → backend nyer.
export function mergeStates(localState, remoteState, remoteUpdatedAt, localLastSync) {
  if (!remoteState) return localState; // nincs remote → lokális marad
  if (!localState) return remoteState; // nincs lokális → remote marad

  // Ha a remote frissebb mint a lokális utolsó szinkron → remote nyer
  const remoteTs = new Date(remoteUpdatedAt).getTime();
  const localTs = localLastSync ? new Date(localLastSync).getTime() : 0;

  if (remoteTs > localTs) {
    // Remote nyer, de a theme-t a lokálisból vesszük (eszközfüggő)
    return { ...remoteState, theme: localState.theme };
  }
  // Lokális frissebb → lokális marad
  return localState;
}

// Pull: lekéri a backend állapotát
export async function pullState(token, apiUrl) {
  const res = await fetch(`${apiUrl}/api/sync/pull`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Pull sikertelen: ' + res.status);
  return res.json(); // { state, updatedAt }
}

// Push: feltölti az állapotot a backend-nek
export async function pushState(token, apiUrl, state) {
  const res = await fetch(`${apiUrl}/api/sync/push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) throw new Error('Push sikertelen: ' + res.status);
  return res.json(); // { updatedAt }
}

// Debounce-olt push hook
import { useRef, useEffect } from 'react';

export function useSyncOnStateChange(state, isAuthenticated, token, apiUrl) {
  const debounceRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Ha nincs bejelentkezve vagy offline → nem szinkronizálunk
    if (!isAuthenticated || !token || !navigator.onLine) return;

    // Első render-nél nem pusholunk (csak pull van indításkor)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Debounce: 2s múlva push, ha nem jön újabb változás
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await pushState(token, apiUrl, state);
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      } catch (err) {
        console.warn('Szinkronizáció (push) sikertelen:', err.message);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, isAuthenticated, token, apiUrl]);
}

// Indításkori pull + online váltáskori pull
export function usePullOnMount(isAuthenticated, token, apiUrl, onRemoteState) {
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let cancelled = false;

    const doPull = async () => {
      try {
        const { state: remoteState, updatedAt } = await pullState(token, apiUrl);
        if (cancelled) return;
        if (remoteState) {
          const localLastSync = localStorage.getItem(LAST_SYNC_KEY);
          onRemoteState(remoteState, updatedAt, localLastSync);
        }
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      } catch (err) {
        console.warn('Szinkronizáció (pull) sikertelen:', err.message);
      }
    };

    doPull();

    // Online esemény → újra pull
    const onOnline = () => doPull();
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, apiUrl]);
}
