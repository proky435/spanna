// server/test/syncMerge.test.js
// A src/syncMerge.js mezőszintű merge és pull-döntés tesztjei.
// A modul React-független, ezért közvetlenül futtatható node --test alatt.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage shim (Node-ban nincs localStorage)
function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}
globalThis.localStorage = makeLocalStorage();

const {
  mergeStates,
  applyRemoteState,
  markLocalDirty,
  clearLocalDirty,
  isLocalDirty,
  setAppliedRemoteAt,
} = await import('../../src/syncMerge.js');

beforeEach(() => {
  localStorage.clear();
});

const base = {
  theme: 'dark',
  progress: {},
  wrong: [],
  bookmarks: [],
  lastExam: null,
  sm2: {},
  examHistory: [],
};

// ---------- mergeStates ----------

test('mergeStates: üres lokális → remote tartalom megmarad', () => {
  const remote = {
    ...base,
    progress: { q1: { seen: true, ts: 100 } },
    wrong: ['q2'],
  };
  const merged = mergeStates({ ...base }, remote);
  assert.deepEqual(merged.progress, remote.progress);
  assert.deepEqual(merged.wrong, ['q2']);
  assert.equal(merged.theme, 'dark');
});

test('mergeStates: progress kulcsonként a frissebb ts nyer (mindkét irány)', () => {
  const local = {
    ...base,
    progress: {
      olderLocal: { seen: true, ts: 100 },
      newerLocal: { seen: true, ts: 300 },
    },
  };
  const remote = {
    ...base,
    progress: {
      olderLocal: { seen: true, ts: 200 }, // remote frissebb → remote nyer
      newerLocal: { seen: false, ts: 50 }, // lokális frissebb → lokális nyer
      remoteOnly: { seen: true, ts: 10 },
    },
  };
  const merged = mergeStates(local, remote);
  assert.equal(merged.progress.olderLocal.ts, 200);
  assert.equal(merged.progress.newerLocal.ts, 300);
  assert.equal(merged.progress.remoteOnly.ts, 10);
});

test('mergeStates: wrong és bookmarks union, dedup', () => {
  const local = { ...base, wrong: ['a', 'b'], bookmarks: ['x'] };
  const remote = { ...base, wrong: ['b', 'c'], bookmarks: ['x', 'y'] };
  const merged = mergeStates(local, remote);
  assert.deepEqual(new Set(merged.wrong), new Set(['a', 'b', 'c']));
  assert.deepEqual(new Set(merged.bookmarks), new Set(['x', 'y']));
});

test('mergeStates: sm2 a frissebb lastReviewed nyer', () => {
  const local = { ...base, sm2: { q1: { lastReviewed: 500, ef: 2.0 } } };
  const remote = { ...base, sm2: { q1: { lastReviewed: 300, ef: 2.5 } } };
  const merged = mergeStates(local, remote);
  assert.equal(merged.sm2.q1.ef, 2.0);
});

test('mergeStates: examHistory union + dedup + időrend + cap', () => {
  const mk = (id) => ({ id, percent: 50 });
  const local = { ...base, examHistory: [mk(3), mk(1)] };
  const remote = { ...base, examHistory: [mk(3), mk(2)] };
  const merged = mergeStates(local, remote);
  assert.deepEqual(merged.examHistory.map((e) => e.id), [3, 2, 1]);
});

test('mergeStates: theme mindig lokális marad', () => {
  const merged = mergeStates({ ...base, theme: 'light' }, { ...base, theme: 'dark' });
  assert.equal(merged.theme, 'light');
});

test('mergeStates: lastExam a frissebb nyer', () => {
  const local = { ...base, lastExam: { id: 100, percent: 80 } };
  const remote = { ...base, lastExam: { id: 200, percent: 90 } };
  const merged = mergeStates(local, remote);
  assert.equal(merged.lastExam.id, 200);
});

test('mergeStates: null oldalak', () => {
  assert.equal(mergeStates(null, base), base);
  const local = { ...base, wrong: ['a'] };
  assert.equal(mergeStates(local, null), local);
});

// ---------- applyRemoteState ----------

test('applyRemoteState: nincs remote → apply false', () => {
  const r = applyRemoteState(base, null, null);
  assert.equal(r.apply, false);
});

test('applyRemoteState: remote nem változott (updatedAt <= applied) → apply false', () => {
  setAppliedRemoteAt('2026-01-10T10:00:00Z');
  const r = applyRemoteState(base, { ...base, wrong: ['a'] }, '2026-01-10T09:00:00Z');
  assert.equal(r.apply, false);
});

test('applyRemoteState: remote frissebb + lokális tiszta + nem első futás → remote nyer', () => {
  setAppliedRemoteAt('2026-01-10T10:00:00Z'); // korábbi szinkron már volt
  const remote = { ...base, theme: 'dark', progress: { q1: { ts: 1 } } };
  const r = applyRemoteState({ ...base, theme: 'light' }, remote, '2026-01-11T10:00:00Z');
  assert.equal(r.apply, true);
  assert.equal(r.needsPush, false);
  assert.deepEqual(r.state.progress, { q1: { ts: 1 } });
  assert.equal(r.state.theme, 'light'); // theme eszközfüggő
});

test('applyRemoteState: remote frissebb + lokális dirty → merge, needsPush', () => {
  setAppliedRemoteAt('2026-01-10T10:00:00Z');
  markLocalDirty();
  const local = { ...base, progress: { offlineQ: { ts: 999 } } };
  const remote = { ...base, progress: { remoteQ: { ts: 1 } } };
  const r = applyRemoteState(local, remote, '2026-01-11T10:00:00Z');
  assert.equal(r.apply, true);
  assert.equal(r.needsPush, true);
  // A lokális offline haladás NEM veszik el:
  assert.ok(r.state.progress.offlineQ);
  assert.ok(r.state.progress.remoteQ);
});

test('applyRemoteState: első futás (applied=0) + nem dirty → merge (nem remote-csere)', () => {
  // Régi verzióról átálló user: nincs dirty-flag, de lehet feltöltetlen lokális haladás
  const local = { ...base, progress: { unpushed: { ts: 42 } } };
  const remote = { ...base, progress: { remoteQ: { ts: 1 } } };
  const r = applyRemoteState(local, remote, '2026-01-11T10:00:00Z');
  assert.equal(r.apply, true);
  assert.equal(r.needsPush, true);
  assert.ok(r.state.progress.unpushed);
  assert.ok(r.state.progress.remoteQ);
});

test('dirty-flag körforgás', () => {
  assert.equal(isLocalDirty(), false);
  markLocalDirty();
  assert.equal(isLocalDirty(), true);
  clearLocalDirty();
  assert.equal(isLocalDirty(), false);
});
