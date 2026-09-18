import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('Érvénytelen email cím.').max(254),
  password: z.string().min(8, 'A jelszó legalább 8 karakter legyen.').max(128),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email('Érvénytelen email cím.').max(254),
  password: z.string().min(1, 'A jelszó kötelező.').max(128),
}).strict();

const syncedStateSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  progress: z.record(z.unknown()).optional(),
  wrong: z.array(z.union([z.string(), z.number()])).max(10000).optional(),
  bookmarks: z.array(z.union([z.string(), z.number()])).max(10000).optional(),
  lastExam: z.unknown().nullable().optional(),
  sm2: z.record(z.unknown()).optional(),
  examHistory: z.array(z.unknown()).max(50).optional(),
}).passthrough();

export const syncPushSchema = z.object({
  state: syncedStateSchema,
}).strict();

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: result.error.issues[0]?.message || 'Érvénytelen kérés.',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}
