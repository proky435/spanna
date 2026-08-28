// src/components/Survival.jsx
// Túlélő mód (Hardcore Run): 3 élet, hiba = élet mínusz.
// Cél: a leghosszabb helyes válasz-sorozat (streak) elérése.
// Véletlenszerű kérdések folyamatosan az összes közül.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { shuffle, letter } from '../data.js';
import { useStore } from '../store.jsx';
import { Badge, Button, Icon, Header, ProgressBar, EmptyState, useToast } from './ui.jsx';

export default function Survival({ questions, ids, onBack }) {
  const { state, markSeen, addWrong, removeWrong } = useStore();
  const toast = useToast();

  // Összes használható kérdés (az ids alapján)
  const pool = useMemo(() => {
    return ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  }, [ids, questions]);

  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [questionNum, setQuestionNum] = useState(1); // hányadik kérdés
  const usedRef = useRef([]); // már feltett kérdések (hogy ne ismétlődjön amíg van új)

  // Aktuális kérdés: véletlenszerűen a pool-ból, a még nem használtak közül
  const [currentQ, setCurrentQ] = useState(null);

  function pickNext() {
    if (pool.length === 0) return null;
    // Ha már minden kérdést felhasználtunk, kezdjük elölről
    if (usedRef.current.length >= pool.length) {
      usedRef.current = [];
    }
    const available = pool.filter((q) => !usedRef.current.includes(q.id));
    if (available.length === 0) return null;
    const next = available[Math.floor(Math.random() * available.length)];
    usedRef.current.push(next.id);
    return next;
  }

  // Első kérdés
  useEffect(() => {
    if (!currentQ && !gameOver) {
      setCurrentQ(pickNext());
    }
  }, [currentQ, gameOver]);

  // Billentyűzet
  const onKey = useCallback((e) => {
    if (gameOver || !currentQ) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (!answered) {
      const key = e.key.toUpperCase();
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= currentQ.options.length) { e.preventDefault(); answer(num - 1); return; }
      const li = 'ABCDEFGH'.indexOf(key);
      if (li >= 0 && li < currentQ.options.length) { e.preventDefault(); answer(li); return; }
    } else {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, gameOver, currentQ]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (pool.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Túlélő mód" onBack={onBack} />
        <EmptyState icon={<Icon name="target" />} title="Nincs elérhető kérdés" hint="Vissza a kezdőképernyőhöz." />
      </div>
    );
  }

  function answer(i) {
    if (answered) return;
    const isCorrect = i === currentQ.correctIndex;
    setAnswered(true);
    setChosen(i);
    markSeen(currentQ.id, isCorrect);

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      removeWrong(currentQ.id);
    } else {
      addWrong(currentQ.id);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        // Game over — kis késleltetés, hogy lássa a hibát
        setTimeout(() => setGameOver(true), 1200);
      }
    }
  }

  function next() {
    if (lives <= 0) {
      setGameOver(true);
      return;
    }
    setAnswered(false);
    setChosen(null);
    setQuestionNum((n) => n + 1);
    setCurrentQ(pickNext());
  }

  // ---- Game Over képernyő ----
  if (gameOver) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Vége!" subtitle="Túlélő mód eredménye" onBack={onBack} />
        <div className="card p-6 mb-6 text-center card-enter">
          <div className="text-6xl mb-2">💀</div>
          <div className="text-3xl font-bold text-rose-500">{bestStreak}</div>
          <p className="mt-2 text-lg font-medium">Leghosszabb sorozat</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{questionNum - 1} kérdés megválaszolva</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            label="Újra"
            variant="primary"
            icon={<Icon name="refresh" size={16} />}
            onClick={() => {
              setLives(3); setStreak(0); setBestStreak(0); setAnswered(false);
              setChosen(null); setGameOver(false); setQuestionNum(1);
              usedRef.current = []; setCurrentQ(pickNext());
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
      <Header title="Túlélő mód" subtitle="3 élet — mennyire bírod?" onBack={onBack} />

      {/* Top bar: életek + streak + kérdésszám */}
      <div className="flex items-center justify-between mb-4">
        {/* Életek (szívek) */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`text-2xl ${i < lives ? 'text-rose-500' : 'text-slate-300 dark:text-slate-700'}`}>
              {i < lives ? '❤️' : '🤍'}
            </span>
          ))}
        </div>
        {/* Streak */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200">
          <span className="text-sm font-bold">🔥 {streak}</span>
        </div>
      </div>

      {/* Kártya */}
      <div key={`${currentQ.id}-${questionNum}`} className="card p-5 sm:p-7 mb-4 card-enter">
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

      {/* Visszajelzés-sáv */}
      <div className="mb-4 min-h-[2.5rem] flex items-center gap-2">
        {answered && (
          currentQ.correctIndex === chosen ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <Icon name="check" size={20} /> <span>Helyes! 🔥 {streak} sorozat</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium">
              <Icon name="x" size={20} />
              <span>Helyes válasz: {letter(currentQ.correctIndex)} — élet mínusz! {lives > 0 ? `${lives} élet maradt` : 'GAME OVER'}</span>
            </div>
          )
        )}
      </div>

      {/* Navigáció */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-400">Legjobb: 🔥 {bestStreak}</div>
        <div className="text-xs text-slate-400 hidden sm:block">Space / → a folytatáshoz</div>
        <Button
          label="Következő"
          variant="primary"
          icon={<Icon name="arrowRight" size={16} />}
          onClick={next}
          disabled={!answered}
        />
      </div>
    </div>
  );
}
