// src/components/Exam.jsx
// Vizsga / Teszt mód: NINCS azonnali visszajelzés; a végén összesítő
// százalékkal és részletes hibajegyzékkel. Billentyűzet-vezérlés (1-5 / A-E).

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { shuffle, letter, pct, fmtTime } from '../data.js';
import { useStore } from '../store.jsx';
import { gradeQuestion, isAnswered, questionType } from '../grading.js';
import { Badge, Button, IconButton, Icon, Header, ProgressBar, EmptyState } from './ui.jsx';
import Confetti from './Confetti.jsx';

function formatPoints(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function QuestionReview({ question, answer, grade, pending = false }) {
  const type = questionType(question);
  if (type === 'short_text' || type === 'long_text') {
    const accepted = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
          <span className="text-xs text-slate-400">A válaszod</span>
          <p className="mt-1 whitespace-pre-wrap">{answer || 'Nem válaszoltál'}</p>
        </div>
        {pending ? (
          <p className="text-amber-600 dark:text-amber-400 font-medium">Kézi javításra vár • {formatPoints(grade.maxPoints)} pont</p>
        ) : accepted.length > 0 ? (
          <p className="text-emerald-600 dark:text-emerald-400">Elfogadott válasz: {accepted.join(' / ')}</p>
        ) : null}
        {question.explanation && <p className="text-slate-500 dark:text-slate-400">{question.explanation}</p>}
      </div>
    );
  }

  const options = Array.isArray(question.options) ? question.options : [];
  const expected = type === 'multiple_choice'
    ? question.correctAnswer || []
    : [type === 'true_false' ? (question.correctAnswer ? 0 : 1) : (Number.isInteger(question.correctAnswer) ? question.correctAnswer : question.correctIndex)];
  const selected = type === 'multiple_choice'
    ? (Array.isArray(answer) ? answer : [])
    : [type === 'true_false' ? (typeof answer === 'boolean' ? (answer ? 0 : 1) : null) : answer];

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {options.map((option, optionIndex) => {
        const correct = expected.includes(optionIndex);
        const chosen = selected.includes(optionIndex);
        let cls = 'text-slate-500 dark:text-slate-400';
        let mark = '';
        if (correct) { cls = 'text-emerald-600 dark:text-emerald-400 font-medium'; mark = '✓ '; }
        else if (chosen) { cls = 'text-rose-600 dark:text-rose-400 font-medium line-through'; mark = '✗ '; }
        return <div key={optionIndex} className={`flex items-center gap-2 ${cls}`}><span className="w-5 text-center font-semibold">{letter(optionIndex)}</span><span>{mark}{option}</span></div>;
      })}
      {grade.awardedPoints > 0 && !grade.isCorrect && (
        <p className="mt-2 text-amber-600 dark:text-amber-400">Részpont: {formatPoints(grade.awardedPoints)} / {formatPoints(grade.maxPoints)}</p>
      )}
      {question.explanation && <p className="mt-2 text-slate-500 dark:text-slate-400">{question.explanation}</p>}
    </div>
  );
}

