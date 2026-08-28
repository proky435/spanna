// src/App.jsx
// Fő komponens: betölti a kérdéseket, kezeli a képernyők közötti
// navigációt (Home | Flashcard | Exam | Stats), becsomagolja a StoreProvider-t.
// Mobil-first: alsó navigációs sáv, safe-area támogatás.

import React, { useState, useEffect } from 'react';
import { loadQuestions } from './data.js';
import { StoreProvider } from './store.jsx';
import { ToastProvider, Icon } from './components/ui.jsx';
import Home from './components/Home.jsx';
import Flashcard from './components/Flashcard.jsx';
import Exam from './components/Exam.jsx';
import Stats from './components/Stats.jsx';
import Survival from './components/Survival.jsx';
import TimeAttack from './components/TimeAttack.jsx';
import CheatSheet from './components/CheatSheet.jsx';
import ReverseQuiz from './components/ReverseQuiz.jsx';

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
    { key: 'home',  label: 'Kezdő',    icon: 'home' },
    { key: 'stats', label: 'Statisztika', icon: 'target' },
  ];
  return (
    <div className="fixed bottom-4 left-0 right-0 px-4 z-30 pointer-events-none bottom-nav">
      <nav className="max-w-sm mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-900/10 dark:shadow-black/40 rounded-full flex justify-between p-1.5 pointer-events-auto">
        {items.map((item) => {
          const active = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm transition-all btn-press ${
                active
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
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
  const [screen, setScreen] = useState({ name: 'home' });
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

  if (error) return <ErrorScreen err={error} onRetry={() => { setError(null); window.location.reload(); }} />;
  if (!questions) return <Spinner />;

  // Navigációs segédfüggvények
  const goHome = () => setScreen({ name: 'home' });
  const goStats = () => setScreen({ name: 'stats' });

  // Flashcard / Exam: teljes képernyős, nincs bottom nav
  if (screen.name === 'flashcard') {
    const restartKey = screen._nonce || 0;
    return (
      <Flashcard
        key={restartKey}
        questions={questions}
        ids={screen.ids}
        isWrongReview={screen.isWrongReview}
        isBookmarkReview={screen.isBookmarkReview}
        ordered={ordered}
        onBack={goHome}
        onRestart={() => setScreen({ ...screen, _nonce: Date.now() })}
        onPracticeWrong={(wrongIds) => setScreen({ name: 'flashcard', ids: wrongIds, isWrongReview: true, _nonce: Date.now() })}
      />
    );
  }

  if (screen.name === 'exam') {
    const restartKey = screen._nonce || 0;
    return (
      <Exam
        key={restartKey}
        questions={questions}
        ids={screen.ids}
        count={screen.count}
        onBack={goHome}
        onPracticeWrong={(wrongIds) => setScreen({ name: 'flashcard', ids: wrongIds, isWrongReview: true })}
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

  if (screen.name === 'stats') {
    return (
      <>
        <Stats questions={questions} onBack={goHome} />
        <BottomNav current="stats" onNavigate={(k) => k === 'home' ? goHome() : goStats()} />
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
        onStart={(mode, payload) => {
          if (mode === 'flashcard') setScreen({ name: 'flashcard', ...payload });
          if (mode === 'exam') setScreen({ name: 'exam', ...payload });
          if (mode === 'survival') setScreen({ name: 'survival', ...payload });
          if (mode === 'timeattack') setScreen({ name: 'timeattack', ...payload });
          if (mode === 'cheatsheet') setScreen({ name: 'cheatsheet', ...payload });
          if (mode === 'reversequiz') setScreen({ name: 'reversequiz', ...payload });
        }}
      />
      <BottomNav current="home" onNavigate={(k) => k === 'home' ? goHome() : goStats()} />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 font-sans antialiased transition-colors app-container">
          <Shell />
        </div>
      </ToastProvider>
    </StoreProvider>
  );
}
