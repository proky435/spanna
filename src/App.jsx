// src/App.jsx
// Fő komponens: betölti a kérdéseket, kezeli a képernyők közötti
// navigációt (Home | Flashcard | Exam | Stats), becsomagolja a StoreProvider-t.
// Mobil-first: alsó navigációs sáv, safe-area támogatás.

import React, { useState, useEffect, useRef } from 'react';
import { loadQuestions } from './data.js';
import { StoreProvider, useStore } from './store.jsx';
import { AuthProvider, useAuth } from './auth.jsx';
import { InstitutionProvider } from './institutions.jsx';
import { useSyncOnStateChange, usePullOnMount } from './sync.js';
import { ToastProvider, Icon } from './components/ui.jsx';
import Home from './components/Home.jsx';
import Flashcard from './components/Flashcard.jsx';
import Exam from './components/Exam.jsx';
import Stats from './components/Stats.jsx';
import Survival from './components/Survival.jsx';
import TimeAttack from './components/TimeAttack.jsx';
import CheatSheet from './components/CheatSheet.jsx';
import ReverseQuiz from './components/ReverseQuiz.jsx';
import Auth from './components/Auth.jsx';
import QuestionBanks from './components/QuestionBanks.jsx';
import Institutions from './components/Institutions.jsx';

function Spinner() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 min-h-screen">
      <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-brand-600 animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">Kérdések betöltése…</p>
    </div>
  );
}

function ErrorScreen({ err, onRetry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center min-h-screen">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 flex items-center justify-center">
        <Icon name="x" size={28} />
      </div>
      <h2 className="text-lg font-semibold">Nem sikerült betölteni az adatokat</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
        A questions.json fájlt nem sikerült betölteni. Futtasd a dev szervert a projekt mappájából:
      </p>
      <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl px-4 py-3 overflow-x-auto">npm run dev</pre>
      {err && <p className="text-xs text-rose-500 mt-2">{String(err.message || err)}</p>}
      <button
        onClick={onRetry}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white"
      >
        Újrapróbálkozás
      </button>
    </div>
  );
}

