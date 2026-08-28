// src/components/CheatSheet.jsx
// Bemagoló / Puskázó mód (Cheat Sheet): nincs tesztelés, nincs gombnyomás.
// Végtelenül görgethető lista: kérdés alatt azonnal a helyes válasz zölddel.
// Csak olvasod és pörgeted. Vizsga előtti éjszakára.
// Sorrend: véletlenszerű / eredeti / fordított. Keresés a kérdésben.

import React, { useMemo, useState } from 'react';
import { shuffle } from '../data.js';
import { Badge, Button, Icon, Header } from './ui.jsx';

const SORT_OPTIONS = [
  { key: 'random',  label: 'Véletlenszerű' },
  { key: 'ordered', label: 'Eredeti sorrend' },
  { key: 'reverse', label: 'Fordított' },
];

export default function CheatSheet({ questions, ids, onBack }) {
  const [sort, setSort] = useState('random');
  const [search, setSearch] = useState('');

  // Szűrés keresésre
  const filtered = useMemo(() => {
    let items = ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.options.some((opt) => opt.toLowerCase().includes(q))
      );
    }
    return items;
  }, [ids, questions, search]);

  // Sorrendezés
  const displayList = useMemo(() => {
    if (sort === 'random') return shuffle(filtered);
    if (sort === 'reverse') return [...filtered].reverse();
    return filtered; // ordered: eredeti sorrend
  }, [filtered, sort]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full pb-24">
      <Header
        title="Bemagoló mód"
        subtitle="Csak olvasd — kérdés és helyes válasz"
        onBack={onBack}
      />

      {/* Sorrendbeállító gombok */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSort(opt.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all btn-press ${
              sort === opt.key
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Keresőmező */}
      <div className="relative mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Keresés a kérdésekben…"
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2.5 text-sm focus:border-brand-500"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Keresés törlése"
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {/* Találatok száma */}
      {search.trim() && (
        <div className={`text-sm mb-3 px-1 ${displayList.length > 0 ? 'text-slate-500 dark:text-slate-400' : 'text-rose-500'}`}>
          {displayList.length > 0
            ? `${displayList.length} találat a "${search.trim()}" kifejezésre`
            : `Nincs találat a "${search.trim()}" kifejezésre`}
        </div>
      )}

      {/* Info sáv */}
      <div className="flex items-center justify-between mb-4 text-sm text-slate-500 dark:text-slate-400">
        <span>{displayList.length} kérdés</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500" /> = helyes válasz
        </span>
      </div>

      {/* Lista */}
      {displayList.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Icon name="book" size={32} className="mx-auto mb-2" />
          <p className="text-sm">Nincs megjeleníthető kérdés.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayList.map((q, i) => (
            <div
              key={q.id}
              className="card p-4"
            >
              {/* Sorszám + badge-ek */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                <Badge text={q.subject} tone="brand" title={q.subject} />
                <Badge text={q.topic} tone="slate" title={q.topic} />
              </div>

              {/* Kérdés */}
              <p className="text-sm sm:text-base font-medium mb-3">{q.question}</p>

              {/* Helyes válasz kiemelve (betűjel nélkül) */}
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2.5">
                <span className="text-sm sm:text-base text-emerald-800 dark:text-emerald-200 font-medium">
                  {q.options[q.correctIndex]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista vége */}
      {displayList.length > 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          <Icon name="check" size={24} className="mx-auto mb-2" />
          {displayList.length} kérdés — vége a listának
        </div>
      )}
    </div>
  );
}
