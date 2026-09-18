import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useStore } from '../store.jsx';
import { useInstitutions } from '../institutions.jsx';
import { apiRequest } from '../api.js';
import { Badge, Button, EmptyState, Header, Icon } from './ui.jsx';

const TYPE_LABELS = {
  single_choice: 'Egyválaszos',
  multiple_choice: 'Többválaszos',
  true_false: 'Igaz-hamis',
  short_text: 'Rövid szöveg',
  long_text: 'Hosszú szöveg',
};

const EMPTY_QUESTION = {
  externalId: null,
  type: 'single_choice',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  gradingConfig: {},
  explanation: '',
  subject: '',
  topic: '',
  tags: [],
  difficulty: null,
  defaultPoints: 1,
  status: 'active',
};

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

const inputClass = 'w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 transition-colors';

function QuestionEditor({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => initial ? { ...initial, options: initial.options || [] } : { ...EMPTY_QUESTION });
  const isChoice = ['single_choice', 'multiple_choice'].includes(form.type);
  const isText = ['short_text', 'long_text'].includes(form.type);
  const gradingMode = form.gradingConfig?.mode || 'manual';

  const changeType = (type) => {
    if (type === 'single_choice') setForm((value) => ({ ...value, type, options: ['', '', '', ''], correctAnswer: 0, gradingConfig: {} }));
    else if (type === 'multiple_choice') setForm((value) => ({ ...value, type, options: ['', '', '', ''], correctAnswer: [], gradingConfig: { partialCredit: true } }));
    else if (type === 'true_false') setForm((value) => ({ ...value, type, options: null, correctAnswer: true, gradingConfig: {} }));
    else setForm((value) => ({ ...value, type, options: null, correctAnswer: null, gradingConfig: { mode: 'manual' } }));
  };

  const setOption = (index, text) => {
    setForm((value) => ({ ...value, options: value.options.map((option, i) => i === index ? text : option) }));
  };

  const removeOption = (index) => {
    setForm((value) => {
      const options = value.options.filter((_, i) => i !== index);
      let correctAnswer = value.correctAnswer;
      if (value.type === 'single_choice') correctAnswer = Math.min(Number(correctAnswer) || 0, options.length - 1);
      if (value.type === 'multiple_choice') correctAnswer = value.correctAnswer.filter((i) => i !== index).map((i) => i > index ? i - 1 : i);
      return { ...value, options, correctAnswer };
    });
  };

  const toggleMultiple = (index) => {
    setForm((value) => {
      const selected = value.correctAnswer || [];
      return { ...value, correctAnswer: selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index] };
    });
  };

  const submit = (event) => {
    event.preventDefault();
    onSave({
      externalId: form.externalId || null,
      type: form.type,
      questionText: form.questionText,
      options: form.options,
      correctAnswer: isText && gradingMode === 'automatic'
        ? (Array.isArray(form.correctAnswer) ? form.correctAnswer : []).filter(Boolean)
        : form.correctAnswer,
      gradingConfig: form.gradingConfig || {},
      explanation: form.explanation || '',
      subject: form.subject || '',
      topic: form.topic || '',
      tags: Array.isArray(form.tags) ? form.tags : [],
      difficulty: form.difficulty || null,
      defaultPoints: Number(form.defaultPoints),
      status: form.status || 'active',
    });
  };

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Kérdéstípus">
          <select value={form.type} onChange={(e) => changeType(e.target.value)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Pontérték">
          <input type="number" min="0" step="0.25" value={form.defaultPoints} onChange={(e) => setForm({ ...form, defaultPoints: Number(e.target.value) })} className={inputClass} />
        </Field>
      </div>

      <Field label="Kérdés">
        <textarea rows="4" required value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} className={inputClass} />
      </Field>

      {isChoice && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Válaszlehetőségek és helyes válasz</span>
          {form.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type={form.type === 'single_choice' ? 'radio' : 'checkbox'}
                name="correctAnswer"
                checked={form.type === 'single_choice' ? form.correctAnswer === index : (form.correctAnswer || []).includes(index)}
                onChange={() => form.type === 'single_choice' ? setForm({ ...form, correctAnswer: index }) : toggleMultiple(index)}
                className="w-4 h-4 accent-brand-600"
              />
              <input required value={option} onChange={(e) => setOption(index, e.target.value)} className={inputClass} placeholder={`${String.fromCharCode(65 + index)} válasz`} />
              {form.options.length > 2 && (
                <button type="button" onClick={() => removeOption(index)} className="w-9 h-9 shrink-0 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                  <Icon name="x" size={17} />
                </button>
              )}
            </div>
          ))}
          {form.options.length < 8 && <Button type="button" label="Válasz hozzáadása" variant="secondary" onClick={() => setForm({ ...form, options: [...form.options, ''] })} />}
          {form.type === 'multiple_choice' && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.gradingConfig?.partialCredit !== false} onChange={(e) => setForm({ ...form, gradingConfig: { ...form.gradingConfig, partialCredit: e.target.checked } })} className="accent-brand-600" />
              Részpont járjon a részben helyes válaszért
            </label>
          )}
        </div>
      )}

      {form.type === 'true_false' && (
        <Field label="Helyes válasz">
          <select value={String(form.correctAnswer)} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value === 'true' })} className={inputClass}>
            <option value="true">Igaz</option>
            <option value="false">Hamis</option>
          </select>
        </Field>
      )}

      {isText && (
        <>
          <Field label="Javítás módja">
            <select value={gradingMode} onChange={(e) => setForm({ ...form, gradingConfig: { ...form.gradingConfig, mode: e.target.value }, correctAnswer: e.target.value === 'automatic' ? [] : null })} className={inputClass}>
              <option value="manual">Oktatói kézi javítás</option>
              <option value="automatic">Automatikus, elfogadott válaszok alapján</option>
            </select>
          </Field>
          {gradingMode === 'automatic' && (
            <Field label="Elfogadott válaszok" hint="Soronként egy elfogadott válasz.">
              <textarea
                rows="4"
                required
                value={(form.correctAnswer || []).join('\n')}
                onChange={(e) => setForm({ ...form, correctAnswer: e.target.value.split('\n') })}
                className={inputClass}
              />
            </Field>
          )}
        </>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Tantárgy">
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Témakör">
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={inputClass} />
        </Field>
      </div>

      <Field label="Magyarázat">
        <textarea rows="3" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} className={inputClass} />
      </Field>

      <Field label="Címkék" hint="Vesszővel elválasztva.">
        <input value={(form.tags || []).join(', ')} onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} className={inputClass} />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" label="Mégse" variant="ghost" onClick={onCancel} />
        <Button type="submit" label={saving ? 'Mentés...' : 'Mentés'} disabled={saving} />
      </div>
    </form>
  );
}

