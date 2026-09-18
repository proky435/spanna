// src/sync.js
// Szinkronizációs logika: push/pull a backend-nek.
// Stratégia: localStorage a primer forrás (offline is működik).
//
// Folyamat:
// - Lokális mutáció → dirty-flag (store.jsx jelöli) → 2 mp debounce → push.
// - App indításkor + online váltáskor: pull → applyRemoteState dönti el,
//   hogy remote csere vagy mezőszintű merge kell → merge esetén visszapush.
// - Push hiba esetén a dirty-flag megmarad → 30 mp-es retry háttérben.
import { useRef, useEffect } from 'react';
import {
  applyRemoteState,
  clearLocalDirty,
  isLocalDirty,
  markLocalDirty,
  setAppliedRemoteAt,
  setSyncStatus,
} from './syncMerge.js';

const DEBOUNCE_MS = 2000;
const RETRY_MS = 30000;

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

async function doPush(token, apiUrl, state) {
  setSyncStatus('syncing');
  try {
    const res = await pushState(token, apiUrl, state);
    clearLocalDirty();
    setAppliedRemoteAt(res.updatedAt);
    setSyncStatus('synced');
    return true;
  } catch (err) {
    console.warn('Szinkronizáció (push) sikertelen:', err.message);
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
    return false;
  }
}

// Debounce-olt push: lokális (dirty) változás → 2 mp → push.
// A pull által alkalmazott merge is dirty-t jelöl → azt is ez tölti vissza.
export function useSyncOnStateChange(state, canSync, token, apiUrl) {
  const debounceRef = useRef(null);
  const isFirstRender = useRef(true);
  const latestRef = useRef({ state, token, apiUrl });
  latestRef.current = { state, token, apiUrl };

  useEffect(() => {
    if (!canSync || !token) {
      setSyncStatus('idle');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    // Első rendernél nem pusholunk — a pull fut le előbb (usePullOnMount).
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isLocalDirty()) return;

    setSyncStatus('pending');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const latest = latestRef.current;
      doPush(latest.token, latest.apiUrl, latest.state);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, canSync, token, apiUrl]);

  // Retry: ha a push elhasalt (dirty megmaradt), 30 mp-enként újrapróbáljuk.
  useEffect(() => {
    if (!canSync || !token) return;
    const timer = setInterval(() => {
      if (isLocalDirty() && navigator.onLine) {
        const latest = latestRef.current;
        doPush(latest.token, latest.apiUrl, latest.state);
      }
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [canSync, token]);
}

// Indításkori pull + online váltáskori pull.
// getLocalState: friss lokális state lekérése (ref-en keresztül, nem stale closure).
// applyState: replaceState dispatch a store-ba.
export function usePullOnMount(canSync, token, apiUrl, getLocalState, applyState) {
  const refs = useRef({ getLocalState, applyState, token, apiUrl });
  refs.current = { getLocalState, applyState, token, apiUrl };

  useEffect(() => {
    if (!canSync || !token) return;

    let cancelled = false;

    const doPull = async () => {
      setSyncStatus('syncing');
      try {
        const { state: remoteState, updatedAt } = await pullState(token, apiUrl);
        if (cancelled) return;
        const { getLocalState: getState, applyState: apply } = refs.current;
        const result = applyRemoteState(getState(), remoteState, updatedAt);
        if (result.apply) {
          if (result.needsPush) {
            markLocalDirty();
            apply(result.state);
            // A merge-et a debounce-os push tölti vissza (state-változás triggereli)
            setSyncStatus('pending');
          } else {
            apply(result.state);
            setSyncStatus('synced');
          }
        } else if (isLocalDirty()) {
          // Remote nem változott, de lokális feltöltetlen → azonnali push
          // (a debounce-os hook nem triggerel, mert a state nem változott).
          doPush(token, apiUrl, getState());
        } else {
          setSyncStatus('synced');
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Szinkronizáció (pull) sikertelen:', err.message);
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    };

    doPull();

    const onOnline = () => doPull();
    const onOffline = () => setSyncStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [canSync, token, apiUrl]);
}
