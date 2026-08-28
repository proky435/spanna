// src/components/Stats.jsx
// Statisztika dashboard — újratervezve:
// 1) Kompakt összesítő felül (3 kártya)
// 2) Idővonal: vizsgák/gyakorlások listája dátum szerint,
//    lecsukható bejegyzésekkel — kinyitva mutatja mit rontott + helyes válasz
// 3) Témakör bontás: alapból lecsukva, kinyitható

import React, { useState, useMemo } from 'react';
import { useStore } from '../store.jsx';
import { listSubjects, listTopics, pct, fmtDate, fmtTime, letter, getDifficulty } from '../data.js';
import { Header, Icon, EmptyState, Badge } from './ui.jsx';

export default function Stats({ questions, onBack }) {
  const { state, stats } = useStore();
  const [expandedExam, setExpandedExam] = useState(null); // kinyitott vizsga ID
  const [expandedSubject, setExpandedSubject] = useState(null); // kinyitott tantárgy

  // Témakörönkénti statisztika (mint előbb, de most lecsukható)
  const topicStats = useMemo(() => {
    const subjects = listSubjects(questions);
    const result = [];
    for (const subject of subjects) {
      const topics = listTopics(questions, subject);
      for (const topic of topics) {
        const topicQs = questions.filter((q) => q.subject === subject && q.topic === topic);
        let seen = 0, correct = 0, wrong = 0;
        for (const q of topicQs) {
          const p = state.progress[q.id];
          if (p?.seen) {
            seen++;
            if (p.lastCorrect) correct++;
            else wrong++;
          }
        }
        result.push({
          subject,
          topic,
          total: topicQs.length,
          seen,
          correct,
          wrong,
          accuracy: seen ? pct(correct, seen) : null,
        });
      }
    }
    return result;
  }, [questions, state.progress]);

  const overall = useMemo(() => {
    let totalSeen = 0, totalCorrect = 0;
    for (const t of topicStats) {
      totalSeen += t.seen;
      totalCorrect += t.correct;
    }
    return {
      seen: totalSeen,
      correct: totalCorrect,
      accuracy: totalSeen ? pct(totalCorrect, totalSeen) : 0,
    };
  }, [topicStats]);

  // Tantárgyankénti csoportosítás
  const bySubject = useMemo(() => {
    const map = {};
    for (const t of topicStats) {
      if (!map[t.subject]) map[t.subject] = [];
      map[t.subject].push(t);
    }
    return map;
  }, [topicStats]);

  // Vizsgatörténet (examHistory) — már dátum szerint csökkenő (a store-ba új elemből rakjuk be)
  const examHistory = state.examHistory || [];

  // Nehéz kérdések száma (SM-2 alapján)
  const hardCount = useMemo(() => {
    return Object.entries(state.sm2 || {}).filter(([, v]) => v.lapses >= 3).length;
  }, [state.sm2]);

  function accuracyText(a) {
    if (a === null) return 'text-slate-400';
    if (a >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (a >= 60) return 'text-amber-600 dark:text-amber-400';
    if (a >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-rose-600 dark:text-rose-400';
  }
  function accuracyBar(a) {
    if (a === null) return 'bg-slate-300 dark:bg-slate-700';
    if (a >= 80) return 'bg-emerald-500';
    if (a >= 60) return 'bg-amber-500';
    if (a >= 40) return 'bg-orange-500';
    return 'bg-rose-500';
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full pb-24">
      <Header title="Statisztika" subtitle="Haladás, eredmények és idővonal" onBack={onBack} />

      {/* 1) Kompakt összesítő */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">{stats.seen}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Megválaszolt</div>
        </div>
        <div className="card p-4 text-center">
          <div className={`text-2xl font-bold ${accuracyText(overall.accuracy)}`}>{overall.accuracy}%</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Helyesség</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-rose-500">{hardCount}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Nehéz kérdés</div>
        </div>
      </div>

      {/* 2) Idővonal — vizsgatörténet */}
      {examHistory.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Idővonal
          </h2>
          <div className="flex flex-col gap-2">
            {examHistory.map((exam) => {
              const isExpanded = expandedExam === exam.id;
              const tone = exam.percent >= 80 ? 'green' : exam.percent >= 50 ? 'amber' : 'red';
              const toneText = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-rose-600' }[tone];
              const toneBg = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500' }[tone];

              return (
                <div key={exam.id} className="card overflow-hidden">
                  {/* Fejléc (lecsukva) */}
                  <button
                    onClick={() => setExpandedExam(isExpanded ? null : exam.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Színkódolt csík */}
                    <div className={`w-1.5 h-10 rounded-full ${toneBg}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{fmtDate(exam.date, true)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {exam.correct}/{exam.total} helyes • {exam.wrongList.length} hiba
                      </div>
                    </div>
                    <div className={`text-lg font-bold tabular-nums ${toneText}`}>{exam.percent}%</div>
                    <Icon name={isExpanded ? 'arrowLeft' : 'arrowRight'} size={18} className="text-slate-400 rotate-90" />
                  </button>

                  {/* Kinyitva: hibajegyzék */}
                  {isExpanded && exam.wrongList.length > 0 && (
                    <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-800 pt-2">
                      <div className="flex flex-col gap-2">
                        {exam.wrongList.map((w, i) => {
                          const q = questions.find((x) => x.id === w.id);
                          if (!q) return null;
                          const diff = getDifficulty(state.sm2, q.id);
                          return (
                            <div key={i} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
                              <div className="flex items-start gap-2 mb-1.5">
                                <span className="text-xs font-bold text-rose-500 mt-0.5">#{i + 1}</span>
                                <p className="text-xs font-medium flex-1">{q.question}</p>
                                {diff && diff.level !== 'new' && (
                                  <Badge text={diff.label} tone={diff.color} />
                                )}
                              </div>
                              <div className="flex flex-col gap-1 text-xs pl-5">
                                {q.options.map((opt, oi) => {
                                  let cls = 'text-slate-500 dark:text-slate-400';
                                  let mark = '';
                                  if (oi === q.correctIndex) { cls = 'text-emerald-600 dark:text-emerald-400 font-medium'; mark = '✓ '; }
                                  else if (oi === w.chosen) { cls = 'text-rose-600 dark:text-rose-400 font-medium line-through'; mark = '✗ '; }
                                  return (
                                    <div key={oi} className={`flex items-center gap-1.5 ${cls}`}>
                                      <span className="w-4 text-center font-semibold">{letter(oi)}</span>
                                      <span>{mark}{opt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isExpanded && exam.wrongList.length === 0 && (
                    <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-800 pt-2">
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Icon name="check" size={16} /> Nincs hibázott kérdés — tökéletes!
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3) Témakör bontás — lecsukható */}
      {overall.seen === 0 && examHistory.length === 0 ? (
        <EmptyState
          icon={<Icon name="target" />}
          title="Még nincs adat"
          hint="Gyakorolj egyet, és itt látod majd a statisztikát!"
        />
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Témakörök
          </h2>
          <div className="flex flex-col gap-2">
            {Object.entries(bySubject).map(([subject, topics]) => {
              const isExpanded = expandedSubject === subject;
              // Tantárgy szintű aggregált stat
              const sSeen = topics.reduce((s, t) => s + t.seen, 0);
              const sCorrect = topics.reduce((s, t) => s + t.correct, 0);
              const sAccuracy = sSeen ? pct(sCorrect, sSeen) : null;

              return (
                <div key={subject} className="card overflow-hidden">
                  <button
                    onClick={() => setExpandedSubject(isExpanded ? null : subject)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{subject}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{sSeen} kérdés megválaszolva</div>
                    </div>
                    {sAccuracy !== null && (
                      <div className={`text-sm font-bold tabular-nums ${accuracyText(sAccuracy)}`}>{sAccuracy}%</div>
                    )}
                    <Icon name={isExpanded ? 'arrowLeft' : 'arrowRight'} size={18} className="text-slate-400 rotate-90" />
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-800 pt-2">
                      <div className="flex flex-col gap-2">
                        {topics.map((t) => (
                          <div key={t.topic} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium truncate flex-1 mr-2">{t.topic}</span>
                              <span className={`text-xs font-bold tabular-nums ${accuracyText(t.accuracy)}`}>
                                {t.accuracy === null ? '—' : `${t.accuracy}%`}
                              </span>
                            </div>
                            {/* Haladási sáv */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct(t.seen, t.total)}%` }} />
                              </div>
                              <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">{t.seen}/{t.total}</span>
                            </div>
                            {/* Helyességi sáv */}
                            {t.accuracy !== null && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div className={`h-full rounded-full ${accuracyBar(t.accuracy)}`} style={{ width: `${t.accuracy}%` }} />
                                </div>
                                <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                                  {t.correct}✓ {t.wrong}✗
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
