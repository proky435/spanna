// src/components/TimeAttack.jsx
// Időfutam (Time Attack): 60 másodperced van.
// Hány kérdést tudsz megválaszolni HIBÁTLANUL?
// Egy hiba = azonnal vége (vagy opcionálisan: hiba is számít, de nem áll le).
// Itt: hiba is számít, de nem áll le — a cél a max helyes válasz 60 másodperc alatt.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { letter, fmtTime } from '../data.js';
import { useStore } from '../store.jsx';
import { Badge, Button, Icon, Header, EmptyState } from './ui.jsx';

const TIME_LIMIT = 60; // másodperc

export default function TimeAttack({ questions, ids, onBack }) {
  const { markSeen, addWrong, removeWrong } = useStore();

  const pool = useMemo(() => {
    return ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  }, [ids, questions]);

  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const usedRef = useRef([]);
  const [currentQ, setCurrentQ] = useState(null);

  function pickNext() {
    if (pool.length === 0) return null;
    if (usedRef.current.length >= pool.length) usedRef.current = [];
    const available = pool.filter((q) => !usedRef.current.includes(q.id));
    if (available.length === 0) return null;
    const next = available[Math.floor(Math.random() * available.length)];
    usedRef.current.push(next.id);
    return next;
  }

  // Időzítő — csak ha elindult és még nincs vége
  useEffect(() => {
    if (!started || gameOver) return;
    if (timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [started, gameOver, timeLeft]);

  // Első kérdés indításkor
  useEffect(() => {
    if (started && !currentQ && !gameOver) {
      setCurrentQ(pickNext());
    }
  }, [started, currentQ, gameOver]);

  // Billentyűzet
  const onKey = useCallback((e) => {
    if (gameOver || !started || !currentQ) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (!answered) {
      const key = e.key.toUpperCase();
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= currentQ.options.length) { e.preventDefault(); answer(num - 1); return; }
      const li = 'ABCDEFGH'.indexOf(key);
      if (li >= 0 && li < currentQ.options.length) { e.preventDefault(); answer(li); return; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, gameOver, started, currentQ]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (pool.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Időfutam" onBack={onBack} />
        <EmptyState icon={<Icon name="target" />} title="Nincs elérhető kérdés" hint="Vissza a kezdőképernyőhöz." />
      </div>
    );
  }

  function answer(i) {
    if (answered || gameOver) return;
    const isCorrect = i === currentQ.correctIndex;
    setAnswered(true);
    setChosen(i);
    markSeen(currentQ.id, isCorrect);

    if (isCorrect) {
      setCorrect((c) => c + 1);
      removeWrong(currentQ.id);
    } else {
      setWrong((w) => w + 1);
      addWrong(currentQ.id);
    }

    // Automatikus tovább 600ms után (gyors tempó!)
    setTimeout(() => {
      if (timeLeft > 0) {
        setAnswered(false);
        setChosen(null);
        setCurrentQ(pickNext());
      }
    }, 600);
  }

  // ---- Kezdő képernyő ----
  if (!started) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Időfutam" subtitle="60 másodperc — mennyit bírsz?" onBack={onBack} />
        <div className="card p-8 text-center card-enter">
          <div className="text-6xl mb-4">⏱️</div>
          <h2 className="text-2xl font-bold mb-2">60 másodperced van</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Hány kérdést tudsz megválaszolni? A hiba is számít, de nem áll le —
            a cél a maximum helyes válasz elérése gyors tempóban!
          </p>
          <Button
            label="Start!"
            variant="primary"
            className="text-lg px-8 py-3"
            onClick={() => { setStarted(true); setTimeLeft(TIME_LIMIT); }}
          />
        </div>
      </div>
    );
  }

  // ---- Game Over képernyő ----
  if (gameOver) {
    const total = correct + wrong;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Lejárt az idő!" subtitle="Időfutam eredménye" onBack={onBack} />
        <div className="card p-6 mb-6 text-center card-enter">
          <div className="text-6xl mb-2">⏱️</div>
          <div className="text-5xl font-bold text-brand-500">{correct}</div>
          <p className="mt-2 text-lg font-medium">helyes válasz 60 másodperc alatt</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            {correct} helyes / {wrong} hibás • {accuracy}% pontosság
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            label="Újra"
            variant="primary"
            icon={<Icon name="refresh" size={16} />}
            onClick={() => {
              setStarted(false); setGameOver(false); setCorrect(0); setWrong(0);
              setAnswered(false); setChosen(null); setTimeLeft(TIME_LIMIT);
              usedRef.current = []; setCurrentQ(null);
            }}
          />
          <Button label="Vissza a kezdőlapra" variant="secondary" onClick={onBack} />
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
      <Header title="Időfutam" onBack={onBack} />

      {/* Top bar: idő + pontszám */}
      <div className="flex items-center justify-between mb-4">
        <div className={`text-2xl font-bold tabular-nums ${timeLeft <= 10 ? 'text-rose-500' : 'text-brand-500'}`}>
          ⏱ {fmtTime(timeLeft)}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
            <span className="text-sm font-bold">✓ {correct}</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
            <span className="text-sm font-bold">✗ {wrong}</span>
          </div>
        </div>
      </div>

      {/* Kártya */}
      <div key={`${currentQ.id}-${correct + wrong}`} className="card p-5 sm:p-7 mb-4 card-enter">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge text={currentQ.subject} tone="brand" title={currentQ.subject} />
          <Badge text={currentQ.topic} tone="slate" title={currentQ.topic} />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold leading-snug mb-5">{currentQ.question}</h2>

        <div className="flex flex-col gap-2.5">
          {currentQ.options.map((opt, i) => {
            const isCorrect = i === currentQ.correctIndex;
            const isChosen = i === chosen;
            let cls = 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20';
            let badgeCls = 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-brand-100 group-hover:text-brand-700 dark:group-hover:bg-brand-900/40 dark:group-hover:text-brand-200';
            if (answered) {
              if (isCorrect) {
                cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 correct-pop';
                badgeCls = 'bg-emerald-500 text-white';
              } else if (isChosen) {
                cls = 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 wrong-shake';
                badgeCls = 'bg-rose-500 text-white';
              } else {
                cls = 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 opacity-60';
              }
            }
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => answer(i)}
                className={`group w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all flex items-center gap-3 ${cls}`}
              >
                <span className={`w-8 h-8 shrink-0 rounded-lg font-semibold flex items-center justify-center text-sm transition-colors ${badgeCls}`}>
                  {letter(i)}
                </span>
                <span className="flex-1 text-sm sm:text-base">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        Automatikus tovább válasz után • 1-5 / A-E billentyűk
      </div>
    </div>
  );
}
