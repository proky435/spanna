import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../auth.js';
import { validateBody } from '../validation.js';
import {
  classCreateSchema,
  classUpdateSchema,
  directMemberSchema,
  institutionCreateSchema,
  institutionUpdateSchema,
  invitationAcceptSchema,
  invitationCreateSchema,
  memberUpdateSchema,
} from '../institutionSchemas.js';
import { getInstitutionMembership, hasInstitutionRole, parseNumericId, slugify, writeAudit } from '../institutionAccess.js';

const router = Router();
router.use(authMiddleware);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function institutionToApi(row) {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    settings: row.settings || {},
    role: row.role,
    memberCount: Number(row.member_count || 0),
    classCount: Number(row.class_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function classToApi(row) {
  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    name: row.name,
    subject: row.subject,
    term: row.term,
    memberCount: Number(row.member_count || 0),
    role: row.user_role || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function uniqueSlug(name, requested, db) {
  const base = slugify(requested || name) || 'intezmeny';
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const result = await db.query('SELECT 1 FROM institutions WHERE slug = $1', [candidate]);
    if (result.rows.length === 0) return candidate;
  }
  return `${base}-${randomBytes(3).toString('hex')}`;
}

async function requireMembership(req, res, roles = null, db = pool) {
  const institutionId = parseNumericId(req.params.institutionId);
  if (!institutionId) {
    res.status(400).json({ error: 'Érvénytelen intézményazonosító.' });
    return null;
  }
  const membership = await getInstitutionMembership(institutionId, req.user.id, db);
  if (!membership || (roles && !hasInstitutionRole(membership, roles))) {
    res.status(403).json({ error: 'Nincs jogosultságod ehhez az intézményhez.' });
    return null;
  }
  return { institutionId, membership };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, im.role,
         (SELECT COUNT(*) FROM institution_memberships m WHERE m.institution_id = i.id AND m.status = 'active') AS member_count,
         (SELECT COUNT(*) FROM classes c WHERE c.institution_id = i.id AND c.archived_at IS NULL) AS class_count
       FROM institutions i
       JOIN institution_memberships im ON im.institution_id = i.id
       WHERE im.user_id = $1 AND im.status = 'active' AND i.archived_at IS NULL
       ORDER BY i.name`,
      [req.user.id]
    );
    res.json({ institutions: result.rows.map(institutionToApi) });
  } catch (error) {
    console.error('Intézménylista hiba:', error.message);
    res.status(500).json({ error: 'Az intézmények betöltése sikertelen.' });
  }
});

router.post('/', validateBody(institutionCreateSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slug = await uniqueSlug(req.body.name, req.body.slug, client);
    const result = await client.query(
      `INSERT INTO institutions (name, slug, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [req.body.name, slug, req.user.id]
    );
    const institution = result.rows[0];
    await client.query(
      `INSERT INTO institution_memberships (institution_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [institution.id, req.user.id]
    );
    await writeAudit({ institutionId: institution.id, userId: req.user.id, action: 'institution.created', entityType: 'institution', entityId: institution.id }, client);
    await client.query('COMMIT');
    res.status(201).json({ institution: institutionToApi({ ...institution, role: 'owner', member_count: 1, class_count: 0 }) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Intézmény létrehozási hiba:', error.message);
    res.status(500).json({ error: 'Az intézmény létrehozása sikertelen.' });
  } finally {
    client.release();
  }
});

router.post('/invitations/accept', validateBody(invitationAcceptSchema), async (req, res) => {
  const lookupHash = hash(req.body.token || req.body.code.trim().toUpperCase());
  const field = req.body.token ? 'token_hash' : 'code_hash';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT inv.*, i.name AS institution_name
       FROM invitations inv
       JOIN institutions i ON i.id = inv.institution_id AND i.archived_at IS NULL
       WHERE inv.${field} = $1 AND inv.revoked_at IS NULL
         AND inv.expires_at > NOW() AND inv.used_count < inv.max_uses
       FOR UPDATE OF inv`,
      [lookupHash]
    );
    const invitation = result.rows[0];
    if (!invitation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'A meghívó érvénytelen vagy lejárt.' });
    }
    if (invitation.kind === 'email' && invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Ez a meghívó másik email címhez tartozik.' });
    }
    if (invitation.class_id) {
      const classResult = await client.query(
        'SELECT id FROM classes WHERE id = $1 AND institution_id = $2 AND archived_at IS NULL',
        [invitation.class_id, invitation.institution_id]
      );
      if (!classResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(410).json({ error: 'A meghívóhoz tartozó osztály már nem elérhető.' });
      }
    }
    const membershipResult = await client.query(
      `INSERT INTO institution_memberships (institution_id, user_id, role, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (institution_id, user_id) DO UPDATE
       SET role = CASE
             WHEN institution_memberships.role = 'owner' THEN 'owner'
             WHEN institution_memberships.role = 'admin' OR EXCLUDED.role = 'admin' THEN 'admin'
             WHEN institution_memberships.role = 'teacher' OR EXCLUDED.role = 'teacher' THEN 'teacher'
             ELSE 'student'
           END,
           status = 'active'
       RETURNING role`,
      [invitation.institution_id, req.user.id, invitation.role]
    );
    if (invitation.class_id) {
      const classRole = invitation.role === 'student' ? 'student' : 'teacher';
      await client.query(
        `INSERT INTO class_memberships (class_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (class_id, user_id) DO UPDATE
         SET role = CASE WHEN class_memberships.role = 'teacher' OR EXCLUDED.role = 'teacher' THEN 'teacher' ELSE 'student' END`,
        [invitation.class_id, req.user.id, classRole]
      );
    }
    await client.query('UPDATE invitations SET used_count = used_count + 1 WHERE id = $1', [invitation.id]);
    await writeAudit({ institutionId: invitation.institution_id, userId: req.user.id, action: 'invitation.accepted', entityType: 'invitation', entityId: invitation.id }, client);
    await client.query('COMMIT');
    res.json({ institution: { id: String(invitation.institution_id), name: invitation.institution_name, role: membershipResult.rows[0].role } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Meghívó elfogadási hiba:', error.message);
    res.status(500).json({ error: 'A meghívó elfogadása sikertelen.' });
  } finally {
    client.release();
  }
});

