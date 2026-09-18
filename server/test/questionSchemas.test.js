import test from 'node:test';
import assert from 'node:assert/strict';
import { questionInputSchema } from '../questionSchemas.js';
import { previewQuestionImport } from '../questionImport.js';

const base = {
  questionText: 'Minta kérdés?',
  explanation: '',
  subject: 'Teszt',
  topic: 'Alapok',
  tags: [],
  difficulty: null,
  defaultPoints: 1,
  status: 'active',
};

test('minden támogatott kérdéstípust elfogad', () => {
  const questions = [
    { ...base, type: 'single_choice', options: ['A', 'B'], correctAnswer: 0, gradingConfig: {} },
    { ...base, type: 'multiple_choice', options: ['A', 'B', 'C'], correctAnswer: [0, 2], gradingConfig: { partialCredit: true } },
    { ...base, type: 'true_false', options: null, correctAnswer: true, gradingConfig: {} },
    { ...base, type: 'short_text', options: null, correctAnswer: ['válasz'], gradingConfig: { mode: 'automatic' } },
    { ...base, type: 'long_text', options: null, correctAnswer: null, gradingConfig: { mode: 'manual' } },
  ];
  questions.forEach((question) => assert.equal(questionInputSchema.safeParse(question).success, true));
});

test('hibás választ és érvénytelen indexet elutasít', () => {
  const invalid = { ...base, type: 'single_choice', options: ['A', 'B'], correctAnswer: 4, gradingConfig: {} };
  assert.equal(questionInputSchema.safeParse(invalid).success, false);
});

test('a jelenlegi JSON kérdésformátumot importálja', async () => {
  const file = {
    originalname: 'questions.json',
    buffer: Buffer.from(JSON.stringify([
      { id: 'q1', subject: 'Teszt', topic: 'Alapok', question: 'Melyik?', options: ['A', 'B'], correctIndex: 1 },
    ])),
  };
  const result = await previewQuestionImport(file);
  assert.equal(result.questions.length, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.questions[0].correctAnswer, 1);
});

test('CSV kérdéseket normalizál és hibákat soronként jelez', async () => {
  const file = {
    originalname: 'questions.csv',
    buffer: Buffer.from('Kérdés,Válasz A,Válasz B,Helyes válasz\nMelyik?,Első,Második,B\nHibás?,Csak egy,,A'),
  };
  const result = await previewQuestionImport(file);
  assert.equal(result.questions.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.questions[0].correctAnswer, 1);
});
