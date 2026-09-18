// server/auth.js
// Auth middleware: JWT token ellenőrzése.
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const JWT_ISSUER = 'vizsgamester-api';
const JWT_AUDIENCE = 'vizsgamester-web';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('A JWT_SECRET környezeti változó legalább 32 karakteres legyen.');
}

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    subject: String(user.id),
  });
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nincs auth token.' });
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch {
    return res.status(401).json({ error: 'Érvénytelen vagy lejárt token.' });
  }
  try {
    const userId = Number(payload.sub);
    const result = await pool.query(
      'SELECT id, email, is_platform_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'A felhasználói fiók nem aktív.' });
    req.user = { id: user.id, email: user.email, isPlatformAdmin: user.is_platform_admin };
    next();
  } catch (error) {
    next(error);
  }
}