router.get('/:institutionId', async (req, res) => {
  try {
    const access = await requireMembership(req, res);
    if (!access) return;
    const result = await pool.query(
      `SELECT i.*, $2::varchar AS role,
         (SELECT COUNT(*) FROM institution_memberships m WHERE m.institution_id = i.id AND m.status = 'active') AS member_count,
         (SELECT COUNT(*) FROM classes c WHERE c.institution_id = i.id AND c.archived_at IS NULL) AS class_count
       FROM institutions i WHERE i.id = $1 AND i.archived_at IS NULL`,
      [access.institutionId, access.membership.role]
    );
    res.json({ institution: institutionToApi(result.rows[0]) });
  } catch (error) {
    console.error('Intézmény betöltési hiba:', error.message);
    res.status(500).json({ error: 'Az intézmény betöltése sikertelen.' });
  }
});

router.patch('/:institutionId', validateBody(institutionUpdateSchema), async (req, res) => {
  try {
    const access = await requireMembership(req, res, ['owner', 'admin']);
    if (!access) return;
    const currentResult = await pool.query('SELECT * FROM institutions WHERE id = $1 AND archived_at IS NULL', [access.institutionId]);
    const current = currentResult.rows[0];
    const result = await pool.query(
      `UPDATE institutions SET name = $2, settings = $3 WHERE id = $1 RETURNING *`,
      [access.institutionId, req.body.name ?? current.name, JSON.stringify(req.body.settings ?? current.settings)]
    );
    await writeAudit({ institutionId: access.institutionId, userId: req.user.id, action: 'institution.updated', entityType: 'institution', entityId: access.institutionId });
    res.json({ institution: institutionToApi({ ...result.rows[0], role: access.membership.role }) });
  } catch (error) {
    console.error('Intézmény módosítási hiba:', error.message);
    res.status(500).json({ error: 'Az intézmény módosítása sikertelen.' });
  }
});

