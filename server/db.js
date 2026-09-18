// server/db.js
// PostgreSQL kapcsolat + sémák inicializálása.
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { runMigrations } from './migrate.js';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render belső DB URL-je gyakran postgres:// (SSL kell hozzá)
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('DB pool váratlan hiba:', err.message);
});

// Sémák inicializálása (idempotens — biztonságosan futtatható minden indításkor)
export async function initDB() {
  const client = await pool.connect();
  try {
    await runMigrations(client);
    console.log('DB séma inicializálva.');
  } finally {
    client.release();
  }
}

export default pool;
