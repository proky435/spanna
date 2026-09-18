import { createHash } from 'node:crypto';
import readXlsxFile from 'read-excel-file/node';
import { parse as parseCsv } from 'csv-parse/sync';
import { questionInputSchema } from './questionSchemas.js';

const MAX_ROWS = 5000;

function key(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function first(source, aliases) {
  for (const alias of aliases) {
    const found = Object.entries(source).find(([name]) => key(name) === alias);
    if (found && found[1] !== null && found[1] !== '') return found[1];
  }
  return undefined;
}

function parseType(raw, options, hasChoiceColumns) {
  const value = key(raw);
  if (['multiple choice', 'tobbvalaszos', 'tobb valaszos'].includes(value)) return 'multiple_choice';
  if (['true false', 'igaz hamis'].includes(value)) return 'true_false';
  if (['short text', 'rovid szoveg', 'rovid szoveges'].includes(value)) return 'short_text';
  if (['long text', 'hosszu szoveg', 'essze', 'szoveges'].includes(value)) return 'long_text';
  return options.length >= 2 || hasChoiceColumns ? 'single_choice' : 'short_text';
}

function parseOptions(source) {
  const direct = first(source, ['options', 'valaszlehetosegek']);
  if (Array.isArray(direct)) return direct.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof direct === 'string') {
    try {
      const parsed = JSON.parse(direct);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch {}
    return direct.split('|').map((item) => item.trim()).filter(Boolean);
  }

  return Object.entries(source)
    .filter(([name, value]) => {
      const normalized = key(name);
      return value !== null && value !== '' && (
        /^[a-h]$/.test(normalized) ||
        /^valasz [a-h]$/.test(normalized) ||
        (normalized.startsWith('valasz ') && !normalized.includes('helyes'))
      );
    })
    .sort(([a], [b]) => key(a).localeCompare(key(b), 'hu'))
    .map(([, value]) => String(value).trim())
    .filter(Boolean);
}

function parseChoiceIndex(value, options, zeroBased = false) {
  if (typeof value === 'number' && Number.isInteger(value)) return zeroBased ? value : value - 1;
  const text = String(value ?? '').trim();
  if (/^[A-Ha-h]$/.test(text)) return text.toUpperCase().charCodeAt(0) - 65;
  if (/^\d+$/.test(text)) return zeroBased ? Number(text) : Number(text) - 1;
  const byText = options.findIndex((option) => option === text);
  return byText >= 0 ? byText : null;
}

function parseCorrectAnswer(source, type, options) {
  const explicitIndex = first(source, ['correctindex']);
  const namedAnswer = first(source, ['correctanswer', 'correct answer', 'helyes valasz', 'helyes valaszok', 'megoldas']);
  const raw = explicitIndex ?? namedAnswer ?? (first(source, ['kerdesek']) !== undefined ? source.__lastValue : undefined);

  if (type === 'single_choice') return parseChoiceIndex(raw, options, explicitIndex !== undefined);
  if (type === 'multiple_choice') {
    const values = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,;|]/);
    return values.map((value) => parseChoiceIndex(value, options, explicitIndex !== undefined)).filter((value) => value !== null);
  }
  if (type === 'true_false') {
    const normalized = key(raw);
    if (['true', 'igaz', '1'].includes(normalized)) return true;
    if (['false', 'hamis', '0'].includes(normalized)) return false;
    return null;
  }
  if (Array.isArray(raw)) return raw.map(String).map((item) => item.trim()).filter(Boolean);
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw).split('|').map((item) => item.trim()).filter(Boolean);
}

