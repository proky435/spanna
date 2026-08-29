// server/index.js
// VizsgaMester backend — Express + PostgreSQL.
// Auth (register/login) + Sync (push/pull) végpontok.
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool, { initDB } from './db.js';
import { signToken, authMiddleware } from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: a frontend domain engedélyezve (dev + prod)
const allowedOrigins = [
  process.env.FRONTEND_URL,                    // prod URL (pl. https://vizsgamester.onrender.com)
  'http://localhost:5173',                     // Vite dev
  'http://localhost:4173',                     // Vite preview
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Ha nincs origin (pl. curl) vagy az allowed listán van → engedélyezzük
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS: nem engedélyezett origin: ' + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' })); // state JSON lehet nagy

// ----- Health check -----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'VizsgaMester API', time: new Date().toISOString() });
});

// ----- AUTH: Regisztráció -----
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email és jelszó kötelező.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A jelszó legalább 6 karakter legyen.' });
  }
  const emailNorm = email.trim().toLowerCase();
  try {
    // Ellenőrizzük, hogy létezik-e már
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Ez az email már regisztrálva van.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [emailNorm, hash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Register hiba:', err.message);
    res.status(500).json({ error: 'Szerver hiba regisztrációkor.' });
  }
});

// ----- AUTH: Bejelentkezés -----
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email és jelszó kötelező.' });
  }
  const emailNorm = email.trim().toLowerCase();
  try {
    const result = await pool.query('SELECT id, email, password FROM users WHERE email = $1', [emailNorm]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Hibás email vagy jelszó.' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Hibás email vagy jelszó.' });
    }
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Login hiba:', err.message);
    res.status(500).json({ error: 'Szerver hiba bejelentkezéskor.' });
  }
});

// ----- AUTH: Token ellenőrzése -----
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ----- SYNC: Állapot letöltése -----
app.get('/api/sync/pull', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT state, updated_at FROM user_state WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      // Még nincs mentett állapot — üres válasz
      return res.json({ state: null, updatedAt: null });
    }
    res.json({ state: result.rows[0].state, updatedAt: result.rows[0].updated_at });
  } catch (err) {
    console.error('Pull hiba:', err.message);
    res.status(500).json({ error: 'Szerver hiba letöltéskor.' });
  }
});

// ----- SYNC: Állapot feltöltése -----
app.post('/api/sync/push', authMiddleware, async (req, res) => {
  const { state, updatedAt } = req.body;
  if (!state) {
    return res.status(400).json({ error: 'state kötelező.' });
  }
  try {
    // Upsert: ha létezik, frissítjük; ha nem, beszúrjuk.
    // Last-write-wins: a kliens küldi az updatedAt-et, de a szerver is bejegyzést ír.
    const result = await pool.query(
      `INSERT INTO user_state (user_id, state, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET state = $2, updated_at = NOW()
       RETURNING updated_at`,
      [req.user.id, JSON.stringify(state)]
    );
    res.json({ updatedAt: result.rows[0].updated_at });
  } catch (err) {
    console.error('Push hiba:', err.message);
    res.status(500).json({ error: 'Szerver hiba feltöltéskor.' });
  }
});

// ----- Szerver indítás -----
async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`VizsgaMester API fut a ${PORT}-es porton.`);
    });
  } catch (err) {
    console.error('Nem sikerült elindítani a szervert:', err.message);
    process.exit(1);
  }
}

start();
