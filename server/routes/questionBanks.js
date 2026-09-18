import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import pool from '../db.js';
import { authMiddleware } from '../auth.js';
import { validateBody } from '../validation.js';
import { previewQuestionImport } from '../questionImport.js';
import { getInstitutionMembership, hasInstitutionRole } from '../institutionAccess.js';
import { bankClassAccessSchema, bankCreateSchema, bankUpdateSchema, questionInputSchema, questionToApi, reviewDecisionSchema } from '../questionSchemas.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
});
const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Túl sok importkérés. Próbáld újra később.' },
});
router.use(authMiddleware);

function parseId(value) {
  return /^\d+$/.test(String(value)) ? String(value) : null;
}

async function getBankAccess(bankId, userId, db = pool) {
  const result = await db.query(
    `SELECT qb.*,
       CASE
         WHEN qb.owner_user_id = $2 THEN 'admin'
         WHEN qba.permission IS NOT NULL THEN qba.permission
         WHEN im.role IN ('owner', 'admin') THEN 'admin'
         WHEN qb.visibility = 'class' THEN (
           SELECT qbca.permission FROM question_bank_class_access qbca
           JOIN classes c ON c.id = qbca.class_id AND c.institution_id = qb.institution_id AND c.archived_at IS NULL
           JOIN class_memberships cm ON cm.class_id = c.id AND cm.user_id = $2
           WHERE qbca.question_bank_id = qb.id
           ORDER BY CASE qbca.permission WHEN 'admin' THEN 1 WHEN 'edit' THEN 2 WHEN 'use' THEN 3 ELSE 4 END
           LIMIT 1
         )
         WHEN qb.visibility = 'institution' AND im.user_id IS NOT NULL THEN 'use'
         WHEN qb.visibility = 'public' AND qb.status = 'published' THEN 'view'
         ELSE NULL
       END AS permission
     FROM question_banks qb
     LEFT JOIN question_bank_access qba
       ON qba.question_bank_id = qb.id AND qba.user_id = $2
     LEFT JOIN institution_memberships im
       ON im.institution_id = qb.institution_id AND im.user_id = $2 AND im.status = 'active'
     WHERE qb.id = $1 AND qb.archived_at IS NULL`,
    [bankId, userId]
  );
  return result.rows[0] || null;
}

function canEdit(bank) {
  return bank && ['edit', 'admin'].includes(bank.permission);
}

function bankToApi(row) {
  return {
    id: String(row.id),
    ownerUserId: row.owner_user_id,
    ownerType: row.owner_type,
    institutionId: row.institution_id ? String(row.institution_id) : null,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    permission: row.permission || 'view',
    questionCount: Number(row.question_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT qb.*,
         CASE
           WHEN qb.owner_user_id = $1 THEN 'admin'
           WHEN qba.permission IS NOT NULL THEN qba.permission
           WHEN im.role IN ('owner', 'admin') THEN 'admin'
           WHEN qb.visibility = 'institution' AND im.user_id IS NOT NULL THEN 'use'
           WHEN qb.visibility = 'class' THEN (
             SELECT qbca.permission FROM question_bank_class_access qbca
             JOIN classes c ON c.id = qbca.class_id AND c.institution_id = qb.institution_id AND c.archived_at IS NULL
             JOIN class_memberships cm ON cm.class_id = c.id AND cm.user_id = $1
             WHERE qbca.question_bank_id = qb.id
             ORDER BY CASE qbca.permission WHEN 'admin' THEN 1 WHEN 'edit' THEN 2 WHEN 'use' THEN 3 ELSE 4 END
             LIMIT 1
           )
           ELSE 'view'
         END AS permission,
         (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = qb.id AND q.archived_at IS NULL) AS question_count
       FROM question_banks qb
       LEFT JOIN question_bank_access qba
         ON qba.question_bank_id = qb.id AND qba.user_id = $1
       LEFT JOIN institution_memberships im
         ON im.institution_id = qb.institution_id AND im.user_id = $1 AND im.status = 'active'
       WHERE qb.archived_at IS NULL
         AND (
           qb.owner_user_id = $1 OR qba.user_id = $1 OR im.role IN ('owner', 'admin') OR
           (qb.visibility = 'institution' AND im.user_id IS NOT NULL) OR
           (qb.visibility = 'class' AND EXISTS (
             SELECT 1 FROM question_bank_class_access qbca
             JOIN classes c ON c.id = qbca.class_id AND c.institution_id = qb.institution_id AND c.archived_at IS NULL
             JOIN class_memberships cm ON cm.class_id = c.id AND cm.user_id = $1
             WHERE qbca.question_bank_id = qb.id
           )) OR
           (qb.visibility = 'public' AND qb.status = 'published')
         )
       ORDER BY qb.updated_at DESC`,
      [req.user.id]
    );
    res.json({ banks: result.rows.map(bankToApi) });
  } catch (error) {
    console.error('Kérdésbank lista hiba:', error.message);
    res.status(500).json({ error: 'A kérdésbankok betöltése sikertelen.' });
  }
});

router.get('/moderation/pending', async (req, res) => {
  if (!req.user.isPlatformAdmin) return res.status(403).json({ error: 'Platformadmin jogosultság szükséges.' });
  try {
    const result = await pool.query(
      `SELECT qb.*,
         'admin' AS permission,
         (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = qb.id AND q.archived_at IS NULL) AS question_count
       FROM question_banks qb
       WHERE qb.status = 'pending_review' AND qb.archived_at IS NULL
       ORDER BY qb.updated_at ASC`
    );
    res.json({ banks: result.rows.map(bankToApi) });
  } catch (error) {
    console.error('Moderációs lista hiba:', error.message);
    res.status(500).json({ error: 'A moderációs lista betöltése sikertelen.' });
  }
});

router.post('/', validateBody(bankCreateSchema), async (req, res) => {
  const { name, description, visibility, ownerType, institutionId } = req.body;
  try {
    if (ownerType === 'institution') {
      const membership = await getInstitutionMembership(institutionId, req.user.id);
      if (!hasInstitutionRole(membership, ['owner', 'admin', 'teacher'])) {
        return res.status(403).json({ error: 'Ebben az intézményben nem hozhatsz létre kérdésbankot.' });
      }
    }
    const result = await pool.query(
      `INSERT INTO question_banks (owner_user_id, owner_type, institution_id, name, description, visibility, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [req.user.id, ownerType, institutionId || null, name, description, visibility]
    );
    res.status(201).json({ bank: bankToApi({ ...result.rows[0], permission: 'admin' }) });
  } catch (error) {
    console.error('Kérdésbank létrehozási hiba:', error.message);
    res.status(500).json({ error: 'A kérdésbank létrehozása sikertelen.' });
  }
});

