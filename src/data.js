// src/data.js
// Adatbetöltés + szűrési segédfüggvények.
// A questions.json a projekt gyökérben van; Vite alatt fetch-sel töltjük.
// (A public/ mappába is tehetnénk, de a gyökérből is kiszolgálja a Vite dev szerver.)

let CACHE = null;

export async function loadQuestions() {
  if (CACHE) return CACHE;
  const res = await fetch('./questions.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Nem sikerült betölteni a questions.json-t (HTTP ${res.status})`);
  const data = await res.json();
  CACHE = data.filter(
    (q) =>
      q &&
      typeof q.question === 'string' &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 &&
      q.correctIndex < q.options.length
  );
  return CACHE;
}

export function listSubjects(questions) {
  return [...new Set(questions.map((q) => q.subject))];
}

export function listTopics(questions, subject = null) {
  const set = new Set();
  for (const q of questions) {
    if (subject && q.subject !== subject) continue;
    set.add(q.topic);
  }
  return [...set];
}

export function filterQuestions(questions, { subject, topic, ids } = {}) {
  return questions.filter((q) => {
    if (subject && q.subject !== subject) return false;
    if (topic && q.topic !== topic) return false;
    if (ids && !ids.includes(q.id)) return false;
    return true;
  });
}

// Általános segédfüggvények
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function letter(i) {
  return String.fromCharCode(65 + i);
}

export function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/** Idő formázás mm:ss. */
export function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ===== SM-2 Spaced Repetition segédfüggvények =====

/**
 * Visszaadja egy kérdés nehézségi szintjét az SM-2 profil alapján.
 * @returns {{level:'easy'|'medium'|'hard'|'new', label:string, color:string}}
 */
export function getDifficulty(sm2, id) {
  const entry = sm2[id];
  if (!entry || entry.reps === 0 && entry.lapses === 0) {
    return { level: 'new', label: 'Új', color: 'slate' };
  }
  if (entry.lapses === 0 && entry.ef >= 2.5) {
    return { level: 'easy', label: 'Könnyű', color: 'green' };
  }
  if (entry.lapses <= 2 && entry.ef >= 2.0) {
    return { level: 'medium', label: 'Közepes', color: 'amber' };
  }
  return { level: 'hard', label: 'Nehéz', color: 'red' };
}

/**
 * SM-2 alapú pakli építés.
 * Prioritás: 1) esedékes (due) kérdések, 2) nehézek előrébb, 3) újak.
 * Ha nincs elég esedékes, kiegészíti a többiből.
 *
 * @param {Array} questions kérdésobjektumok
 * @param {string[]} ids gyakorolandó ID-k
 * @param {Object} sm2 SM-2 state a store-ból
 * @param {boolean} shuffleDeck keverjük-e a végeredményt (alapból true)
 * @returns {Array} rendezett kérdésobjektumok
 */
export function buildSM2Deck(questions, ids, sm2, shuffleDeck = true) {
  const now = Date.now();
  const items = ids
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean)
    .map((q) => {
      const entry = sm2[q.id];
      const isDue = !entry || entry.nextReview <= now;
      const lapses = entry?.lapses || 0;
      const ef = entry?.ef || 2.5;
      // Prioritási pontszám: alacsonyabb = előrébb jön
      // due + sok hiba + alacsony EF = legmagasabb prioritás
      const priority = (isDue ? 0 : 1000) + lapses * 50 + (2.5 - ef) * 100;
      return { q, isDue, lapses, ef, priority };
    });

  // Rendezés: due-k először (prioritás szerint), utána a többi
  items.sort((a, b) => a.priority - b.priority);

  // Due kérdések: keverjük őket (hogy ne mindig ugyanabban a sorrendben)
  // Nem due kérdések: keverjük, de a due-k után
  const due = items.filter((i) => i.isDue);
  const notDue = items.filter((i) => !i.isDue);

  let result;
  if (shuffleDeck) {
    // Due-kon belül: keverjük, de a nehezebbek (több lapses) nagyobb eséllyel előre
    result = weightedShuffle(due).concat(shuffle(notDue));
  } else {
    result = due.concat(notDue);
  }

  return result.map((i) => i.q);
}

/**
 * Súlyozott keverés: a nehezebbek (több hiba, alacsonyabb EF) előrébb kerülnek,
 de nem fix sorrendben — van véletlenszerűség is.
 */
function weightedShuffle(items) {
  const weighted = items.map((i) => ({
    ...i,
    weight: 1 / (1 + i.priority * 0.01), // magasabb priority = alacsonyabb weight = előrébb
  }));
  const result = [];
  const pool = [...weighted];
  while (pool.length > 0) {
    const totalWeight = pool.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * totalWeight;
    let picked = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) { picked = j; break; }
    }
    result.push(pool[picked]);
    pool.splice(picked, 1);
  }
  return result;
}

/**
 * Dátum formázása röviden: "08.27." vagy "08.27. 14:30"
 */
export function fmtDate(ts, withTime = false) {
  const d = new Date(ts);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  if (!withTime) return `${mm}.${dd}.`;
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${mm}.${dd}. ${hh}:${min}`;
}
