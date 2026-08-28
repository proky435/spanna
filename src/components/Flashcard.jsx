// src/components/Flashcard.jsx
// Kártyás tanuló mód: azonnali visszajelzés, billentyűzet-vezérlés,
// könyvjelzőzés, haladási sáv. SM-2 spaced repetition: a nehezebb
// kérdések gyakrabban jönnek, a hibázottak visszakerülnek a pakliba.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { shuffle, letter, buildSM2Deck, getDifficulty } from '../data.js';
import { useStore } from '../store.jsx';
import { Badge, Button, IconButton, Icon, Header, ProgressBar, EmptyState, useToast } from './ui.jsx';

export default function Flashcard({ questions, ids, isWrongReview, isBookmarkReview, onBack, onRestart, onPracticeWrong, ordered }) {
  const { state, markSeen, addWrong, removeWrong, toggleBookmark, isBookmarked } = useStore();
  const toast = useToast();

  // SM-2 alapú pakli építés: a nehezebb (több hibás, alacsonyabb EF) kérdések
  // előrébb kerülnek. Ha ordered=true, akkor sorrendben (SM-2 nélkül).
  const initialDeck = useMemo(() => {
    if (ordered) {
      return ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
    }
    return buildSM2Deck(questions, ids, state.sm2, true);
  }, [ids, questions, state.sm2, ordered]);

  // A pakli egy state-ben van, hogy hibázásnál tudjunk hozzáadni (visszapakolás)
  const [deck, setDeck] = useState(initialDeck);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [wrongIds, setWrongIds] = useState([]); // session-ben elrontott kérdések (unique)
  const [totalAnswered, setTotalAnswered] = useState(0); // összes válasz (több lehet mint deck.length a visszapakolás miatt)
  const requeuedRef = useRef(new Map()); // mely kérdéseket pakoltuk már vissza (hogy ne pakoljuk végtelenül)

  const q = deck[idx];

  // Billentyűzet-vezérlés: csak válaszadás (1-5, A-E), léptetés csak gombbal
  const onKey = useCallback((e) => {
    if (finished) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (!q) return;
    if (answered) return; // válasz után nincs billentyűzet akció

    const key = e.key.toUpperCase();
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= q.options.length) { e.preventDefault(); answer(num - 1); return; }
    const li = 'ABCDEFGH'.indexOf(key);
    if (li >= 0 && li < q.options.length) { e.preventDefault(); answer(li); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, finished, q, idx]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (deck.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title={title()} subtitle="Újragyakorlás azonnali visszajelzéssel" onBack={onBack} />
        <EmptyState
          icon={<Icon name="book" />}
          title="Nincs gyakorolandó kérdés"
          hint="Vissza a kezdőképernyőhöz és válassz egy másik módot."
        />
      </div>
    );
  }

  function title() {
    return isWrongReview ? 'Hibázott kérdések' : isBookmarkReview ? 'Könyvjelzőzött kérdések' : 'Kártyás tanulás';
  }
  function subtitle() {
    return isWrongReview ? 'Újragyakorlás azonnali visszajelzéssel'
      : isBookmarkReview ? 'Nehéz kérdések átismétlése'
      : 'SM-2 ismétlés • 1-5 / A-E billentyűk a válaszhoz';
  }

  function answer(i) {
    if (answered) return;
    const isCorrect = i === q.correctIndex;
    setAnswered(true);
    setChosen(i);
    setTotalAnswered((n) => n + 1);
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      // Helyes volt: kiveszzük a wrongIds-ből (ha benne volt)
      setWrongIds((w) => w.filter((id) => id !== q.id));
    } else {
      setWrongIds((w) => w.includes(q.id) ? w : [...w, q.id]); // session hibakövetés (unique)
    }
    markSeen(q.id, isCorrect);
    if (isCorrect) removeWrong(q.id);
    else addWrong(q.id);
  }

  function next() {
    // Szinkronan számoljuk ki az új pakli hosszt (elkerüljük a stale closure-t)
    let newDeckLength = deck.length;

    if (!answered) {
      // Kihagyás: látottnak jelöljük, de nem hiba
      if (q) markSeen(q.id, false);
    } else if (q && q.correctIndex !== chosen) {
      // Hibázott: visszapakoljuk a pakli végére (ha még nem volt visszapakolva 2x)
      const requeueCount = requeuedRef.current.get(q.id) || 0;
      if (requeueCount < 2) {
        requeuedRef.current.set(q.id, requeueCount + 1);
        setDeck((d) => [...d, q]);
        newDeckLength = deck.length + 1;
      }
    }

    if (idx + 1 >= newDeckLength) {
      setFinished(true);
      return;
    }
    setIdx((i) => i + 1);
    setAnswered(false);
    setChosen(null);
  }

  // ---- Befejező képernyő ----
  if (finished) {
    const total = totalAnswered || deck.length;
    const uniqueTotal = new Set(deck.slice(0, idx + 1).map((d) => d.id)).size;
    const p = totalAnswered ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const tone = p >= 80 ? 'green' : p >= 50 ? 'amber' : 'red';
    const toneText = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-rose-600' }[tone];
    const verdict = p >= 80 ? 'Kiváló!' : p >= 60 ? 'Jó munka!' : p >= 40 ? 'Még kell gyakorolni' : 'Gyakorolj tovább!';

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Eredmény" subtitle={`${correctCount} / ${totalAnswered} helyes válasz`} onBack={onBack} />
        <div className="card p-6 mb-6 text-center card-enter">
          <div className={`text-7xl font-bold ${toneText}`}>{p}%</div>
          <p className="mt-2 text-lg font-medium">{verdict}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            {correctCount} helyes / {totalAnswered - correctCount} hibás • {uniqueTotal} egyedi kérdés
          </p>
          {wrongIds.length > 0 && (
            <p className="mt-2 text-sm text-rose-500">{wrongIds.length} kérdés még mindig hibás — gyakorold újra!</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {wrongIds.length > 0 && (
            <Button
              label={`Hibázottak újra (${wrongIds.length})`}
              variant="primary"
              icon={<Icon name="refresh" size={16} />}
              onClick={() => onPracticeWrong && onPracticeWrong(wrongIds)}
            />
          )}
          <Button
            label="Újra gyakorlás"
            variant={wrongIds.length > 0 ? 'secondary' : 'primary'}
            icon={<Icon name="refresh" size={16} />}
            onClick={() => onRestart && onRestart()}
          />
          <Button label="Vissza a kezdőlapra" variant="secondary" onClick={onBack} />
        </div>
      </div>
    );
  }

  const bm = q ? isBookmarked(q.id) : false;
  const diff = q ? getDifficulty(state.sm2, q.id) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
      <Header title={title()} subtitle={subtitle()} onBack={onBack} />

      {/* Top bar: számláló + haladás + bookmark */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-sm font-medium tabular-nums whitespace-nowrap">{idx + 1} / {deck.length}</div>
        <div className="flex-1"><ProgressBar current={idx} total={deck.length} /></div>
        <IconButton
          icon={<Icon name={bm ? 'starFilled' : 'star'} size={20} />}
          title={bm ? 'Könyvjelző eltávolítása' : 'Megjelölés nehéznek'}
          variant={bm ? 'active' : 'ghost'}
          className="ml-1"
          onClick={() => {
            const now = toggleBookmark(q.id);
            toast(now ? 'Könyvjelzőzve' : 'Könyvjelző eltávolítva', now ? 'brand' : 'slate');
          }}
        />
      </div>

      {/* Kártya */}
      <div key={`${q.id}-${idx}`} className="card p-5 sm:p-7 mb-4 card-enter">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge text={q.subject} tone="brand" title={q.subject} />
          <Badge text={q.topic} tone="slate" title={q.topic} />
          {diff && diff.level !== 'new' && (
            <Badge text={diff.label} tone={diff.color} title={`SM-2 nehézség: ${diff.level}`} />
          )}
        </div>
        <h2 className="text-lg sm:text-xl font-semibold leading-snug mb-5">{q.question}</h2>

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
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
          q.correctIndex === chosen ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <Icon name="check" size={20} /> <span>Helyes!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium">
              <Icon name="x" size={20} /> <span>Helyes válasz: {letter(q.correctIndex)} — újra jön a pakli végén!</span>
            </div>
          )
        )}
      </div>

      {/* Navigáció */}
      <div className="flex items-center justify-between gap-3">
        <Button label="Kihagyás" variant="ghost" onClick={next} disabled={answered} />
        <div className="text-xs text-slate-400 hidden sm:block">Kattints a folytatáshoz</div>
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
