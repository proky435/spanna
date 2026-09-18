// src/syncMerge.js
// Szinkron-könyvelés és mezőszintű merge — tiszta JS (React-független),
// így a `node --test` backend tesztek is tudják importálni.
//
// Fogalmak:
// - appliedRemoteAt: az utolsó remote `updated_at` (SZERVERIDŐ), amit a lokális
//   state-be beépítettünk. Szerver↔szerver összevetés → nincs óraeltérés-hiba.
// - localDirtyAt: az utolsó LOKÁLIS mutáció ideje (kliensidő). Ha létezik →
//   vannak feltöltetlen változások.
//
// Döntési szabály pull-nál:
// - remote.updatedAt <= appliedRemoteAt → remote nem változott → lokális marad
//   (ha dirty → push).
// - remote.updatedAt > appliedRemoteAt → remote máshol változott:
//     * lokális tiszta ÉS nem első futás → remote nyer (teljes csere)
//     * dirty VAGY első futás (nincs bizonyíték, hogy a lokális tiszta) →
//       mezőszintű merge → a merge-et visszapusholjuk.
//   Az első futáskori merge védi a régi verzióról átálló felhasználókat:
//   náluk nincs dirty-flag, így az esetleges nem-feltöltött lokális haladást
//   a merge megőrzi (legrosszabb esetben egy törölt hibázott "visszajön").

const KEYS = {
  appliedRemoteAt: 'vm.sync.appliedRemoteAt',
  localDirtyAt: 'vm.sync.localDirtyAt',
};

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function markLocalDirty() {
  const ls = storage();
  if (ls) try { ls.setItem(KEYS.localDirtyAt, new Date().toISOString()); } catch {}
}

export function clearLocalDirty() {
  const ls = storage();
  if (ls) try { ls.removeItem(KEYS.localDirtyAt); } catch {}
}

export function isLocalDirty() {
  const ls = storage();
  if (!ls) return false;
  try { return !!ls.getItem(KEYS.localDirtyAt); } catch { return false; }
}

export function getAppliedRemoteAt() {
  const ls = storage();
  if (!ls) return 0;
  try { return Date.parse(ls.getItem(KEYS.appliedRemoteAt)) || 0; } catch { return 0; }
}

export function setAppliedRemoteAt(updatedAt) {
  const ls = storage();
  if (!ls || !updatedAt) return;
  try {
    const ts = Date.parse(updatedAt);
    if (Number.isFinite(ts)) ls.setItem(KEYS.appliedRemoteAt, new Date(ts).toISOString());
  } catch {}
}

// ---------- Mezőszintű merge ----------

function entryTs(entry, fields) {
  if (!entry || typeof entry !== 'object') return 0;
  for (const field of fields) {
    const value = entry[field];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

// Map típusú mezők (progress, sm2): kulcsonként a frissebb bejegyzés nyer.
function mergeTimestampedMap(local = {}, remote = {}, tsFields) {
  const merged = { ...remote };
  for (const [key, entry] of Object.entries(local || {})) {
    const remoteEntry = merged[key];
    if (!remoteEntry) {
      merged[key] = entry;
      continue;
    }
    merged[key] = entryTs(entry, tsFields) >= entryTs(remoteEntry, tsFields) ? entry : remoteEntry;
  }
  return merged;
}

// Lista típusú mezők (wrong, bookmarks): union.
// Megjegyzés: tombstone nélkül egy törölt elem "visszatérhet", de semmi sem veszik el.
function unionIds(local = [], remote = []) {
  const result = [];
  const seen = new Set();
  for (const id of [...(remote || []), ...(local || [])]) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

function historyTs(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (typeof entry.id === 'number') return entry.id;
  return entryTs(entry, ['date', 'ts', 'endedAt', 'completedAt']);
}

// examHistory: union id alapján, legújabb elöl, max 50 bejegyzés.
function mergeExamHistory(local = [], remote = []) {
  const map = new Map();
  for (const entry of [...(remote || []), ...(local || [])]) {
    const key = entry && typeof entry === 'object' && entry.id != null ? entry.id : JSON.stringify(entry);
    if (!map.has(key)) map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => historyTs(b) - historyTs(a)).slice(0, 50);
}

// Skaláris "utolsó eredmény" típusú mező: a frissebb nyer.
function pickNewer(local, remote) {
  if (local == null) return remote ?? null;
  if (remote == null) return local;
  return historyTs(local) >= historyTs(remote) ? local : remote;
}

// Mezőszintű merge: minden ismert mezőn a frissebb/uniós érték nyer.
// A theme mindig a lokális (eszközfüggő beállítás).
// Ismeretlen (passthrough) mezők: lokális preferált — ott a legfrissebb
// felhasználói szándék van.
export function mergeStates(localState, remoteState) {
  if (!remoteState) return localState;
  if (!localState) return remoteState;
  const local = localState;
  const remote = remoteState;
  return {
    ...remote,
    ...local,
    theme: local.theme,
    progress: mergeTimestampedMap(local.progress, remote.progress, ['ts', 'lastCorrect']),
    sm2: mergeTimestampedMap(local.sm2, remote.sm2, ['lastReviewed', 'nextReview']),
    wrong: unionIds(local.wrong, remote.wrong),
    bookmarks: unionIds(local.bookmarks, remote.bookmarks),
    examHistory: mergeExamHistory(local.examHistory, remote.examHistory),
    lastExam: pickNewer(local.lastExam, remote.lastExam),
  };
}

// Pull eredményének eldöntése + könyvelés.
// Visszatér: { apply, state, needsPush }
//   - apply: cseréljük-e a lokális state-et (replaceState)
//   - needsPush: a merge-et vissza kell-e tölteni a szerverre
export function applyRemoteState(localState, remoteState, remoteUpdatedAt) {
  if (!remoteState) {
    return { apply: false, state: localState, needsPush: false };
  }
  const remoteTs = Date.parse(remoteUpdatedAt) || 0;
  const appliedTs = getAppliedRemoteAt();
  if (remoteTs > 0 && remoteTs <= appliedTs) {
    return { apply: false, state: localState, needsPush: false };
  }
  setAppliedRemoteAt(remoteUpdatedAt);
  const dirty = isLocalDirty();
  const firstRun = appliedTs === 0;
  if (!dirty && !firstRun) {
    return {
      apply: true,
      state: { ...remoteState, theme: localState?.theme ?? remoteState.theme },
      needsPush: false,
    };
  }
  return { apply: true, state: mergeStates(localState, remoteState), needsPush: true };
}

// ---------- Szinkron-státusz (observer) ----------
// 'idle' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error'

let syncStatus = 'idle';
const listeners = new Set();

export function getSyncStatus() {
  return syncStatus;
}

export function setSyncStatus(next) {
  if (syncStatus === next) return;
  syncStatus = next;
  listeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function subscribeSyncStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