// Alsó navigációs sáv (mobil-first). Csak a fő képernyőkön jelenik meg.
// Modernizált: lebegő pill formátum, backdrop-blur, aktív elem kiemelt háttérrel.
function BottomNav({ current, onNavigate }) {
  const items = [
    { key: 'home', label: 'Kezdő', icon: 'home' },
    { key: 'questionbanks', label: 'Bankok', icon: 'book' },
    { key: 'institutions', label: 'Szervezetek', icon: 'users' },
    { key: 'stats', label: 'Statisztika', icon: 'target' },
  ];
  return (
    <div className="fixed bottom-4 left-0 right-0 px-4 z-30 pointer-events-none bottom-nav">
      <nav className="max-w-lg mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-900/10 dark:shadow-black/40 rounded-full flex justify-between p-1.5 pointer-events-auto">
        {items.map((item) => {
          const active = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              title={item.label}
              aria-label={item.label}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm transition-all btn-press ${
                active
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Shell() {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState(() => new URLSearchParams(window.location.search).has('invite') ? { name: 'institutions' } : { name: 'home' });
  const [selection, setSelection] = useState({ subject: null, topic: null });
  const [searchQuery, setSearchQuery] = useState('');
  // ordered: ha true, sorrendben jönnek a kérdések; ha false (alap), véletlenszerűen.
  const [ordered, setOrdered] = useState(false);

  useEffect(() => {
    let alive = true;
    loadQuestions()
      .then((q) => { if (alive) setQuestions(q); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, []);

  // Ha nincs bejelentkezve → Auth képernyő (vendég mód gombbal)
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Auth />;
  }

  if (error) return <ErrorScreen err={error} onRetry={() => { setError(null); window.location.reload(); }} />;
  if (!questions) return <Spinner />;

  // Navigációs segédfüggvények
  const goHome = () => setScreen({ name: 'home' });
  const goStats = () => setScreen({ name: 'stats' });
  const goQuestionBanks = () => setScreen({ name: 'questionbanks' });
  const goInstitutions = () => setScreen({ name: 'institutions' });
  const navigateMain = (name) => {
    if (name === 'stats') goStats();
    else if (name === 'questionbanks') goQuestionBanks();
    else if (name === 'institutions') goInstitutions();
    else goHome();
  };
  const startMode = (mode, payload) => setScreen({ name: mode, ...payload });

  // Flashcard / Exam: teljes képernyős, nincs bottom nav
  if (screen.name === 'flashcard') {
    const restartKey = screen._nonce || 0;
    return (
      <Flashcard
        key={restartKey}
        questions={screen.customQuestions || questions}
        ids={screen.ids}
        isWrongReview={screen.isWrongReview}
        isBookmarkReview={screen.isBookmarkReview}
        ordered={ordered}
        onBack={goHome}
        onRestart={() => setScreen({ ...screen, _nonce: Date.now() })}
        onPracticeWrong={(wrongIds) => setScreen({ name: 'flashcard', ids: wrongIds, isWrongReview: true, customQuestions: screen.customQuestions, _nonce: Date.now() })}
      />
    );
  }

  if (screen.name === 'exam') {
    const restartKey = screen._nonce || 0;
    return (
      <Exam
        key={restartKey}
        questions={screen.customQuestions || questions}
        ids={screen.ids}
        count={screen.count}
        onBack={goHome}
        onPracticeWrong={(wrongIds) => setScreen({ name: 'flashcard', ids: wrongIds, isWrongReview: true, customQuestions: screen.customQuestions })}
        onRestart={() => setScreen({ ...screen, _nonce: Date.now() })}
      />
    );
  }

  if (screen.name === 'liveexam') {
    const restartKey = screen._nonce || 0;
    return (
      <Exam
        key={restartKey}
        questions={screen.customQuestions || questions}
        ids={screen.ids}
        count={40}
        timeLimit={40 * 60}
        title="Éles vizsga mód"
        historyMode="live-exam"
        onBack={goHome}
        onPracticeWrong={(wrongIds) => setScreen({ name: 'flashcard', ids: wrongIds, isWrongReview: true, customQuestions: screen.customQuestions })}
        onRestart={() => setScreen({ ...screen, _nonce: Date.now() })}
      />
    );
  }

  // Játékmódok: Survival, TimeAttack, CheatSheet
  if (screen.name === 'survival') {
    return <Survival questions={questions} ids={screen.ids} onBack={goHome} />;
  }

  if (screen.name === 'timeattack') {
    return <TimeAttack questions={questions} ids={screen.ids} onBack={goHome} />;
  }

  if (screen.name === 'cheatsheet') {
    return <CheatSheet questions={questions} ids={screen.ids} onBack={goHome} />;
  }

  if (screen.name === 'reversequiz') {
    return <ReverseQuiz questions={questions} ids={screen.ids} onBack={goHome} />;
  }

  if (screen.name === 'questionbanks') {
    return (
      <>
        <QuestionBanks onBack={goHome} onStart={startMode} />
        <BottomNav current="questionbanks" onNavigate={navigateMain} />
      </>
    );
  }

  if (screen.name === 'institutions') {
    return (
      <>
        <Institutions onBack={goHome} />
        <BottomNav current="institutions" onNavigate={navigateMain} />
      </>
    );
  }

  if (screen.name === 'stats') {
    return (
      <>
        <Stats questions={questions} onBack={goHome} />
        <BottomNav current="stats" onNavigate={navigateMain} />
      </>
    );
  }

  // Home (alapértelmezett)
  return (
    <>
      <Home
        questions={questions}
        selection={selection}
        setSelection={setSelection}
        ordered={ordered}
        setOrdered={setOrdered}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onStart={startMode}
      />
      <BottomNav current="home" onNavigate={navigateMain} />
    </>
  );
}

// SyncManager: figyeli a store state-et és szinkronizál a backend-nek.
// Csak akkor aktív, ha be van jelentkezve (vendég módban nem fut).
function SyncManager() {
  const { state, replaceState } = useStore();
  const { isAuthenticated, isGuest, token, apiUrl } = useAuth();

  // Csak valódi bejelentkezett user-nél fut a sync (vendég módban nem)
  const canSync = isAuthenticated && !isGuest && !!token;

  // A pull mindig a friss state-et lássa (nem a mount-kori closure-t)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Push: lokális (dirty) változás → debounce 2s → push + 30s retry
  useSyncOnStateChange(state, canSync, token, apiUrl);

  // Pull: indításkor + online váltáskor → remote csere vagy mezőszintű merge
  usePullOnMount(canSync, token, apiUrl, () => stateRef.current, replaceState);

  return null; // nem renderel semmit
}

export default function App() {
  return (
    <AuthProvider>
      <InstitutionProvider>
        <StoreProvider>
          <ToastProvider>
            <SyncManager />
            <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 font-sans antialiased transition-colors app-container">
              <Shell />
            </div>
          </ToastProvider>
        </StoreProvider>
      </InstitutionProvider>
    </AuthProvider>
  );
}
