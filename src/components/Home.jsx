// src/components/Home.jsx
// Kezdőképernyő — modernizált UI, minden funkcionalitás megmarad.
// Szűrőpanel MINDIG látható (nem kinyithatóba rejtve).
// Szűrés (vizsgatárgy + témakör), shuffle kapcsoló, keresés,
// módválasztás (Flashcard / Vizsga / Hibázottak / Könyvjelzők),
// vizsga kérdésszám-beállító, játékmódok, statisztikák, veszélyzóna.

import React, { useState } from 'react';
import { listSubjects, listTopics, filterQuestions } from '../data.js';
import { useStore } from '../store.jsx';
import { Badge, Button, IconButton, Icon, Header, useToast } from './ui.jsx';

const STAT_TONES = {
  brand: 'text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30',
  green: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30',
  amber: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30',
  rose:  'text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30',
};

function StatCard({ label, value, icon, tone }) {
  return (
    <div className="card card-hover p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${STAT_TONES[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight">{value}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</div>
      </div>
    </div>
  );
}

const MODE_TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  red:   'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
};

function ModeCard({ icon, title, desc, tone, onClick, disabled, children }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`card relative p-5 flex flex-col ${
        disabled ? '' : 'card-hover cursor-pointer hover:border-brand-300 dark:hover:border-brand-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${MODE_TONES[tone]}`}>{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
      {disabled && (
        <div className="absolute inset-0 rounded-2xl bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-[1px] flex items-center justify-center">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800">
            Nem elérhető
          </span>
        </div>
      )}
    </div>
  );
}

