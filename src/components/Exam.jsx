// src/components/Exam.jsx
// Vizsga / Teszt mód: NINCS azonnali visszajelzés; a végén összesítő
// százalékkal és részletes hibajegyzékkel. Billentyűzet-vezérlés (1-5 / A-E).

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { shuffle, letter, pct, fmtTime } from '../data.js';
import { useStore } from '../store.jsx';
import { Badge, Button, IconButton, Icon, Header, ProgressBar, EmptyState } from './ui.jsx';
import Confetti from './Confetti.jsx';

export default function Exam({ questions, ids, count, onBack, onPracticeWrong, onRestart }) {
  const { markSeen, addWrong, removeWrong, setLastExam, addExamHistory } = useStore();

  // Pakli: mindig véletlenszerű, count darab
  const deck = useMemo(() => {
    const pool = ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
    return shuffle(pool).slice(0, Math.min(count, pool.length));
  }, [ids, questions, count]);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(() => new Array(deck.length).fill(null));
  const [finished, setFinished] = useState(false);

  // Időmérés: elindul a komponens mount-jakor, leáll a finished=true-nál
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [finished]);

  const q = deck[idx];

  const go = useCallback((newIdx) => {
    if (newIdx < 0) return;
    if (newIdx >= deck.length) {
      const unanswered = answers.filter((a) => a === null).length;
      if (unanswered > 0) {
        if (!confirm(`${unanswered} kérdésre még nem válaszoltál. Biztosan befejezed a vizsgát?`)) return;
      }
      setFinished(true);
      return;
    }
    setIdx(newIdx);
  }, [answers, deck.length]);

  // Billentyűzet
  const onKey = useCallback((e) => {
    if (finished) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (!q) return;
    const key = e.key.toUpperCase();
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= q.options.length) { e.preventDefault(); select(num - 1); return; }
    const li = 'ABCDEFGH'.indexOf(key);
    if (li >= 0 && li < q.options.length) { e.preventDefault(); select(li); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(idx - 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, q, idx, go]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  function select(i) {
    setAnswers((a) => {
      const next = a.slice();
      next[idx] = i;
      return next;
    });
  }

  // ---- Befejezés: eredmény számítása (tiszta useMemo, mellékhatások nélkül) ----
  const result = useMemo(() => {
    if (!finished) return null;
    let correct = 0;
    const wrongList = [];
    deck.forEach((dq, i) => {
      const a = answers[i];
      const isCorrect = a === dq.correctIndex;
      if (isCorrect) correct++;
      else wrongList.push({ q: dq, chosen: a });
    });
    const total = deck.length;
    const p = pct(correct, total);
    return { total, correct, percent: p, wrongList, at: Date.now() };
  }, [finished]); // csak egyszer számoljon

  // Mellékhatások (dispatch) külön useEffect-ben, ref-védelemmel,
  // hogy StrictMode-ban se futtasson duplán.
  const savedRef = useRef(false);
  useEffect(() => {
    if (!finished || !result || savedRef.current) return;
    savedRef.current = true;
    // Haladás + hibák mentése
    deck.forEach((dq, i) => {
      const a = answers[i];
      const isCorrect = a === dq.correctIndex;
      markSeen(dq.id, isCorrect);
      if (isCorrect) removeWrong(dq.id);
      else addWrong(dq.id);
    });
    setLastExam({ total: result.total, correct: result.correct, percent: result.percent, at: result.at });
    // Mentés a vizsgatörténetbe (Stats timeline)
    addExamHistory({
      date: result.at,
      total: result.total,
      correct: result.correct,
      percent: result.percent,
      mode: 'exam',
      wrongList: result.wrongList.map((w) => ({ id: w.q.id, chosen: w.chosen })),
    });
  }, [finished, result]);

  if (deck.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title="Vizsga mód" onBack={onBack} />
        <EmptyState
          icon={<Icon name="target" />}
          title="Nincs elérhető kérdés"
          hint="Vissza a kezdőképernyőhöz és válassz másik szűrést."
        />
      </div>
    );
  }

  // ---- Összesítő képernyő ----
  if (finished && result) {
    const { total, correct, percent, wrongList } = result;
    const tone = percent >= 80 ? 'green' : percent >= 50 ? 'amber' : 'red';
    const toneText = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-rose-600' }[tone];
    const verdict = percent >= 80 ? 'Kiváló!' : percent >= 60 ? 'Jó munka!' : percent >= 40 ? 'Még kell gyakorolni' : 'Gyakorolj tovább!';

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Confetti active={percent >= 80} />
        <Header title="Vizsga eredménye" subtitle={`${correct} / ${total} helyes`} onBack={onBack} />

        <div className="card p-6 mb-6 text-center card-enter">
          <div className={`text-7xl font-bold ${toneText}`}>{percent}%</div>
          <p className="mt-2 text-lg font-medium">{verdict}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{correct} helyes / {total - correct} hibás</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            ⏱ {fmtTime(elapsed)} • {total > 0 ? fmtTime(Math.round(elapsed / total)) : '00:00'} / kérdés
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <Button
            label={wrongList.length ? 'Hibázottak gyakorlása' : 'Nincs hiba'}
            variant={wrongList.length ? 'primary' : 'secondary'}
            icon={<Icon name="refresh" size={16} />}
            disabled={wrongList.length === 0}
            onClick={() => onPracticeWrong && onPracticeWrong(wrongList.map((w) => w.q.id))}
          />
          <Button
            label="Új vizsga"
            variant="secondary"
            icon={<Icon name="target" size={16} />}
            onClick={() => onRestart && onRestart()}
          />
          <Button label="Vissza a kezdőlapra" variant="ghost" onClick={onBack} />
        </div>

        {wrongList.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Hibajegyzék</h2>
            <div className="flex flex-col gap-3">
              {wrongList.map(({ q: dq, chosen }, i) => (
                <div key={dq.id} className="card p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-bold text-rose-500 mt-0.5">#{i + 1}</span>
                    <p className="text-sm font-medium flex-1">{dq.question}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm">
                    {dq.options.map((opt, oi) => {
                      let cls = 'text-slate-500 dark:text-slate-400';
                      let mark = '';
                      if (oi === dq.correctIndex) { cls = 'text-emerald-600 dark:text-emerald-400 font-medium'; mark = '✓ '; }
                      else if (oi === chosen) { cls = 'text-rose-600 dark:text-rose-400 font-medium line-through'; mark = '✗ '; }
                      return (
                        <div key={oi} className={`flex items-center gap-2 ${cls}`}>
                          <span className="w-5 text-center font-semibold">{letter(oi)}</span>
                          <span>{mark}{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- Kérdés képernyő ----
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
      <Header
        title="Vizsga mód"
        subtitle={`${deck.length} kérdés • A végén összesítő és hibajegyzék`}
        onBack={() => {
          if (confirm('Biztosan megszakítod a vizsgát? Az eddigi válaszok elvesznek.')) onBack();
        }}
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="text-sm font-medium tabular-nums whitespace-nowrap">{idx + 1} / {deck.length}</div>
        <div className="flex-1"><ProgressBar current={idx + 1} total={deck.length} /></div>
        <div className="text-sm font-medium tabular-nums whitespace-nowrap text-brand-600 dark:text-brand-400">
          {fmtTime(elapsed)}
        </div>
      </div>

      <div key={q.id} className="card p-5 sm:p-7 mb-4 card-enter">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge text={q.subject} tone="brand" title={q.subject} />
          <Badge text={q.topic} tone="slate" title={q.topic} />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold leading-snug mb-5">{q.question}</h2>

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, i) => {
            const selected = answers[idx] === i;
            const cls = selected
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-100'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20';
            const badgeCls = selected
              ? 'bg-brand-500 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-brand-100 group-hover:text-brand-700 dark:group-hover:bg-brand-900/40 dark:group-hover:text-brand-200';
            return (
              <button
                key={i}
                type="button"
                onClick={() => select(i)}
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

      <div className="flex items-center justify-between gap-3">
        <Button label="Előző" variant="ghost" icon={<Icon name="arrowLeft" size={16} />} onClick={() => go(idx - 1)} disabled={idx === 0} />
        <div className="text-xs text-slate-400 hidden sm:block">1-5 / A-E a választáshoz</div>
        <Button
          label={idx === deck.length - 1 ? 'Befejezés' : 'Következő'}
          variant="primary"
          icon={<Icon name="arrowRight" size={16} />}
          onClick={() => go(idx + 1)}
        />
      </div>
    </div>
  );
}
