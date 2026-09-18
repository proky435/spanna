export function questionType(question) {
  return question.type || 'single_choice';
}

export function isAnswered(question, answer) {
  const type = questionType(question);
  if (type === 'multiple_choice') return Array.isArray(answer) && answer.length > 0;
  if (type === 'short_text' || type === 'long_text') return typeof answer === 'string' && answer.trim().length > 0;
  if (type === 'true_false') return typeof answer === 'boolean';
  return Number.isInteger(answer);
}

function normalizeText(value, config) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return config?.caseSensitive ? text : text.toLocaleLowerCase('hu');
}

export function gradeQuestion(question, answer) {
  const type = questionType(question);
  const maxPoints = Number(question.defaultPoints ?? 1);
  if (!isAnswered(question, answer)) {
    return { status: 'graded', isCorrect: false, awardedPoints: 0, maxPoints, fraction: 0 };
  }

  if (type === 'short_text' || type === 'long_text') {
    const mode = question.gradingConfig?.mode || 'manual';
    if (mode === 'manual') {
      return { status: 'pending', isCorrect: null, awardedPoints: null, maxPoints, fraction: null };
    }
    const accepted = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    const response = normalizeText(answer, question.gradingConfig);
    const isCorrect = accepted.some((value) => normalizeText(value, question.gradingConfig) === response);
    return { status: 'graded', isCorrect, awardedPoints: isCorrect ? maxPoints : 0, maxPoints, fraction: isCorrect ? 1 : 0 };
  }

  if (type === 'multiple_choice') {
    const expected = [...new Set(question.correctAnswer || [])].sort((a, b) => a - b);
    const selected = [...new Set(answer)].sort((a, b) => a - b);
    const isCorrect = expected.length === selected.length && expected.every((value, index) => value === selected[index]);
    if (isCorrect) return { status: 'graded', isCorrect: true, awardedPoints: maxPoints, maxPoints, fraction: 1 };
    if (question.gradingConfig?.partialCredit === false || expected.length === 0) {
      return { status: 'graded', isCorrect: false, awardedPoints: 0, maxPoints, fraction: 0 };
    }
    const correctSelections = selected.filter((value) => expected.includes(value)).length;
    const incorrectSelections = selected.filter((value) => !expected.includes(value)).length;
    const fraction = Math.max(0, Math.min(1, (correctSelections - incorrectSelections) / expected.length));
    return { status: 'graded', isCorrect: false, awardedPoints: Math.round(maxPoints * fraction * 100) / 100, maxPoints, fraction };
  }

  if (type === 'true_false') {
    const isCorrect = answer === question.correctAnswer;
    return { status: 'graded', isCorrect, awardedPoints: isCorrect ? maxPoints : 0, maxPoints, fraction: isCorrect ? 1 : 0 };
  }

  const expected = Number.isInteger(question.correctAnswer) ? question.correctAnswer : question.correctIndex;
  const isCorrect = answer === expected;
  return { status: 'graded', isCorrect, awardedPoints: isCorrect ? maxPoints : 0, maxPoints, fraction: isCorrect ? 1 : 0 };
}