export default function Home({ questions, selection, setSelection, onStart, ordered, setOrdered, searchQuery, setSearchQuery }) {
  const { state, stats, toggleTheme, resetAll } = useStore();
  const toast = useToast();

  const subjects = listSubjects(questions);
  const topics = listTopics(questions, selection.subject);
  let filtered = filterQuestions(questions, {
    subject: selection.subject || undefined,
    topic: selection.topic || undefined,
  });

  // Hook-ok: a useState hívásoknak a többi változó előtt kell lenniük,
  // hogy a finalFiltered már hivatkozhat onlyUnseen-re.
  const [examCount, setExamCount] = useState(Math.min(20, filtered.length));
  const [onlyUnseen, setOnlyUnseen] = useState(false);

  // Szabad szöveges keresés a kérdésben (és opciókban)
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.options.some((opt) => opt.toLowerCase().includes(q))
    );
  }

  // "Csak még nem látottak" szűrése: olyan kérdés, ami nincs a progress-ben
  // vagy seen=false. (state.progress[id]?.seen)
  const finalFiltered = onlyUnseen
    ? filtered.filter((q) => !state.progress[q.id]?.seen)
    : filtered;

  const wrongIds = state.wrong.filter((id) => questions.find((q) => q.id === id));
  const bmIds = state.bookmarks.filter((id) => questions.find((q) => q.id === id));

  const examCounts = [...new Set([20, 50, 100, finalFiltered.length])].filter((n) => n <= finalFiltered.length && n > 0);
  const safeExamCounts = examCounts.length ? examCounts : [finalFiltered.length];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full pb-28">
      <Header
        title="Spanna"
        subtitle="Vizsgatanuló — gyakorolj okosabban"
        right={
          <IconButton
            icon={<Icon name={state.theme === 'dark' ? 'sun' : 'moon'} />}
            title={state.theme === 'dark' ? 'Világos mód' : 'Sötét mód'}
            onClick={toggleTheme}
          />
        }
      />

      {/* Keresőmező */}
      <div className="relative mb-4">
        <input
          type="search"
          value={searchQuery || ''}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Keresés a kérdésekben…"
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 btn-press"
            aria-label="Keresés törlése"
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {/* Találatok száma (csak ha van keresés) */}
      {searchQuery && searchQuery.trim() && (
        <div className={`text-sm mb-4 px-1 ${finalFiltered.length > 0 ? 'text-slate-500 dark:text-slate-400' : 'text-rose-500'}`}>
          {finalFiltered.length > 0
            ? `${finalFiltered.length} találat a "${searchQuery.trim()}" kifejezésre`
            : `Nincs találat a "${searchQuery.trim()}" kifejezésre`}
        </div>
      )}

      {/* Statisztikák */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Összes kérdés" value={questions.length} icon={<Icon name="book" />} tone="brand" />
        <StatCard label="Megválaszolt" value={stats.seen} icon={<Icon name="check" />} tone="green" />
        <StatCard label="Könyvjelző" value={stats.bookmarks} icon={<Icon name="star" />} tone="amber" />
        <StatCard label="Hibázott" value={stats.wrong} icon={<Icon name="refresh" />} tone="rose" />
      </div>

      {/* Szűrőpanel — MINDIG látható */}
      <section className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Szűrés</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Vizsgatárgy</span>
            <select
              value={selection.subject || ''}
              onChange={(e) => { setSelection({ subject: e.target.value || null, topic: null }); }}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            >
              <option value="">— Összes vizsgatárgy —</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Témakör</span>
            <select
              value={selection.topic || ''}
              onChange={(e) => setSelection({ ...selection, topic: e.target.value || null })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            >
              <option value="">— Összes témakör —</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOrdered((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all btn-press ${
                ordered
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 ring-1 ring-brand-300 dark:ring-brand-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
              title={ordered ? 'Jelenleg sorrendben — kattints a véletlenszerű sorrendhez' : 'Jelenleg véletlenszerű — kattints a sorrendbe'}
            >
              <Icon name={ordered ? 'shuffle' : 'list'} size={16} />
              {ordered ? 'Véletlenszerű' : 'Sorrendbe'}
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnseen((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all btn-press ${
                onlyUnseen
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 ring-1 ring-brand-300 dark:ring-brand-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
              title="Csak olyan kérdések, amiket még sosem válaszoltál meg"
            >
              <Icon name="target" size={16} />
              Csak még nem látottak
            </button>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {finalFiltered.length} kérdés kiválasztva
            {onlyUnseen && finalFiltered.length === 0 && ' — már mindet láttad! 🎉'}
          </div>
        </div>
      </section>

      {/* Módkártyák */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Tanulási mód</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <ModeCard
          icon={<Icon name="book" size={22} />}
          title="Kártyás tanulás"
          desc="Azonnali visszajelzés, könyvjelzőzés, billentyűzet-vezérlés."
          tone="brand"
          disabled={finalFiltered.length === 0}
          onClick={() => onStart('flashcard', { ids: finalFiltered.map((q) => q.id) })}
        />

        <ModeCard
          icon={<Icon name="target" size={22} />}
          title="Vizsga / Teszt mód"
          desc="Végén összesítő százalékkal és hibajegyzékkel."
          tone="green"
          disabled={finalFiltered.length === 0}
        >
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {safeExamCounts.map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => { e.stopPropagation(); setExamCount(n); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all btn-press ${
                  examCount === n
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {n === finalFiltered.length ? 'Összes' : n}
              </button>
            ))}
            <Button
              label="Indítás"
              variant="success"
              className="ml-auto"
              disabled={finalFiltered.length === 0}
              onClick={(e) => { e.stopPropagation(); onStart('exam', { ids: finalFiltered.map((q) => q.id), count: examCount }); }}
            />
          </div>
        </ModeCard>

        <ModeCard
          icon={<Icon name="refresh" size={22} />}
          title="Hibázott kérdések"
          desc={wrongIds.length ? `${wrongIds.length} kérdés újragyakorlása azonnali visszajelzéssel.` : 'Még nincs hibázott kérdés — gyakorolj egyet!'}
          tone="red"
          disabled={wrongIds.length === 0}
          onClick={() => onStart('flashcard', { ids: wrongIds, isWrongReview: true })}
        />

        <ModeCard
          icon={<Icon name="star" size={22} />}
          title="Könyvjelzőzött kérdések"
          desc={bmIds.length ? `${bmIds.length} nehéz / megjelölt kérdés átismétlése.` : 'Nincs könyvjelzőzött kérdés — kártyás módban jelölj meg egyet.'}
          tone="amber"
          disabled={bmIds.length === 0}
          onClick={() => onStart('flashcard', { ids: bmIds, isBookmarkReview: true })}
        />
      </div>

      {/* Játékmódok */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 mt-6">Játékmódok</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <ModeCard
          icon={<span className="text-xl">❤️</span>}
          title="Túlélő mód"
          desc="3 élet, egy hiba = egy élet mínusz. Cél: a leghosszabb helyes sorozat!"
          tone="red"
          disabled={finalFiltered.length === 0}
          onClick={() => onStart('survival', { ids: finalFiltered.map((q) => q.id) })}
        />

        <ModeCard
          icon={<span className="text-xl">⏱️</span>}
          title="Időfutam"
          desc="60 másodperced van. Hány kérdést tudsz megválaszolni? Gyors reflexek!"
          tone="brand"
          disabled={finalFiltered.length === 0}
          onClick={() => onStart('timeattack', { ids: finalFiltered.map((q) => q.id) })}
        />

        <ModeCard
          icon={<span className="text-xl">📖</span>}
          title="Bemagoló mód"
          desc="Vizsga előtti éjszakára. Csak olvasod: kérdés + helyes válasz zölddel."
          tone="green"
          disabled={finalFiltered.length === 0}
          onClick={() => onStart('cheatsheet', { ids: finalFiltered.map((q) => q.id) })}
        />

        <ModeCard
          icon={<span className="text-xl">🔄</span>}
          title="Fordított kvíz"
          desc="A válasz adott — melyik kérdésre? 3 élet, agytorna más szemszögből."
          tone="brand"
          disabled={finalFiltered.length < 4}
          onClick={() => onStart('reversequiz', { ids: finalFiltered.map((q) => q.id) })}
        />
      </div>

      {/* Veszélyzóna */}
      {(stats.seen || stats.wrong || stats.bookmarks) && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 px-4 py-3">
          <div className="text-sm">
            <p className="font-medium text-rose-700 dark:text-rose-300">Összes haladás törlése</p>
            <p className="text-rose-600/80 dark:text-rose-400/80">Visszavonhatatlan: haladás, hibák, könyvjelzők elvesznek.</p>
          </div>
          <Button
            label="Törlés"
            variant="danger"
            onClick={() => {
              if (confirm('Biztosan törlöd az összes haladást, hibát és könyvjelzőt?')) {
                resetAll();
                toast('Haladás törölve.', 'danger');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
