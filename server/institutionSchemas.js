import { z } from 'zod';

const roleSchema = z.enum(['admin', 'teacher', 'student']);

export const institutionCreateSchema = z.object({
  name: z.string().trim().min(2, 'Az intézmény neve legalább 2 karakter legyen.').max(180),
  slug: z.string().trim().max(100).optional(),
}).strict();

export const institutionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  settings: z.record(z.unknown()).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Legalább egy mezőt módosítani kell.');

export const classCreateSchema = z.object({
  name: z.string().trim().min(1, 'Az osztály neve kötelező.').max(180),
  subject: z.string().trim().max(180).default(''),
  term: z.string().trim().max(120).default(''),
}).strict();

export const classUpdateSchema = classCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Legalább egy mezőt módosítani kell.'
);

export const invitationCreateSchema = z.object({
  kind: z.enum(['link', 'email', 'code']),
  email: z.string().trim().email('Érvénytelen email cím.').max(254).nullable().optional(),
  role: roleSchema,
  classId: z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive()]).nullable().optional(),
  maxUses: z.number().int().min(1).max(10000).default(1),
  expiresInDays: z.number().int().min(1).max(365).default(14),
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'email' && !value.email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Emailes meghíváshoz email cím szükséges.' });
  }
  if (value.kind !== 'email' && value.email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Email cím csak emailes meghívásnál adható meg.' });
  }
  if (value.kind !== 'code' && value.maxUses !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxUses'], message: 'Csak a kódos meghívás lehet többször használható.' });
  }
});

export const invitationAcceptSchema = z.object({
  token: z.string().min(20).max(200).optional(),
  code: z.string().min(4).max(40).optional(),
}).strict().refine((value) => Boolean(value.token || value.code), 'Meghívó token vagy kód szükséges.');

export const memberUpdateSchema = z.object({
  role: roleSchema.optional(),
  status: z.enum(['active', 'suspended']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Legalább egy mezőt módosítani kell.');

export const directMemberSchema = z.object({
  email: z.string().trim().email('Érvénytelen email cím.').max(254),
  role: roleSchema,
  classId: z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive()]).nullable().optional(),
}).strict();