router.get('/:institutionId/members', async (req, res) => {
  try {
    const access = await requireMembership(req, res, ['owner', 'admin', 'teacher']);
    if (!access) return;
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, im.role, im.status, im.joined_at
       FROM institution_memberships im
       JOIN users u ON u.id = im.user_id AND u.deleted_at IS NULL
       WHERE im.institution_id = $1
         AND ($2::varchar IN ('owner', 'admin') OR EXISTS (
           SELECT 1
           FROM class_memberships teacher_membership
           JOIN classes c ON c.id = teacher_membership.class_id AND c.institution_id = $1 AND c.archived_at IS NULL
           JOIN class_memberships target_membership ON target_membership.class_id = c.id AND target_membership.user_id = im.user_id
           WHERE teacher_membership.user_id = $3 AND teacher_membership.role = 'teacher'
         ))
       ORDER BY CASE im.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'teacher' THEN 3 ELSE 4 END, u.email`,
      [access.institutionId, access.membership.role, req.user.id]
    );
    res.json({ members: result.rows.map((row) => ({ id: row.id, email: row.email, displayName: row.display_name, role: row.role, status: row.status, joinedAt: row.joined_at })) });
  } catch (error) {
    console.error('Taglista hiba:', error.message);
    res.status(500).json({ error: 'A tagok betöltése sikertelen.' });
  }
});

router.post('/:institutionId/members', validateBody(directMemberSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const access = await requireMembership(req, res, ['owner', 'admin'], client);
    if (!access) { await client.query('ROLLBACK'); return; }
    if (req.body.role === 'admin' && access.membership.role !== 'owner') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Adminisztrátort csak a tulajdonos adhat hozzá.' });
    }
    const userResult = await client.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL', [req.body.email]);
    const user = userResult.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nincs regisztrált felhasználó ezzel az email címmel. Küldj emailes meghívót.' });
    }
    const membershipResult = await client.query(
      `INSERT INTO institution_memberships (institution_id, user_id, role, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (institution_id, user_id) DO UPDATE
       SET role = CASE
             WHEN institution_memberships.role = 'owner' THEN 'owner'
             WHEN institution_memberships.role = 'admin' OR EXCLUDED.role = 'admin' THEN 'admin'
             WHEN institution_memberships.role = 'teacher' OR EXCLUDED.role = 'teacher' THEN 'teacher'
             ELSE 'student'
           END,
           status = 'active'
       RETURNING role`,
      [access.institutionId, user.id, req.body.role]
    );
    if (req.body.classId) {
      const classResult = await client.query('SELECT id FROM classes WHERE id = $1 AND institution_id = $2 AND archived_at IS NULL', [req.body.classId, access.institutionId]);
      if (!classResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Az osztály nem található.' });
      }
      await client.query(
        `INSERT INTO class_memberships (class_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (class_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [req.body.classId, user.id, req.body.role === 'student' ? 'student' : 'teacher']
      );
    }
    await writeAudit({ institutionId: access.institutionId, userId: req.user.id, action: 'member.added', entityType: 'user', entityId: user.id, metadata: { role: req.body.role } }, client);
    await client.query('COMMIT');
    res.status(201).json({ member: { id: user.id, email: user.email, role: membershipResult.rows[0].role, status: 'active' } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tag hozzáadási hiba:', error.message);
    res.status(500).json({ error: 'A tag hozzáadása sikertelen.' });
  } finally {
    client.release();
  }
});

router.patch('/:institutionId/members/:userId', validateBody(memberUpdateSchema), async (req, res) => {
  const userId = parseNumericId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'Érvénytelen felhasználó-azonosító.' });
  try {
    const access = await requireMembership(req, res, ['owner', 'admin']);
    if (!access) return;
    const targetResult = await pool.query('SELECT role FROM institution_memberships WHERE institution_id = $1 AND user_id = $2', [access.institutionId, userId]);
    const target = targetResult.rows[0];
    if (!target) return res.status(404).json({ error: 'A tag nem található.' });
    if (target.role === 'owner') return res.status(403).json({ error: 'A tulajdonos tagsága itt nem módosítható.' });
    if ((target.role === 'admin' || req.body.role === 'admin') && access.membership.role !== 'owner') {
      return res.status(403).json({ error: 'Adminisztrátort csak a tulajdonos kezelhet.' });
    }
    const result = await pool.query(
      `UPDATE institution_memberships SET role = COALESCE($3, role), status = COALESCE($4, status)
       WHERE institution_id = $1 AND user_id = $2 RETURNING *`,
      [access.institutionId, userId, req.body.role || null, req.body.status || null]
    );
    await writeAudit({ institutionId: access.institutionId, userId: req.user.id, action: 'member.updated', entityType: 'user', entityId: userId, metadata: req.body });
    res.json({ member: result.rows[0] });
  } catch (error) {
    console.error('Tag módosítási hiba:', error.message);
    res.status(500).json({ error: 'A tag módosítása sikertelen.' });
  }
});

router.get('/:institutionId/classes', async (req, res) => {
  try {
    const access = await requireMembership(req, res);
    if (!access) return;
    const result = await pool.query(
      `SELECT c.*,
         (SELECT COUNT(*) FROM class_memberships cm WHERE cm.class_id = c.id) AS member_count,
         (SELECT cm.role FROM class_memberships cm WHERE cm.class_id = c.id AND cm.user_id = $2) AS user_role
       FROM classes c
       WHERE c.institution_id = $1 AND c.archived_at IS NULL
         AND ($3::varchar IN ('owner', 'admin', 'teacher') OR EXISTS (
           SELECT 1 FROM class_memberships cm WHERE cm.class_id = c.id AND cm.user_id = $2
         ))
       ORDER BY c.name`,
      [access.institutionId, req.user.id, access.membership.role]
    );
    res.json({ classes: result.rows.map(classToApi) });
  } catch (error) {
    console.error('Osztálylista hiba:', error.message);
    res.status(500).json({ error: 'Az osztályok betöltése sikertelen.' });
  }
});

router.post('/:institutionId/classes', validateBody(classCreateSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const access = await requireMembership(req, res, ['owner', 'admin', 'teacher'], client);
    if (!access) { await client.query('ROLLBACK'); return; }
    const result = await client.query(
      `INSERT INTO classes (institution_id, name, subject, term, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [access.institutionId, req.body.name, req.body.subject, req.body.term, req.user.id]
    );
    const created = result.rows[0];
    await client.query(`INSERT INTO class_memberships (class_id, user_id, role) VALUES ($1, $2, 'teacher') ON CONFLICT DO NOTHING`, [created.id, req.user.id]);
    await writeAudit({ institutionId: access.institutionId, userId: req.user.id, action: 'class.created', entityType: 'class', entityId: created.id }, client);
    await client.query('COMMIT');
    res.status(201).json({ class: classToApi({ ...created, member_count: 1, user_role: 'teacher' }) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Osztály létrehozási hiba:', error.message);
    res.status(500).json({ error: 'Az osztály létrehozása sikertelen.' });
  } finally {
    client.release();
  }
});

router.patch('/:institutionId/classes/:classId', validateBody(classUpdateSchema), async (req, res) => {
  const classId = parseNumericId(req.params.classId);
  if (!classId) return res.status(400).json({ error: 'Érvénytelen osztályazonosító.' });
  try {
    const access = await requireMembership(req, res, ['owner', 'admin', 'teacher']);
    if (!access) return;
    const currentResult = await pool.query('SELECT * FROM classes WHERE id = $1 AND institution_id = $2 AND archived_at IS NULL', [classId, access.institutionId]);
    const current = currentResult.rows[0];
    if (!current) return res.status(404).json({ error: 'Az osztály nem található.' });
    if (access.membership.role === 'teacher') {
      const teacherResult = await pool.query(`SELECT 1 FROM class_memberships WHERE class_id = $1 AND user_id = $2 AND role = 'teacher'`, [classId, req.user.id]);
      if (!teacherResult.rows[0]) return res.status(403).json({ error: 'Ezt az osztályt nem szerkesztheted.' });
    }
    const result = await pool.query(
      `UPDATE classes SET name=$3, subject=$4, term=$5 WHERE id=$1 AND institution_id=$2 RETURNING *`,
      [classId, access.institutionId, req.body.name ?? current.name, req.body.subject ?? current.subject, req.body.term ?? current.term]
    );
    await writeAudit({ institutionId: access.institutionId, userId: req.user.id, action: 'class.updated', entityType: 'class', entityId: classId });
    res.json({ class: classToApi(result.rows[0]) });
  } catch (error) {
    console.error('Osztály módosítási hiba:', error.message);
    res.status(500).json({ error: 'Az osztály módosítása sikertelen.' });
  }
});

router.get('/:institutionId/classes/:classId/members', async (req, res) => {
  const classId = parseNumericId(req.params.classId);
  if (!classId) return res.status(400).json({ error: 'Érvénytelen osztályazonosító.' });
  try {
    const access = await requireMembership(req, res);
    if (!access) return;
    const classResult = await pool.query('SELECT id FROM classes WHERE id = $1 AND institution_id = $2 AND archived_at IS NULL', [classId, access.institutionId]);
    if (!classResult.rows[0]) return res.status(404).json({ error: 'Az osztály nem található.' });
    if (!['owner', 'admin'].includes(access.membership.role)) {
      const teacherResult = await pool.query(`SELECT 1 FROM class_memberships WHERE class_id=$1 AND user_id=$2 AND role='teacher'`, [classId, req.user.id]);
      if (!teacherResult.rows[0]) return res.status(403).json({ error: 'Az osztály taglistája nem érhető el.' });
    }
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, cm.role, cm.joined_at
       FROM class_memberships cm JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
       WHERE cm.class_id = $1 ORDER BY cm.role DESC, u.email`,
      [classId]
    );
    res.json({ members: result.rows.map((row) => ({ id: row.id, email: row.email, displayName: row.display_name, role: row.role, joinedAt: row.joined_at })) });
  } catch (error) {
    console.error('Osztálytag-lista hiba:', error.message);
    res.status(500).json({ error: 'Az osztály tagjainak betöltése sikertelen.' });
  }
});