function ImportPanel({ bankId, apiUrl, token, onImported, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      setPreview(await apiRequest(apiUrl, token, `/api/question-banks/${bankId}/import/preview`, { method: 'POST', body }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(apiUrl, token, `/api/question-banks/${bankId}/import/commit`, {
        method: 'POST',
        body: JSON.stringify({ fileName: preview.fileName, fileType: preview.fileType, questions: preview.questions, totalRows: preview.totalRows, invalidRows: preview.errors.length }),
      });
      onImported(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Kérdések importálása</h2>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" size={18} /></button>
      </div>
      <input type="file" accept=".xlsx,.csv,.json" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} className="text-sm" />
      {!preview && <Button label={loading ? 'Feldolgozás...' : 'Előnézet készítése'} onClick={loadPreview} disabled={!file || loading} />}
      {error && <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-600 dark:text-rose-300">{error}</div>}
      {preview && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3"><div className="text-xl font-bold">{preview.totalRows}</div><div className="text-xs text-slate-500">Összes</div></div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3"><div className="text-xl font-bold text-emerald-600">{preview.questions.length}</div><div className="text-xs text-slate-500">Érvényes</div></div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3"><div className="text-xl font-bold text-amber-600">{preview.duplicateCount || 0}</div><div className="text-xs text-slate-500">Duplikált</div></div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3"><div className="text-xl font-bold text-rose-600">{preview.errors.length}</div><div className="text-xs text-slate-500">Hibás</div></div>
          </div>
          {preview.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-600 dark:text-rose-300">
              {preview.errors.slice(0, 100).map((item, index) => <div key={index}>{item.sheet}, {item.row}. sor: {item.messages.join('; ')}</div>)}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
            {preview.questions.slice(0, 20).map((question, index) => (
              <div key={index} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <Badge text={TYPE_LABELS[question.type]} tone="slate" />
                <p className="text-sm font-medium mt-1">{question.questionText}</p>
              </div>
            ))}
            {preview.questions.length > 20 && <p className="text-xs text-center text-slate-400">További {preview.questions.length - 20} érvényes kérdés</p>}
          </div>
          <Button label={loading ? 'Importálás...' : `${preview.questions.length} érvényes kérdés importálása`} onClick={commit} disabled={loading || preview.questions.length === 0} />
        </>
      )}
    </div>
  );
}

function toStudyQuestion(question, bankId) {
  const base = {
    id: `bank_${bankId}_${question.id}`,
    sourceId: question.id,
    questionBankId: bankId,
    subject: question.subject || 'Saját kérdésbank',
    topic: question.topic || 'Általános',
    question: question.questionText,
    type: question.type,
    options: question.type === 'true_false' ? ['Igaz', 'Hamis'] : question.options,
    correctAnswer: question.correctAnswer,
    gradingConfig: question.gradingConfig || {},
    explanation: question.explanation || '',
    defaultPoints: question.defaultPoints ?? 1,
  };
  if (question.type === 'single_choice') return { ...base, correctAnswer: Number(question.correctAnswer), correctIndex: Number(question.correctAnswer) };
  if (question.type === 'true_false') {
    const correctAnswer = question.correctAnswer === true || question.correctAnswer === 'true';
    return { ...base, correctAnswer, correctIndex: correctAnswer ? 0 : 1 };
  }
  return base;
}

function BankDetail({ bank, onBack, onStart }) {
  const { token, apiUrl } = useAuth();
  const { state } = useStore();
  const [questions, setQuestions] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showClassAccess, setShowClassAccess] = useState(false);
  const [classOptions, setClassOptions] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(apiUrl, token, `/api/question-banks/${bank.id}/questions`);
      setQuestions(data.questions);
      setCanEdit(data.canEdit);
      if (data.canEdit && bank.ownerType === 'institution') {
        const accessData = await apiRequest(apiUrl, token, `/api/question-banks/${bank.id}/class-access`);
        setClassOptions(accessData.classes);
        setSelectedClassIds(accessData.classes.filter((item) => item.permission).map((item) => item.id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bank.id]);

  const saveQuestion = async (question) => {
    setSaving(true);
    setError('');
    try {
      await apiRequest(apiUrl, token, `/api/question-banks/${bank.id}/questions${editor?.id ? `/${editor.id}` : ''}`, {
        method: editor?.id ? 'PUT' : 'POST',
        body: JSON.stringify(question),
      });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (question) => {
    if (!confirm('Biztosan archiválod ezt a kérdést?')) return;
    try {
      await apiRequest(apiUrl, token, `/api/question-banks/${bank.id}/questions/${question.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveClassAccess = async () => {
    if (selectedClassIds.length === 0) {
      setError('Válassz legalább egy osztályt.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiRequest(apiUrl, token, `/api/question-banks/${bank.id}/class-access`, {
        method: 'PUT',
        body: JSON.stringify({ classIds: selectedClassIds, permission: 'use' }),
      });
      setShowClassAccess(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shareWithInstitution = async () => {
    setSaving(true);
    setError('');
    try {
      await apiRequest(apiUrl, token, `/api/question-banks/${bank.id}`, { method: 'PATCH', body: JSON.stringify({ visibility: 'institution' }) });
      setSelectedClassIds([]);
      setShowClassAccess(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const studyQuestions = useMemo(() => questions.filter((question) => question.status === 'active').map((question) => toStudyQuestion(question, bank.id)), [questions, bank.id]);
  const flashcardQuestions = useMemo(() => studyQuestions.filter((question) => ['single_choice', 'true_false'].includes(question.type)), [studyQuestions]);
  const bankWrongQuestions = useMemo(() => flashcardQuestions.filter((question) => state.wrong.includes(question.id)), [flashcardQuestions, state.wrong]);

  if (editor) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full">
      <Header title={editor.id ? 'Kérdés szerkesztése' : 'Új kérdés'} onBack={() => setEditor(null)} />
      {error && <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-600">{error}</div>}
      <QuestionEditor initial={editor.id ? editor : null} onSave={saveQuestion} onCancel={() => setEditor(null)} saving={saving} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full pb-28">
      <Header title={bank.name} subtitle={`${questions.length} kérdés`} onBack={onBack} />
      {error && <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-600">{error}</div>}
      <div className="flex flex-wrap gap-2 mb-2">
        {canEdit && <Button label="Új kérdés" icon={<Icon name="book" size={16} />} onClick={() => setEditor({ ...EMPTY_QUESTION })} />}
        {canEdit && <Button label="Importálás" variant="secondary" onClick={() => setShowImport((value) => !value)} />}
        {canEdit && bank.ownerType === 'institution' && <Button label="Osztálymegosztás" variant="secondary" onClick={() => setShowClassAccess((value) => !value)} />}
        <Button label={`Kártyás tanulás (${flashcardQuestions.length})`} variant="secondary" disabled={flashcardQuestions.length === 0} onClick={() => onStart('flashcard', { customQuestions: flashcardQuestions, ids: flashcardQuestions.map((q) => q.id) })} />
        {bankWrongQuestions.length > 0 && <Button label={`Hibázottak (${bankWrongQuestions.length})`} variant="secondary" onClick={() => onStart('flashcard', { customQuestions: flashcardQuestions, ids: bankWrongQuestions.map((q) => q.id), isWrongReview: true })} />}
        <Button label={`Vizsga (${studyQuestions.length})`} variant="secondary" disabled={studyQuestions.length === 0} onClick={() => onStart('exam', { customQuestions: studyQuestions, ids: studyQuestions.map((q) => q.id), count: studyQuestions.length })} />
      </div>
      {questions.length > flashcardQuestions.length ? (
        <p className="text-xs text-slate-400 mb-5">A többválaszos és szöveges kérdések vizsgamódban használhatók; a kártyás tanulás az egyválaszos és igaz-hamis kérdéseket tartalmazza.</p>
      ) : <div className="mb-5" />}
      {showClassAccess && (
        <div className="card p-4 mb-5">
          <h2 className="font-semibold mb-3">Hozzáférő osztályok</h2>
          {classOptions.length === 0 ? <p className="text-sm text-slate-500">Az intézményben még nincs osztály.</p> : (
            <div className="grid sm:grid-cols-2 gap-2 mb-4">
              {classOptions.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-sm">
                  <input type="checkbox" checked={selectedClassIds.includes(item.id)} onChange={(e) => setSelectedClassIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="accent-brand-600" />
                  <span>{item.name}{item.subject ? ` • ${item.subject}` : ''}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button label="Teljes intézmény láthatja" variant="secondary" onClick={shareWithInstitution} disabled={saving} />
            <Button label={saving ? 'Mentés...' : 'Kijelölt osztályok mentése'} onClick={saveClassAccess} disabled={saving || classOptions.length === 0} />
          </div>
        </div>
      )}
      {showImport && <div className="mb-5"><ImportPanel bankId={bank.id} apiUrl={apiUrl} token={token} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} /></div>}
      {loading ? <p className="text-center text-sm text-slate-400 py-12">Betöltés...</p> : questions.length === 0 ? (
        <EmptyState icon={<Icon name="book" />} title="A kérdésbank még üres" hint="Hozz létre kérdést kézzel, vagy importálj XLSX, CSV vagy JSON fájlt." />
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((question) => (
            <div key={question.id} className="card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2"><Badge text={TYPE_LABELS[question.type]} tone="brand" />{question.subject && <Badge text={question.subject} tone="slate" />}</div>
                <p className="font-medium text-sm">{question.questionText}</p>
                <p className="text-xs text-slate-400 mt-1">{question.defaultPoints} pont • v{question.version}</p>
              </div>
              {canEdit && <div className="flex gap-1"><button type="button" onClick={() => setEditor(question)} className="px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800">Szerkesztés</button><button type="button" onClick={() => removeQuestion(question)} className="px-3 py-2 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">Archiválás</button></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuestionBanks({ onBack, onStart }) {
  const { token, apiUrl, isGuest } = useAuth();
  const { institutions, activeInstitution } = useInstitutions();
  const eligibleInstitutions = institutions.filter((institution) => ['owner', 'admin', 'teacher'].includes(institution.role));
  const [banks, setBanks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(!isGuest);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [ownerType, setOwnerType] = useState('personal');
  const [institutionId, setInstitutionId] = useState('');

  const load = async () => {
    if (isGuest) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(apiUrl, token, '/api/question-banks');
      setBanks(data.banks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isGuest]);

  const createBank = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const data = await apiRequest(apiUrl, token, '/api/question-banks', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: '',
          ownerType,
          institutionId: ownerType === 'institution' ? institutionId : null,
          visibility: ownerType === 'institution' ? 'institution' : 'private',
        }),
      });
      setName('');
      setOwnerType('personal');
      setInstitutionId('');
      setCreating(false);
      setSelected(data.bank);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (selected) return <BankDetail bank={selected} onBack={() => { setSelected(null); load(); }} onStart={onStart} />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full pb-28">
      <Header title="Kérdésbankok" subtitle="Saját és megosztott kérdések létrehozása, importálása és használata" onBack={onBack} />
      {isGuest ? (
        <EmptyState icon={<Icon name="book" />} title="Bejelentkezés szükséges" hint="A szerveres kérdésbankok vendég módban nem érhetők el." />
      ) : (
        <>
          <div className="flex justify-end mb-4"><Button label="Új kérdésbank" onClick={() => { setCreating(true); setInstitutionId(activeInstitution?.id || eligibleInstitutions[0]?.id || ''); }} /></div>
          {creating && (
            <form onSubmit={createBank} className="card p-4 mb-4 grid sm:grid-cols-2 gap-3">
              <input autoFocus required maxLength="160" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kérdésbank neve" className={inputClass} />
              <select value={ownerType} onChange={(e) => { setOwnerType(e.target.value); if (e.target.value === 'institution' && !institutionId) setInstitutionId(activeInstitution?.id || eligibleInstitutions[0]?.id || ''); }} className={inputClass}>
                <option value="personal">Személyes tulajdon</option>
                {eligibleInstitutions.length > 0 && <option value="institution">Intézményi tulajdon</option>}
              </select>
              {ownerType === 'institution' && (
                <select required value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} className={`${inputClass} sm:col-span-2`}>
                  <option value="">Válassz intézményt</option>
                  {eligibleInstitutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name} • {institution.role}</option>)}
                </select>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2"><Button type="button" label="Mégse" variant="ghost" onClick={() => setCreating(false)} /><Button type="submit" label="Létrehozás" /></div>
            </form>
          )}
          {error && <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-600">{error}</div>}
          {loading ? <p className="text-center text-sm text-slate-400 py-12">Betöltés...</p> : banks.length === 0 ? (
            <EmptyState icon={<Icon name="book" />} title="Még nincs saját kérdésbankod" hint="Hozd létre az első bankot, majd adj hozzá kérdéseket kézzel vagy importálással." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {banks.map((bank) => (
                <button key={bank.id} type="button" onClick={() => setSelected(bank)} className="card card-hover p-5 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="font-semibold">{bank.name}</h2><p className="text-sm text-slate-500 mt-1">{bank.questionCount} kérdés</p></div>
                    <Badge text={bank.ownerType === 'institution' ? 'Intézményi' : bank.permission === 'admin' ? 'Saját' : 'Megosztott'} tone={bank.ownerType === 'institution' ? 'green' : bank.permission === 'admin' ? 'brand' : 'slate'} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
