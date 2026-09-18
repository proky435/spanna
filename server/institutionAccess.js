import pool from './db.js';

export function parseNumericId(value) {
  return /^\d+$/.test(String(value)) ? String(value) : null;
}

export async function getInstitutionMembership(institutionId, userId, db = pool) {
  const result = await db.query(
    `SELECT im.*, i.name AS institution_name, i.slug AS institution_slug
     FROM institution_memberships im
     JOIN institutions i ON i.id = im.institution_id
     WHERE im.institution_id = $1 AND im.user_id = $2
       AND im.status = 'active' AND i.archived_at IS NULL`,
    [institutionId, userId]
  );
  return result.rows[0] || null;
}

export function hasInstitutionRole(membership, roles) {
  return Boolean(membership && roles.includes(membership.role));
}

export async function writeAudit({ institutionId = null, userId, action, entityType, entityId = null, metadata = {} }, db = pool) {
  await db.query(
    `INSERT INTO audit_logs (institution_id, actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [institutionId, userId, action, entityType, entityId == null ? null : String(entityId), JSON.stringify(metadata)]
  );
}

export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
