import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeQuestion, isAnswered } from '../../src/grading.js';

test('a régi correctIndex formátum változatlanul működik', () => {
  const question = { options: ['A', 'B'], correctIndex: 1 };
  assert.equal(gradeQuestion(question, 1).isCorrect, true);
  assert.equal(gradeQuestion(question, 0).awardedPoints, 0);
});

test('a többválaszos kérdés teljes és részpontot ad', () => {
  const question = {
    type: 'multiple_choice',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: [0, 2],
    gradingConfig: { partialCredit: true },
    defaultPoints: 4,
  };
  assert.deepEqual(gradeQuestion(question, [0, 2]), { status: 'graded', isCorrect: true, awardedPoints: 4, maxPoints: 4, fraction: 1 });
  assert.equal(gradeQuestion(question, [0]).awardedPoints, 2);
  assert.equal(gradeQuestion(question, [0, 1]).awardedPoints, 0);
});

test('az igaz-hamis kérdés logikai választ értékel', () => {
  const question = { type: 'true_false', correctAnswer: false, defaultPoints: 2 };
  assert.equal(gradeQuestion(question, false).awardedPoints, 2);
  assert.equal(gradeQuestion(question, true).awardedPoints, 0);
});

test('az automatikus szövegjavítás alapból nem érzékeny kis- és nagybetűre', () => {
  const question = {
    type: 'short_text',
    correctAnswer: ['Budapest'],
    gradingConfig: { mode: 'automatic' },
    defaultPoints: 1,
  };
  assert.equal(gradeQuestion(question, '  BUDAPEST ').isCorrect, true);
});

test('a megválaszolt kézi szöveges kérdés javításra vár', () => {
  const question = { type: 'long_text', correctAnswer: null, gradingConfig: { mode: 'manual' }, defaultPoints: 5 };
  assert.equal(gradeQuestion(question, 'Kifejtett válasz').status, 'pending');
  assert.equal(isAnswered(question, '   '), false);
  assert.equal(gradeQuestion(question, '').status, 'graded');
});
