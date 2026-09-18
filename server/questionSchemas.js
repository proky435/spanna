import { z } from 'zod';

const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'short_text', 'long_text'];
const difficultyValues = ['easy', 'medium', 'hard'];

export const bankCreateSchema = z.object({
  name: z.string().trim().min(1, 'A kérdésbank neve kötelező.').max(160),
  description: z.string().trim().max(2000).default(''),
  ownerType: z.enum(['personal', 'institution']).default('personal'),
  institutionId: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).nullable().optional(),
  visibility: z.enum(['private', 'shared', 'institution', 'class']).default('private'),
}).strict().superRefine((value, ctx) => {
  if (value.ownerType === 'institution' && !value.institutionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['institutionId'], message: 'Intézményi kérdésbankhoz intézmény szükséges.' });
  }
  if (value.ownerType === 'personal' && value.institutionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['institutionId'], message: 'Személyes kérdésbank nem tartozhat intézményhez.' });
  }
  if (value.ownerType === 'personal' && ['institution', 'class'].includes(value.visibility)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['visibility'], message: 'Személyes kérdésbank nem lehet intézményi vagy osztályszintű.' });
  }
  if (value.ownerType === 'institution' && !['institution', 'class'].includes(value.visibility)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['visibility'], message: 'Intézményi kérdésbank intézményi vagy osztályszintű legyen.' });
  }
});

export const bankUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  visibility: z.enum(['private', 'shared', 'institution', 'class']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Legalább egy mezőt módosítani kell.');

const optionSchema = z.string().trim().min(1).max(1000);

export const questionInputSchema = z.object({
  externalId: z.string().trim().max(160).nullable().optional(),
  type: z.enum(questionTypes),
  questionText: z.string().trim().min(1, 'A kérdés szövege kötelező.').max(10000),
  options: z.array(optionSchema).max(8).nullable().optional(),
  correctAnswer: z.unknown().nullable().optional(),
  gradingConfig: z.record(z.unknown()).default({}),
  explanation: z.string().trim().max(10000).default(''),
  subject: z.string().trim().max(160).default(''),
  topic: z.string().trim().max(160).default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  difficulty: z.enum(difficultyValues).nullable().default(null),
  defaultPoints: z.number().min(0).max(10000).default(1),
  status: z.enum(['draft', 'active']).default('active'),
}).strict().superRefine((value, ctx) => {
  const options = value.options || [];
  if (['single_choice', 'multiple_choice'].includes(value.type) && (options.length < 2 || options.length > 8)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Legalább 2, legfeljebb 8 válaszlehetőség szükséges.' });
  }
  if (value.type === 'single_choice') {
    if (!Number.isInteger(value.correctAnswer) || value.correctAnswer < 0 || value.correctAnswer >= options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswer'], message: 'Érvényes helyes válaszindex szükséges.' });
    }
  }
  if (value.type === 'multiple_choice') {
    const answers = value.correctAnswer;
    if (!Array.isArray(answers) || answers.length === 0 || !answers.every((answer) => Number.isInteger(answer) && answer >= 0 && answer < options.length) || new Set(answers).size !== answers.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswer'], message: 'Legalább egy egyedi, érvényes helyes válaszindex szükséges.' });
    }
  }
  if (value.type === 'true_false' && typeof value.correctAnswer !== 'boolean') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswer'], message: 'Igaz-hamis kérdésnél logikai helyes válasz szükséges.' });
  }
  if (['short_text', 'long_text'].includes(value.type)) {
    const mode = value.gradingConfig?.mode || 'manual';
    if (!['manual', 'automatic'].includes(mode)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gradingConfig', 'mode'], message: 'A szöveges javítás módja manual vagy automatic lehet.' });
    }
    if (mode === 'automatic' && (!Array.isArray(value.correctAnswer) || value.correctAnswer.length === 0 || !value.correctAnswer.every((answer) => typeof answer === 'string' && answer.trim()))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswer'], message: 'Automatikus szöveges javításhoz elfogadott válaszok szükségesek.' });
    }
  }
});

export const reviewDecisionSchema = z.object({
  decision: z.enum(['published', 'rejected']),
  reason: z.string().trim().max(2000).optional(),
}).strict();

export const bankClassAccessSchema = z.object({
  classIds: z.array(z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive()])).min(1).max(200),
  permission: z.enum(['view', 'use', 'edit', 'admin']).default('use'),
}).strict();

export function questionToApi(row) {
  return {
    id: String(row.id),
    questionBankId: String(row.question_bank_id),
    externalId: row.external_id,
    type: row.type,
    questionText: row.question_text,
    options: row.options,
    correctAnswer: row.correct_answer,
    gradingConfig: row.grading_config,
    explanation: row.explanation,
    subject: row.subject,
    topic: row.topic,
    tags: row.tags,
    difficulty: row.difficulty,
    defaultPoints: Number(row.default_points),
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
