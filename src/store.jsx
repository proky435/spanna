// src/store.jsx
// Központi állapot React Context + useReducer segítségével,
// localStorage perzisztenciával.
// SM-2 spaced repetition + vizsgatörténet (examHistory) támogatással.

import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';

const LS_KEY = 'spanna.state.v2'; // v2: új mezők (sm2, examHistory)

const DEFAULT_STATE = {
  theme: 'dark',        // 'light' | 'dark' — alapból sötét
  progress: {},         // id -> { seen, lastCorrect, ts }
  wrong: [],            // hibázott kérdések ID-i (globális lista)
  bookmarks: [],        // könyvjelzőzött kérdések ID-i
  lastExam: null,       // utolsó vizsgaeredmény (kompatibilitás)
  // SM-2 spaced repetition: id -> { ef, interval, reps, lapses, nextReview, lastReviewed }
  // ef = easiness factor (2.5-től indul), interval = napok, reps = sorozatban helyes,
  // lapses = hibák száma, nextReview = timestamp (mikor esedékes)
  sm2: {},
  // Vizsgatörténet: [{ id, date, total, correct, percent, mode, wrongList: [{id, chosen}] }]
  examHistory: [],
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const saved = JSON.parse(raw);
    const merged = { ...DEFAULT_STATE, ...saved };
    // Régi v1 migráció: ha spanna.state.v1 volt, átmásoljuk
    if (!saved.sm2) merged.sm2 = {};
    if (!saved.examHistory) merged.examHistory = [];
    return merged;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function persist(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('VizsgaMester: nem sikerült menteni az állapotot.', e);
  }
}

// SM-2 frissítés egy kérdésre válaszolás után.
// quality: 5 = helyes (könnyű), 3 = helyes (nehezen), 0 = hibás
function updateSM2(sm2, id, quality) {
  const entry = sm2[id] || { ef: 2.5, interval: 0, reps: 0, lapses: 0, nextReview: 0, lastReviewed: 0 };
  const now = Date.now();
  let { ef, interval, reps, lapses } = entry;

  if (quality >= 3) {
    // Helyes válasz
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ef);
  } else {
    // Hibás válasz
    reps = 0;
    lapses += 1;
    interval = 1; // holnap újra
  }

  // EF frissítése (SM-2 formula)
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, ef);

  const nextReview = now + interval * 24 * 60 * 60 * 1000;

  return {
    ...sm2,
    [id]: { ef, interval, reps, lapses, nextReview, lastReviewed: now },
  };
}

// Reducer
function reducer(state, action) {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'MARK_SEEN': {
      const progress = { ...state.progress };
      progress[action.id] = { seen: true, lastCorrect: action.correct, ts: Date.now() };
      // SM-2 frissítés: quality 5 ha helyes, 0 ha hibás
      const sm2 = updateSM2(state.sm2, action.id, action.correct ? 5 : 0);
      return { ...state, progress, sm2 };
    }

    case 'ADD_WRONG': {
      if (state.wrong.includes(action.id)) return state;
      return { ...state, wrong: [...state.wrong, action.id] };
    }
    case 'REMOVE_WRONG':
      return { ...state, wrong: state.wrong.filter((x) => x !== action.id) };
    case 'CLEAR_WRONG':
      return { ...state, wrong: [] };

    case 'TOGGLE_BOOKMARK': {
      const has = state.bookmarks.includes(action.id);
      return {
        ...state,
        bookmarks: has
          ? state.bookmarks.filter((x) => x !== action.id)
          : [...state.bookmarks, action.id],
      };
    }

    case 'SET_LAST_EXAM':
      return { ...state, lastExam: action.result };

    case 'ADD_EXAM_HISTORY': {
      const entry = { id: Date.now(), ...action.result };
      // Legfeljebb 50 bejegyzést tartunk (régebbiek törölődnek)
      const history = [entry, ...state.examHistory].slice(0, 50);
      return { ...state, examHistory: history };
    }

    case 'RESET':
      return { ...DEFAULT_STATE };

    case 'REPLACE_STATE':
      // Sync: teljes state cseréje a backend-ből kapott adatokkal
      // (theme-t nem írjuk felül — az eszközfüggő)
      return { ...action.state, theme: state.theme };

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => { persist(state); }, [state]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
    try { localStorage.setItem('spanna.theme', state.theme); } catch {}
  }, [state.theme]);

  const setTheme = useCallback((theme) => dispatch({ type: 'SET_THEME', theme }), []);
  const toggleTheme = useCallback(() => {
    dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' });
  }, [state.theme]);
  const markSeen = useCallback((id, correct) => dispatch({ type: 'MARK_SEEN', id, correct }), []);
  const addWrong = useCallback((id) => dispatch({ type: 'ADD_WRONG', id }), []);
  const removeWrong = useCallback((id) => dispatch({ type: 'REMOVE_WRONG', id }), []);
  const clearWrong = useCallback(() => dispatch({ type: 'CLEAR_WRONG' }), []);
  const toggleBookmark = useCallback((id) => dispatch({ type: 'TOGGLE_BOOKMARK', id }), []);
  const setLastExam = useCallback((result) => dispatch({ type: 'SET_LAST_EXAM', result }), []);
  const addExamHistory = useCallback((result) => dispatch({ type: 'ADD_EXAM_HISTORY', result }), []);
  const resetAll = useCallback(() => dispatch({ type: 'RESET' }), []);
  const replaceState = useCallback((newState) => dispatch({ type: 'REPLACE_STATE', state: newState }), []);

  const isBookmarked = useCallback((id) => state.bookmarks.includes(id), [state.bookmarks]);

  const stats = {
    seen: Object.values(state.progress).filter((p) => p.seen).length,
    wrong: state.wrong.length,
    bookmarks: state.bookmarks.length,
  };

  const value = {
    state, stats,
    setTheme, toggleTheme,
    markSeen, addWrong, removeWrong, clearWrong,
    toggleBookmark, isBookmarked, setLastExam, addExamHistory, resetAll,
    replaceState,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore a StoreProvider-en belül kell legyen');
  return ctx;
}
