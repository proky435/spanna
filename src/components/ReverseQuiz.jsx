// src/components/ReverseQuiz.jsx
// Fordított kvíz: megadja a HELYES VÁLASZT, és 4 KÉRDÉS közül kell
// kiválasztani, melyikre ez a helyes válasz. Más szemszög, agytorna.
//
// Mechanika:
// 1. Választunk egy "célválaszt" (egy kérdés helyes opciója).
// 2. Mutatjuk ezt a választ fent, nagy zöld kiemeléssel.
// 3. 4 kérdés közül kell kiválasztani, melyikre ez a helyes válasz.
//    A 4 kérdés közül az egyikre tényleg ez a helyes válasz,
//    a másik 3 olyan kérdés, amiknek más a helyes válasza (de hasonló témában).
// 4. Azonnali visszajelzés: helyes = zöld, hibás = piros + mutatja melyik volt jó.
// 5. 3 élet, hiba = élet mínusz. Game over = eredmény képernyő.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { shuffle, letter } from '../data.js';
import { useStore } from '../store.jsx';
import { Badge, Button, Icon, Header, EmptyState } from './ui.jsx';

export default function ReverseQuiz({ questions, ids, onBack }) {
  const { markSeen, addWrong, removeWrong } = useStore();

  const pool = useMemo(() => {
    return ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  }, [ids, questions]);

  const [lives, setLives] = useState(3);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState(null); // kiválasztott kérdés indexe (0-3)
  const [gameOver, setGameOver] = useState(false);
  const [round, setRound] = useState(1);
  const usedRef = useRef([]);

  // Egy "kör" állapota: célválasz + 4 kérdés (egyikkel a helyes)
  const [roundData, setRoundData] = useState(null);

  function buildRound() {
    if (pool.length === 0) return null;
    if (usedRef.current.length >= pool.length) usedRef.current = [];

    // Válasszunk egy "célkérdést" — ennek a helyes válasza lesz a célválasz
    const available = pool.filter((q) => !usedRef.current.includes(q.id));
    if (available.length === 0) return null;
    const targetQ = available[Math.floor(Math.random() * available.length)];
    usedRef.current.push(targetQ.id);
    const targetAnswer = targetQ.options[targetQ.correctIndex];

    // 3 "csali" kérdés: olyanok, amiknek NEM ez a helyes válasza
    // Preferáljuk azonos tantárgyból (hogy ne legyen túl könnyű)
    const sameSubject = pool.filter(
      (q) => q.id !== targetQ.id && q.subject === targetQ.subject && q.options[q.correctIndex] !== targetAnswer
    );
    const others = pool.filter(
      (q) => q.id !== targetQ.id && q.subject !== targetQ.subject && q.options[q.correctIndex] !== targetAnswer
    );
    const candidates = sameSubject.length >= 3 ? sameSubject : [...sameSubject, ...others];
    const shuffledCandidates = shuffle(candidates);
    const distractors = shuffledCandidates.slice(0, 3);

    // Ha nincs elég csali (pl. nagyon kevés kérdés van), kiegészítjük
    while (distractors.length < 3) {
      const extra = pool.find((q) => q.id !== targetQ.id && !distractors.includes(q) && q.options[q.correctIndex] !== targetAnswer);
      if (!extra) break;
      distractors.push(extra);
    }

    // 4 kérdés keverve: a cél + 3 csali
    const allQuestions = shuffle([targetQ, ...distractors]);
    const correctIndex = allQuestions.findIndex((q) => q.id === targetQ.id);

    return {
      targetAnswer,
      targetSubject: targetQ.subject,
      targetTopic: targetQ.topic,
      questions: allQuestions, // 4 kérdés
      correctIndex, // melyik index a helyes
      targetQId: targetQ.id, // a célkérdés ID-ja (markSeen-hez)
    };
  }

  // Első kör
  useEffect(() => {
    if (!roundData && !gameOver) {
      setRoundData(buildRound());
    }
  }, [roundData, gameOver]);

  // Billentyűzet: 1-4 / A-D
  const onKey = useCallback((e) => {
    if (gameOver || !roundData) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (!answered) {
      const key = e.key.toUpperCase();
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= roundData.questions.length) { e.preventDefault(); answer(num - 1); return; }
      const li = 'ABCDEFGH'.indexOf(key);
      if (li >= 0 && li < roundData.questions.length) { e.preventDefault(); answer(li); return; }
    } else {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, gameOver, roundData]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (pool.length < 4) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Fordított kvíz" onBack={onBack} />
        <EmptyState
          icon={<Icon name="target" />}
          title="Nincs elég kérdés"
          hint="A fordított kvízhez legalább 4 kérdés kell. Vissza a kezdőképernyőhöz."
        />
      </div>
    );
  }

  function answer(i) {
    if (answered) return;
    const isCorrect = i === roundData.correctIndex;
    setAnswered(true);
    setChosen(i);
    markSeen(roundData.targetQId, isCorrect);

    if (isCorrect) {
      setCorrect((c) => c + 1);
      removeWrong(roundData.targetQId);
    } else {
      addWrong(roundData.targetQId);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setTimeout(() => setGameOver(true), 1500);
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
    setRound((r) => r + 1);
    setRoundData(buildRound());
  }

  // ---- Game Over képernyő ----
  if (gameOver) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Vége!" subtitle="Fordított kvíz eredménye" onBack={onBack} />
        <div className="card p-6 mb-6 text-center card-enter">
          <div className="text-6xl mb-2">🔄</div>
          <div className="text-3xl font-bold text-brand-500">{correct}</div>
          <p className="mt-2 text-lg font-medium">helyes párosítás</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{round - 1} kör megvívva</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            label="Újra"
            variant="primary"
            icon={<Icon name="refresh" size={16} />}
            onClick={() => {
              setLives(3); setCorrect(0); setAnswered(false); setChosen(null);
              setGameOver(false); setRound(1); usedRef.current = []; setRoundData(null);
            }}
          />
          <Button label="Vissza a kezdőlapra" variant="secondary" onClick={onBack} />
        </div>
      </div>
    );
  }

  if (!roundData) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
      <Header title="Fordított kvíz" subtitle="A válasz adott — melyik kérdésre?" onBack={onBack} />

      {/* Top bar: életek + pontszám */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`text-2xl ${i < lives ? 'text-rose-500' : 'text-slate-300 dark:text-slate-700'}`}>
              {i < lives ? '❤️' : '🤍'}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
          <span className="text-sm font-bold">✓ {correct}</span>
        </div>
      </div>

      {/* Célválasz — nagy zöld kiemelés */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-5 mb-4 text-center card-enter">
        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
          Helyes válasz
        </div>
        <div className="text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-200">
          {roundData.targetAnswer}
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Badge text={roundData.targetSubject} tone="brand" />
          <Badge text={roundData.targetTopic} tone="slate" />
        </div>
      </div>

      {/* Utasítás */}
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4">
        Melyik kérdésre ez a helyes válasz?
      </p>

      {/* 4 kérdés — gombként */}
      <div className="flex flex-col gap-2.5 mb-4">
        {roundData.questions.map((q, i) => {
          const isCorrect = i === roundData.correctIndex;
          const isChosen = i === chosen;
          let cls = 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20';
          let badgeCls = 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
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
              key={q.id}
              type="button"
              disabled={answered}
              onClick={() => answer(i)}
              className={`group w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all flex items-center gap-3 ${cls}`}
            >
              <span className={`w-8 h-8 shrink-0 rounded-lg font-semibold flex items-center justify-center text-sm transition-colors ${badgeCls}`}>
                {letter(i)}
              </span>
              <span className="flex-1 text-sm sm:text-base">{q.question}</span>
            </button>
          );
        })}
      </div>

      {/* Visszajelzés-sáv */}
      <div className="mb-4 min-h-[2.5rem] flex items-center gap-2">
        {answered && (
          chosen === roundData.correctIndex ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <Icon name="check" size={20} /> <span>Helyes párosítás!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium">
              <Icon name="x" size={20} />
              <span>Rossz! A helyes kérdés: {letter(roundData.correctIndex)} {lives > 0 ? `— ${lives} élet maradt` : ''}</span>
            </div>
          )
        )}
      </div>

      {/* Navigáció */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-400">Kör: {round}</div>
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
