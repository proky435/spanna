// server/db.js
// PostgreSQL kapcsolat + sémák inicializálása.
import { Pool } from 'pg';
import dotenv from 'dotenv';

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
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_state (
        user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        state       JSONB NOT NULL,
        updated_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('DB séma inicializálva.');
  } finally {
    client.release();
  }
}

export default pool;
