// server/index.js
// VizsgaMester backend — Express + PostgreSQL.
// Auth (register/login) + Sync (push/pull) végpontok.
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pool, { initDB } from './db.js';
import { signToken, authMiddleware } from './auth.js';
import { loginSchema, registerSchema, syncPushSchema, validateBody } from './validation.js';
import questionBanksRouter from './routes/questionBanks.js';
import institutionsRouter from './routes/institutions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Túl sok bejelentkezési próbálkozás. Próbáld újra később.' },
});

// CORS: a frontend domain engedélyezve (dev + prod)
const allowedOrigins = [
  process.env.FRONTEND_URL,                    // prod URL (spanna.onrender.com)
  'http://localhost:5173',                     // Vite dev
  'http://localhost:4173',                     // Vite preview
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
].filter(Boolean);

if (isProduction && !process.env.FRONTEND_URL) {
  throw new Error('A FRONTEND_URL környezeti változó production környezetben kötelező.');
}

app.use(cors({
  origin: (origin, cb) => {
    // Ha nincs origin (pl. curl) vagy az allowed listán van → engedélyezzük
    // Dev módban minden origin engedélyezve (Vite --host miatt LAN IP-k is jöhetnek)
    if (!origin || !isProduction || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS: nem engedélyezett origin: ' + origin));
  },
  credentials: false,
}));
app.use(express.json({ limit: '8mb' })); // state JSON lehet nagy

// ----- Health check -----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'VizsgaMester API', time: new Date().toISOString() });
});

// ----- AUTH: Regisztráció -----
app.post('/api/auth/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  const { email, password } = req.body;
  const emailNorm = email.toLowerCase();
  try {
    // Ellenőrizzük, hogy létezik-e már
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Ez az email már regisztrálva van.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, is_platform_admin',
      [emailNorm, hash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email, isPlatformAdmin: user.is_platform_admin } });
  } catch (err) {
    console.error('Register hiba:', err.message);
    res.status(500).json({ error: 'Szerver hiba regisztrációkor.' });
  }
});

// ----- AUTH: Bejelentkezés -----
app.post('/api/auth/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const emailNorm = email.toLowerCase();
  try {
    const result = await pool.query('SELECT id, email, password, is_platform_admin FROM users WHERE email = $1 AND deleted_at IS NULL', [emailNorm]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Hibás email vagy jelszó.' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Hibás email vagy jelszó.' });
    }
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, isPlatformAdmin: user.is_platform_admin } });
  } catch (err) {
    console.error('Login hiba:', err.message);
    res.status(500).json({ error: 'Szerver hiba bejelentkezéskor.' });
  }
});

// ----- AUTH: Token ellenőrzése -----
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.use('/api/question-banks', questionBanksRouter);
app.use('/api/institutions', institutionsRouter);

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
app.post('/api/sync/push', authMiddleware, validateBody(syncPushSchema), async (req, res) => {
  const { state } = req.body;
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

app.use((req, res) => {
  res.status(404).json({ error: 'A végpont nem található.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'A fájl legfeljebb 5 MB lehet.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'A kérés túl nagy.' });
  console.error('Kezeletlen szerverhiba:', error.message);
  res.status(500).json({ error: 'Váratlan szerverhiba.' });
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