router.get('/:bankId', async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (!bank?.permission) return res.status(404).json({ error: 'A kérdésbank nem található.' });
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM questions WHERE question_bank_id = $1 AND archived_at IS NULL',
      [bankId]
    );
    res.json({ bank: bankToApi({ ...bank, question_count: countResult.rows[0].count }) });
  } catch (error) {
    console.error('Kérdésbank betöltési hiba:', error.message);
    res.status(500).json({ error: 'A kérdésbank betöltése sikertelen.' });
  }
});

router.patch('/:bankId', validateBody(bankUpdateSchema), async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (!canEdit(bank)) return res.status(403).json({ error: 'Nincs szerkesztési jogosultságod.' });
    if (bank.owner_type === 'personal' && ['institution', 'class'].includes(req.body.visibility)) {
      return res.status(400).json({ error: 'Személyes kérdésbank nem lehet intézményi vagy osztályszintű.' });
    }
    if (bank.owner_type === 'institution' && req.body.visibility && !['institution', 'class'].includes(req.body.visibility)) {
      return res.status(400).json({ error: 'Intézményi kérdésbank intézményi vagy osztályszintű legyen.' });
    }
    const next = {
      name: req.body.name ?? bank.name,
      description: req.body.description ?? bank.description,
      visibility: req.body.visibility ?? bank.visibility,
    };
    const result = await pool.query(
      `UPDATE question_banks
       SET name = $2, description = $3, visibility = $4,
           status = CASE WHEN status IN ('published', 'pending_review') AND $4 <> 'public' THEN 'active' ELSE status END
       WHERE id = $1
       RETURNING *`,
      [bankId, next.name, next.description, next.visibility]
    );
    res.json({ bank: bankToApi({ ...result.rows[0], permission: bank.permission }) });
  } catch (error) {
    console.error('Kérdésbank módosítási hiba:', error.message);
    res.status(500).json({ error: 'A kérdésbank módosítása sikertelen.' });
  }
});

router.delete('/:bankId', async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (bank?.permission !== 'admin') return res.status(403).json({ error: 'Nincs adminisztrációs jogosultságod.' });
    await pool.query(
      `UPDATE question_banks SET status = 'archived', archived_at = NOW() WHERE id = $1`,
      [bankId]
    );
    res.status(204).end();
  } catch (error) {
    console.error('Kérdésbank archiválási hiba:', error.message);
    res.status(500).json({ error: 'A kérdésbank archiválása sikertelen.' });
  }
});