router.get('/:institutionId/invitations', async (req, res) => {
  try {
    const access = await requireMembership(req, res, ['owner', 'admin', 'teacher']);
    if (!access) return;
    const result = await pool.query(
      `SELECT inv.id, inv.kind, inv.email, inv.role, inv.class_id, inv.max_uses, inv.used_count,
              inv.expires_at, inv.created_at, inv.revoked_at, c.name AS class_name
       FROM invitations inv LEFT JOIN classes c ON c.id = inv.class_id
       WHERE inv.institution_id = $1
         AND ($2::varchar IN ('owner', 'admin') OR inv.created_by = $3)
       ORDER BY inv.created_at DESC LIMIT 200`,
      [access.institutionId, access.membership.role, req.user.id]
    );
    res.json({ invitations: result.rows.map((row) => ({ id: String(row.id), kind: row.kind, email: row.email, role: row.role, classId: row.class_id ? String(row.class_id) : null, className: row.class_name, maxUses: row.max_uses, usedCount: row.used_count, expiresAt: row.expires_at, revokedAt: row.revoked_at })) });
  } catch (error) {
    console.error('Meghívólista hiba:', error.message);
    res.status(500).json({ error: 'A meghívók betöltése sikertelen.' });
  }
});

router.post('/:institutionId/invitations', validateBody(invitationCreateSchema), async (req, res) => {
  try {
    const access = await requireMembership(req, res, ['owner', 'admin', 'teacher']);
    if (!access) return;
    if (access.membership.role === 'teacher' && (req.body.role !== 'student' || !req.body.classId)) {
      return res.status(403).json({ error: 'Oktató csak saját osztályához hívhat diákot.' });
    }
    if (req.body.role === 'admin' && access.membership.role !== 'owner') {
      return res.status(403).json({ error: 'Adminisztrátort csak a tulajdonos hívhat meg.' });
    }
    if (req.body.classId) {
      const classResult = await pool.query('SELECT id FROM classes WHERE id = $1 AND institution_id = $2 AND archived_at IS NULL', [req.body.classId, access.institutionId]);
      if (!classResult.rows[0]) return res.status(404).json({ error: 'Az osztály nem található.' });
      if (access.membership.role === 'teacher') {
        const teacherResult = await pool.query(`SELECT 1 FROM class_memberships WHERE class_id=$1 AND user_id=$2 AND role='teacher'`, [req.body.classId, req.user.id]);
        if (!teacherResult.rows[0]) return res.status(403).json({ error: 'Ehhez az osztályhoz nem hívhatsz meg diákot.' });
      }
    }
    const token = req.body.kind === 'code' ? null : randomBytes(32).toString('base64url');
    const code = req.body.kind === 'code' ? `VM-${randomBytes(10).toString('hex').toUpperCase()}` : null;
    const expiresAt = new Date(Date.now() + req.body.expiresInDays * 86400000);
    const result = await pool.query(
      `INSERT INTO invitations (
         institution_id, class_id, kind, email, role, token_hash, code_hash,
         max_uses, expires_at, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [access.institutionId, req.body.classId || null, req.body.kind,
       req.body.email?.toLowerCase() || null, req.body.role, token ? hash(token) : null,
       code ? hash(code) : null, req.body.maxUses, expiresAt, req.user.id]
    );
    await writeAudit({ institutionId: access.institutionId, userId: req.user.id, action: 'invitation.created', entityType: 'invitation', entityId: result.rows[0].id, metadata: { kind: req.body.kind, role: req.body.role } });
    res.status(201).json({ invitation: { id: String(result.rows[0].id), kind: req.body.kind, token, code, email: req.body.email || null, role: req.body.role, classId: req.body.classId || null, maxUses: req.body.maxUses, expiresAt } });
  } catch (error) {
    console.error('Meghívó létrehozási hiba:', error.message);
    res.status(500).json({ error: 'A meghívó létrehozása sikertelen.' });
  }
});

router.delete('/:institutionId/invitations/:invitationId', async (req, res) => {
  const invitationId = parseNumericId(req.params.invitationId);
  if (!invitationId) return res.status(400).json({ error: 'Érvénytelen meghívóazonosító.' });
  try {
    const access = await requireMembership(req, res, ['owner', 'admin', 'teacher']);
    if (!access) return;
    const result = await pool.query(
      `UPDATE invitations SET revoked_at = NOW()
       WHERE id = $1 AND institution_id = $2 AND revoked_at IS NULL
         AND ($3::varchar IN ('owner', 'admin') OR created_by = $4)
       RETURNING id`,
      [invitationId, access.institutionId, access.membership.role, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'A meghívó nem található vagy nem vonható vissza.' });
    await writeAudit({ institutionId: access.institutionId, userId: req.user.id, action: 'invitation.revoked', entityType: 'invitation', entityId: invitationId });
    res.status(204).end();
  } catch (error) {
    console.error('Meghívó visszavonási hiba:', error.message);
    res.status(500).json({ error: 'A meghívó visszavonása sikertelen.' });
  }
});

export default router;