export default function Exam({ questions, ids, count, onBack, onPracticeWrong, onRestart, title = 'Vizsga mód', historyMode = 'exam', timeLimit = null }) {
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
      const nextElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (timeLimit && nextElapsed >= timeLimit) {
        setElapsed(timeLimit);
        setFinished(true);
        return;
      }
      setElapsed(nextElapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [finished, timeLimit]);

  const q = deck[idx];

  const go = useCallback((newIdx) => {
    if (newIdx < 0) return;
    if (newIdx >= deck.length) {
      const unanswered = answers.filter((answer, answerIndex) => !isAnswered(deck[answerIndex], answer)).length;
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
    const options = Array.isArray(q.options) ? q.options : [];
    if (num >= 1 && num <= options.length) { e.preventDefault(); select(num - 1); return; }
    const li = 'ABCDEFGH'.indexOf(key);
    if (li >= 0 && li < options.length) { e.preventDefault(); select(li); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(idx - 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, q, idx, go]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  function setAnswer(value) {
    setAnswers((current) => {
      const next = current.slice();
      next[idx] = value;
      return next;
    });
  }

  function select(i) {
    const type = questionType(q);
    if (type === 'multiple_choice') {
      const current = Array.isArray(answers[idx]) ? answers[idx] : [];
      setAnswer(current.includes(i) ? current.filter((value) => value !== i) : [...current, i]);
      return;
    }
    if (type === 'true_false') {
      setAnswer(i === 0);
      return;
    }
    setAnswer(i);
  }

  // ---- Befejezés: eredmény számítása (tiszta useMemo, mellékhatások nélkül) ----
  const result = useMemo(() => {
    if (!finished) return null;
    let correct = 0;
    let earnedPoints = 0;
    let gradedPoints = 0;
    let maxPoints = 0;
    const wrongList = [];
    const pendingList = [];
    deck.forEach((dq, i) => {
      const chosen = answers[i];
      const grade = gradeQuestion(dq, chosen);
      maxPoints += grade.maxPoints;
      if (grade.status === 'pending') {
        pendingList.push({ q: dq, chosen, grade });
        return;
      }
      gradedPoints += grade.maxPoints;
      earnedPoints += grade.awardedPoints;
      if (grade.isCorrect) correct++;
      else wrongList.push({ q: dq, chosen, grade });
    });
    const total = deck.length;
    const percent = pct(earnedPoints, gradedPoints);
    return { total, correct, percent, wrongList, pendingList, earnedPoints, gradedPoints, maxPoints, at: Date.now() };
  }, [finished, deck, answers]);

  // Mellékhatások (dispatch) külön useEffect-ben, ref-védelemmel,
  // hogy StrictMode-ban se futtasson duplán.
  const savedRef = useRef(false);
  useEffect(() => {
    if (!finished || !result || savedRef.current) return;
    savedRef.current = true;
    // Haladás + hibák mentése
    deck.forEach((dq, i) => {
      const grade = gradeQuestion(dq, answers[i]);
      if (grade.status === 'pending') return;
      markSeen(dq.id, grade.isCorrect);
      if (grade.isCorrect) removeWrong(dq.id);
      else addWrong(dq.id);
    });
    setLastExam({
      total: result.total,
      correct: result.correct,
      percent: result.percent,
      earnedPoints: result.earnedPoints,
      gradedPoints: result.gradedPoints,
      pendingCount: result.pendingList.length,
      at: result.at,
      mode: historyMode,
      duration: elapsed,
    });
    // Mentés a vizsgatörténetbe (Stats timeline)
    addExamHistory({
      date: result.at,
      total: result.total,
      correct: result.correct,
      percent: result.percent,
      earnedPoints: result.earnedPoints,
      gradedPoints: result.gradedPoints,
      maxPoints: result.maxPoints,
      pendingCount: result.pendingList.length,
      mode: historyMode,
      duration: elapsed,
      timeLimit,
      wrongList: result.wrongList.map((w) => ({
        id: w.q.id,
        chosen: w.chosen,
        awardedPoints: w.grade.awardedPoints,
        maxPoints: w.grade.maxPoints,
        questionSnapshot: w.q.questionBankId ? w.q : null,
      })),
      pendingList: result.pendingList.map((item) => ({
        id: item.q.id,
        answer: item.chosen,
        maxPoints: item.grade.maxPoints,
        questionSnapshot: item.q.questionBankId ? item.q : null,
      })),
    });
  }, [finished, result]);

  if (deck.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Header title={title} onBack={onBack} />
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
    const { total, correct, percent, wrongList, pendingList, earnedPoints, gradedPoints } = result;
    const practiceWrongList = wrongList.filter(({ q: wrongQuestion }) => ['single_choice', 'true_false'].includes(questionType(wrongQuestion)));
    const tone = pendingList.length > 0 && gradedPoints === 0 ? 'amber' : percent >= 80 ? 'green' : percent >= 50 ? 'amber' : 'red';
    const toneText = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-rose-600' }[tone];
    const verdict = pendingList.length > 0 ? 'Előzetes eredmény' : percent >= 80 ? 'Kiváló!' : percent >= 60 ? 'Jó munka!' : percent >= 40 ? 'Még kell gyakorolni' : 'Gyakorolj tovább!';

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Confetti active={pendingList.length === 0 && percent >= 80} />
        <Header title={`${title} eredménye`} subtitle={`${formatPoints(earnedPoints)} / ${formatPoints(gradedPoints)} értékelt pont`} onBack={onBack} />

        <div className="card p-6 mb-6 text-center card-enter">
          <div className={`text-7xl font-bold ${toneText}`}>{gradedPoints > 0 ? `${percent}%` : '—'}</div>
          <p className="mt-2 text-lg font-medium">{verdict}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            {correct} teljesen helyes • {wrongList.length} hibás vagy részben helyes
            {pendingList.length > 0 ? ` • ${pendingList.length} kézi javításra vár` : ''}
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            ⏱ {fmtTime(elapsed)} • {total > 0 ? fmtTime(Math.round(elapsed / total)) : '00:00'} / kérdés
            {timeLimit && elapsed >= timeLimit ? ' • Az idő lejárt' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <Button
            label={practiceWrongList.length ? `Hibázottak gyakorlása (${practiceWrongList.length})` : 'Nincs kártyásan gyakorolható hiba'}
            variant={practiceWrongList.length ? 'primary' : 'secondary'}
            icon={<Icon name="refresh" size={16} />}
            disabled={practiceWrongList.length === 0}
            onClick={() => onPracticeWrong && onPracticeWrong(practiceWrongList.map((w) => w.q.id))}
          />
          <Button
            label={`Új ${title.toLowerCase()}`}
            variant="secondary"
            icon={<Icon name="target" size={16} />}
            onClick={() => onRestart && onRestart()}
          />
          <Button label="Vissza a kezdőlapra" variant="ghost" onClick={onBack} />
        </div>

        {wrongList.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Hibajegyzék</h2>
            <div className="flex flex-col gap-3 mb-8">
              {wrongList.map(({ q: dq, chosen, grade }, i) => (
                <div key={dq.id} className="card p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-bold text-rose-500 mt-0.5">#{i + 1}</span>
                    <p className="text-sm font-medium flex-1">{dq.question}</p>
                  </div>
                  <QuestionReview question={dq} answer={chosen} grade={grade} />
                </div>
              ))}
            </div>
          </>
        )}

        {pendingList.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-3">Kézi javításra vár</h2>
            <div className="flex flex-col gap-3">
              {pendingList.map(({ q: dq, chosen, grade }, i) => (
                <div key={dq.id} className="card p-4 border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-bold text-amber-500 mt-0.5">#{i + 1}</span>
                    <p className="text-sm font-medium flex-1">{dq.question}</p>
                  </div>
                  <QuestionReview question={dq} answer={chosen} grade={grade} pending />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const currentType = questionType(q);
  const currentAnswer = answers[idx];
  const currentOptions = Array.isArray(q.options) ? q.options : [];
  const isChoiceQuestion = ['single_choice', 'multiple_choice', 'true_false'].includes(currentType);

  // ---- Kérdés képernyő ----
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
      <Header
        title={title}
        subtitle={`${deck.length} kérdés${timeLimit ? ` • ${Math.round(timeLimit / 60)} perc` : ''} • Kiértékelés a végén`}
        onBack={() => {
          if (confirm('Biztosan megszakítod a vizsgát? Az eddigi válaszok elvesznek.')) onBack();
        }}
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="text-sm font-medium tabular-nums whitespace-nowrap">{idx + 1} / {deck.length}</div>
        <div className="flex-1"><ProgressBar current={idx + 1} total={deck.length} /></div>
        <div className={`text-sm font-medium tabular-nums whitespace-nowrap ${timeLimit && timeLimit - elapsed <= 300 ? 'text-rose-600 dark:text-rose-400' : 'text-brand-600 dark:text-brand-400'}`}>
          {timeLimit ? fmtTime(Math.max(0, timeLimit - elapsed)) : fmtTime(elapsed)}
        </div>
      </div>

      <div key={q.id} className="card p-5 sm:p-7 mb-4 card-enter">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge text={q.subject} tone="brand" title={q.subject} />
          <Badge text={q.topic} tone="slate" title={q.topic} />
          {q.defaultPoints != null && <Badge text={`${formatPoints(Number(q.defaultPoints))} pont`} tone="amber" />}
        </div>
        <h2 className="text-lg sm:text-xl font-semibold leading-snug mb-2">{q.question}</h2>
        {currentType === 'multiple_choice' && <p className="text-xs text-slate-400 mb-5">Több helyes válasz is lehet.</p>}
        {currentType !== 'multiple_choice' && <div className="mb-5" />}

        <div className="flex flex-col gap-2.5">
          {isChoiceQuestion && currentOptions.map((opt, i) => {
            const selected = currentType === 'multiple_choice'
              ? (Array.isArray(currentAnswer) && currentAnswer.includes(i))
              : currentType === 'true_false'
                ? (typeof currentAnswer === 'boolean' && currentAnswer === (i === 0))
                : currentAnswer === i;
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
                  {currentType === 'multiple_choice' && selected ? '✓' : letter(i)}
                </span>
                <span className="flex-1 text-sm sm:text-base">{opt}</span>
              </button>
            );
          })}
          {(currentType === 'short_text' || currentType === 'long_text') && (
            <textarea
              rows={currentType === 'long_text' ? 8 : 3}
              value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={currentType === 'long_text' ? 'Írd ide a részletes válaszodat...' : 'Írd ide a válaszodat...'}
              className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm outline-none focus:border-brand-400 transition-colors resize-y"
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button label="Előző" variant="ghost" icon={<Icon name="arrowLeft" size={16} />} onClick={() => go(idx - 1)} disabled={idx === 0} />
        <div className="text-xs text-slate-400 hidden sm:block">{isChoiceQuestion ? '1-8 / A-H a választáshoz' : 'A válasz automatikusan mentődik'}</div>
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