router.post('/:bankId/submit-review', async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (bank?.permission !== 'admin') return res.status(403).json({ error: 'Nincs adminisztrációs jogosultságod.' });
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM questions WHERE question_bank_id = $1 AND status = 'active' AND archived_at IS NULL`,
      [bankId]
    );
    if (Number(countResult.rows[0].count) === 0) {
      return res.status(400).json({ error: 'Üres kérdésbank nem küldhető moderációra.' });
    }
    const result = await pool.query(
      `UPDATE question_banks SET visibility = 'public', status = 'pending_review' WHERE id = $1 RETURNING *`,
      [bankId]
    );
    res.json({ bank: bankToApi({ ...result.rows[0], permission: bank.permission }) });
  } catch (error) {
    console.error('Moderációra küldési hiba:', error.message);
    res.status(500).json({ error: 'A kérdésbank beküldése sikertelen.' });
  }
});

router.post('/:bankId/review', validateBody(reviewDecisionSchema), async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    if (!req.user.isPlatformAdmin) return res.status(403).json({ error: 'Platformadmin jogosultság szükséges.' });
    const result = await pool.query(
      `UPDATE question_banks SET status = $2 WHERE id = $1 AND status = 'pending_review' AND archived_at IS NULL RETURNING *`,
      [bankId, req.body.decision]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Moderálható kérdésbank nem található.' });
    res.json({ bank: bankToApi({ ...result.rows[0], permission: 'admin' }) });
  } catch (error) {
    console.error('Moderációs hiba:', error.message);
    res.status(500).json({ error: 'A moderációs döntés mentése sikertelen.' });
  }
});

router.get('/:bankId/class-access', async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (!canEdit(bank) || bank.owner_type !== 'institution') return res.status(403).json({ error: 'Nincs jogosultságod az osztályhozzáférés kezeléséhez.' });
    const result = await pool.query(
      `SELECT c.id, c.name, c.subject, qbca.permission
       FROM classes c
       LEFT JOIN question_bank_class_access qbca ON qbca.class_id = c.id AND qbca.question_bank_id = $1
       WHERE c.institution_id = $2 AND c.archived_at IS NULL
       ORDER BY c.name`,
      [bankId, bank.institution_id]
    );
    res.json({ classes: result.rows.map((row) => ({ id: String(row.id), name: row.name, subject: row.subject, permission: row.permission })) });
  } catch (error) {
    console.error('Osztályhozzáférés betöltési hiba:', error.message);
    res.status(500).json({ error: 'Az osztályhozzáférések betöltése sikertelen.' });
  }
});

router.put('/:bankId/class-access', validateBody(bankClassAccessSchema), async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM question_banks WHERE id = $1 FOR UPDATE', [bankId]);
    const bank = await getBankAccess(bankId, req.user.id, client);
    if (!canEdit(bank) || bank.owner_type !== 'institution') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Nincs jogosultságod az osztályhozzáférés kezeléséhez.' });
    }
    const classResult = await client.query(
      `SELECT id FROM classes WHERE institution_id = $1 AND archived_at IS NULL AND id = ANY($2::bigint[])`,
      [bank.institution_id, req.body.classIds]
    );
    if (classResult.rows.length !== new Set(req.body.classIds.map(String)).size) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Egy vagy több osztály nem ehhez az intézményhez tartozik.' });
    }
    await client.query('DELETE FROM question_bank_class_access WHERE question_bank_id = $1', [bankId]);
    for (const classId of req.body.classIds) {
      await client.query(
        `INSERT INTO question_bank_class_access (question_bank_id, class_id, permission) VALUES ($1, $2, $3)`,
        [bankId, classId, req.body.permission]
      );
    }
    await client.query(`UPDATE question_banks SET visibility = 'class' WHERE id = $1`, [bankId]);
    await client.query('COMMIT');
    res.json({ classIds: req.body.classIds.map(String), permission: req.body.permission });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Osztályhozzáférés mentési hiba:', error.message);
    res.status(500).json({ error: 'Az osztályhozzáférések mentése sikertelen.' });
  } finally {
    client.release();
  }
});

router.post('/:bankId/import/preview', importLimiter, upload.single('file'), async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  if (!req.file) return res.status(400).json({ error: 'Fájl feltöltése kötelező.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (!canEdit(bank)) return res.status(403).json({ error: 'Nincs szerkesztési jogosultságod.' });
    const preview = await previewQuestionImport(req.file);
    const externalIds = preview.questions.map((question) => question.externalId).filter(Boolean);
    const existingResult = externalIds.length > 0
      ? await pool.query('SELECT external_id FROM questions WHERE question_bank_id = $1 AND external_id = ANY($2::varchar[])', [bankId, externalIds])
      : { rows: [] };
    const existingIds = new Set(existingResult.rows.map((row) => row.external_id));
    const seenIds = new Set();
    let duplicateCount = 0;
    externalIds.forEach((externalId) => {
      if (existingIds.has(externalId) || seenIds.has(externalId)) duplicateCount++;
      seenIds.add(externalId);
    });
    res.json({
      fileName: req.file.originalname,
      fileType: req.file.originalname.split('.').pop()?.toLowerCase(),
      duplicateCount,
      ...preview,
    });
  } catch (error) {
    console.error('Import előnézet hiba:', error.message);
    res.status(400).json({ error: error.message || 'A fájl feldolgozása sikertelen.' });
  }
});

router.post('/:bankId/import/commit', importLimiter, async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  const { fileName, fileType, questions, totalRows, invalidRows = 0 } = req.body || {};
  if (!['json', 'csv', 'xlsx'].includes(fileType) || typeof fileName !== 'string' || !Array.isArray(questions) || questions.length === 0 || questions.length > 5000 || !Number.isInteger(totalRows) || !Number.isInteger(invalidRows) || totalRows !== questions.length + invalidRows) {
    return res.status(400).json({ error: 'Érvénytelen importadatok.' });
  }
  const parsedQuestions = [];
  const errors = [];
  questions.forEach((question, index) => {
    const { source, ...input } = question || {};
    const result = questionInputSchema.safeParse(input);
    if (result.success) parsedQuestions.push(result.data);
    else errors.push({ row: source?.row || index + 1, messages: result.error.issues.map((issue) => issue.message) });
  });
  if (errors.length > 0) return res.status(400).json({ error: 'Az import hibás kérdéseket tartalmaz.', errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM question_banks WHERE id = $1 FOR UPDATE', [bankId]);
    const bank = await getBankAccess(bankId, req.user.id, client);
    if (!canEdit(bank)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Nincs szerkesztési jogosultságod.' });
    }
    const importResult = await client.query(
      `INSERT INTO question_imports (
         question_bank_id, file_name, file_type, status, total_rows, valid_rows, invalid_rows, created_by
       ) VALUES ($1,$2,$3,'preview',$4,$5,$6,$7) RETURNING id`,
      [bankId, fileName.slice(0, 255), fileType, totalRows, parsedQuestions.length, invalidRows, req.user.id]
    );
    let inserted = 0;
    let duplicates = 0;
    for (const q of parsedQuestions) {
      const result = await client.query(
        `INSERT INTO questions (
           question_bank_id, external_id, type, question_text, options, correct_answer,
           grading_config, explanation, subject, topic, tags, difficulty,
           default_points, status, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (question_bank_id, external_id) DO NOTHING
         RETURNING id`,
        [bankId, q.externalId || null, q.type, q.questionText, JSON.stringify(q.options ?? null),
         JSON.stringify(q.correctAnswer ?? null), JSON.stringify(q.gradingConfig), q.explanation,
         q.subject, q.topic, JSON.stringify(q.tags), q.difficulty, q.defaultPoints, q.status, req.user.id]
      );
      if (result.rows.length > 0) inserted++;
      else duplicates++;
    }
    await client.query(
      `UPDATE question_imports
       SET status='completed', valid_rows=$2, duplicate_rows=$3, completed_at=NOW()
       WHERE id=$1`,
      [importResult.rows[0].id, inserted, duplicates]
    );
    if (inserted > 0) {
      await client.query(`UPDATE question_banks SET status = 'pending_review' WHERE id = $1 AND status = 'published'`, [bankId]);
    }
    await client.query('COMMIT');
    res.status(201).json({ importId: String(importResult.rows[0].id), inserted, duplicates });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import mentési hiba:', error.message);
    res.status(500).json({ error: 'Az import mentése sikertelen.' });
  } finally {
    client.release();
  }
});

router.get('/:bankId/questions', async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (!bank?.permission) return res.status(404).json({ error: 'A kérdésbank nem található.' });
    const result = await pool.query(
      `SELECT * FROM questions WHERE question_bank_id = $1 AND archived_at IS NULL ORDER BY created_at DESC`,
      [bankId]
    );
    res.json({ questions: result.rows.map(questionToApi), canEdit: canEdit(bank) });
  } catch (error) {
    console.error('Kérdéslista hiba:', error.message);
    res.status(500).json({ error: 'A kérdések betöltése sikertelen.' });
  }
});

router.post('/:bankId/questions', validateBody(questionInputSchema), async (req, res) => {
  const bankId = parseId(req.params.bankId);
  if (!bankId) return res.status(400).json({ error: 'Érvénytelen kérdésbank-azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (!canEdit(bank)) return res.status(403).json({ error: 'Nincs szerkesztési jogosultságod.' });
    const q = req.body;
    const result = await pool.query(
      `INSERT INTO questions (
         question_bank_id, external_id, type, question_text, options, correct_answer,
         grading_config, explanation, subject, topic, tags, difficulty,
         default_points, status, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [bankId, q.externalId || null, q.type, q.questionText, JSON.stringify(q.options ?? null),
       JSON.stringify(q.correctAnswer ?? null), JSON.stringify(q.gradingConfig), q.explanation,
       q.subject, q.topic, JSON.stringify(q.tags), q.difficulty, q.defaultPoints, q.status, req.user.id]
    );
    await pool.query(`UPDATE question_banks SET status = 'pending_review' WHERE id = $1 AND status = 'published'`, [bankId]);
    res.status(201).json({ question: questionToApi(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ez a külső azonosító már létezik ebben a kérdésbankban.' });
    console.error('Kérdés létrehozási hiba:', error.message);
    res.status(500).json({ error: 'A kérdés létrehozása sikertelen.' });
  }
});

router.put('/:bankId/questions/:questionId', validateBody(questionInputSchema), async (req, res) => {
  const bankId = parseId(req.params.bankId);
  const questionId = parseId(req.params.questionId);
  if (!bankId || !questionId) return res.status(400).json({ error: 'Érvénytelen azonosító.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM question_banks WHERE id = $1 FOR UPDATE', [bankId]);
    const bank = await getBankAccess(bankId, req.user.id, client);
    if (!canEdit(bank)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Nincs szerkesztési jogosultságod.' });
    }
    const currentResult = await client.query(
      `SELECT * FROM questions WHERE id = $1 AND question_bank_id = $2 AND archived_at IS NULL FOR UPDATE`,
      [questionId, bankId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'A kérdés nem található.' });
    }
    await client.query(
      `INSERT INTO question_versions (question_id, version, snapshot, created_by) VALUES ($1, $2, $3, $4)`,
      [questionId, current.version, JSON.stringify(questionToApi(current)), req.user.id]
    );
    const q = req.body;
    const result = await client.query(
      `UPDATE questions SET
         external_id=$3, type=$4, question_text=$5, options=$6, correct_answer=$7,
         grading_config=$8, explanation=$9, subject=$10, topic=$11, tags=$12,
         difficulty=$13, default_points=$14, status=$15, version=version+1
       WHERE id=$1 AND question_bank_id=$2 RETURNING *`,
      [questionId, bankId, q.externalId || null, q.type, q.questionText, JSON.stringify(q.options ?? null),
       JSON.stringify(q.correctAnswer ?? null), JSON.stringify(q.gradingConfig), q.explanation,
       q.subject, q.topic, JSON.stringify(q.tags), q.difficulty, q.defaultPoints, q.status]
    );
    await client.query(`UPDATE question_banks SET status = 'pending_review' WHERE id = $1 AND status = 'published'`, [bankId]);
    await client.query('COMMIT');
    res.json({ question: questionToApi(result.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'Ez a külső azonosító már létezik ebben a kérdésbankban.' });
    console.error('Kérdés módosítási hiba:', error.message);
    res.status(500).json({ error: 'A kérdés módosítása sikertelen.' });
  } finally {
    client.release();
  }
});

router.delete('/:bankId/questions/:questionId', async (req, res) => {
  const bankId = parseId(req.params.bankId);
  const questionId = parseId(req.params.questionId);
  if (!bankId || !questionId) return res.status(400).json({ error: 'Érvénytelen azonosító.' });
  try {
    const bank = await getBankAccess(bankId, req.user.id);
    if (!canEdit(bank)) return res.status(403).json({ error: 'Nincs szerkesztési jogosultságod.' });
    const result = await pool.query(
      `UPDATE questions SET status = 'archived', archived_at = NOW()
       WHERE id = $1 AND question_bank_id = $2 AND archived_at IS NULL RETURNING id`,
      [questionId, bankId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'A kérdés nem található.' });
    await pool.query(`UPDATE question_banks SET status = 'pending_review' WHERE id = $1 AND status = 'published'`, [bankId]);
    res.status(204).end();
  } catch (error) {
    console.error('Kérdés archiválási hiba:', error.message);
    res.status(500).json({ error: 'A kérdés archiválása sikertelen.' });
  }
});

export default router;