function normalizeQuestion(source, inherited = {}) {
  const questionText = first(source, ['questiontext', 'question text', 'question', 'kerdes', 'kerdesek']);
  const options = parseOptions(source);
  const hasChoiceColumns = Object.keys(source).some((name) => /^[a-h]$/.test(key(name)) || key(name).startsWith('valasz '));
  const type = parseType(first(source, ['type', 'tipus', 'kerdes tipus']), options, hasChoiceColumns);
  const gradingMode = key(first(source, ['gradingmode', 'grading mode', 'javitas modja']));
  const subjectValue = first(source, ['subject', 'tantargy', 'vizsgatargy']);
  const topicValue = first(source, ['topic', 'temakor']);
  const subject = subjectValue === undefined ? inherited.subject || '' : String(subjectValue).trim();
  const topic = topicValue === undefined ? inherited.topic || '' : String(topicValue).trim();
  const tagsRaw = first(source, ['tags', 'cimkek']);
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map(String)
    : String(tagsRaw ?? '').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  const points = Number(first(source, ['defaultpoints', 'default points', 'points', 'pont', 'pontszam']) ?? 1);
  const automatic = gradingMode === 'automatic' || gradingMode === 'automatikus';

  return {
    value: {
      externalId: String(first(source, ['externalid', 'external id', 'id', 'sorsz', 'sorszam']) ?? '').trim() || null,
      type,
      questionText: String(questionText ?? '').trim(),
      options: ['single_choice', 'multiple_choice'].includes(type) ? options : null,
      correctAnswer: parseCorrectAnswer(source, type, options),
      gradingConfig: ['short_text', 'long_text'].includes(type) ? { mode: automatic ? 'automatic' : 'manual' } : {},
      explanation: String(first(source, ['explanation', 'magyarazat']) ?? '').trim(),
      subject,
      topic,
      tags,
      difficulty: ({ easy: 'easy', medium: 'medium', hard: 'hard', konnyu: 'easy', kozepes: 'medium', nehez: 'hard' })[key(first(source, ['difficulty', 'nehezseg']))] || null,
      defaultPoints: Number.isFinite(points) ? points : 1,
      status: 'active',
    },
    inherited: { subject, topic },
  };
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const seen = new Map();
  const headers = rows[0].map((value, index) => {
    const base = String(value ?? `column_${index + 1}`);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}__${count}`;
  });
  return rows.slice(1).map((row) => ({
    ...Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])),
    __lastValue: row[row.length - 1] ?? null,
  }));
}

async function parseFile(file) {
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  if (extension === 'json') {
    const parsed = JSON.parse(file.buffer.toString('utf8'));
    const rows = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(rows)) throw new Error('A JSON gyökérelemének tömbnek vagy questions tömböt tartalmazó objektumnak kell lennie.');
    return [{ sheet: 'JSON', rows }];
  }
  if (extension === 'csv') {
    const rows = parseCsv(file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true });
    return [{ sheet: 'CSV', rows }];
  }
  if (extension === 'xlsx') {
    const sheets = await readXlsxFile(file.buffer);
    const practiceSheets = sheets.filter(({ sheet }) => /_gyakorl[oó]$/i.test(sheet.trim()));
    const selectedSheets = practiceSheets.length > 0 ? practiceSheets : sheets;
    return selectedSheets.map(({ sheet, data }) => ({ sheet, rows: rowsToObjects(data) }));
  }
  throw new Error('Csak .xlsx, .csv és .json fájl tölthető fel.');
}

export async function previewQuestionImport(file) {
  const sheets = await parseFile(file);
  const questions = [];
  const errors = [];
  let processed = 0;

  for (const sheet of sheets) {
    let inherited = {};
    for (let index = 0; index < sheet.rows.length; index++) {
      const normalized = normalizeQuestion(sheet.rows[index], inherited);
      inherited = normalized.inherited;
      if (!normalized.value.questionText) continue;
      if (processed >= MAX_ROWS) throw new Error(`Legfeljebb ${MAX_ROWS} kérdés importálható egyszerre.`);
      processed++;
      const parsed = questionInputSchema.safeParse(normalized.value);
      if (parsed.success) {
        const generatedId = `auto_${createHash('sha256').update(JSON.stringify([parsed.data.type, parsed.data.questionText, parsed.data.options])).digest('hex').slice(0, 24)}`;
        const externalId = parsed.data.externalId
          ? (sheets.length > 1 ? `${key(sheet.sheet).replace(/ /g, '_')}_${parsed.data.externalId}`.slice(0, 160) : parsed.data.externalId)
          : generatedId;
        questions.push({ ...parsed.data, externalId, source: { sheet: sheet.sheet, row: index + 2 } });
      } else {
        errors.push({
          sheet: sheet.sheet,
          row: index + 2,
          messages: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        });
      }
    }
  }

  return { questions, errors, totalRows: questions.length + errors.length };
}
