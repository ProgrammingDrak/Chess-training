/**
 * server.js — GTO Trainer API server
 *
 * In development: runs on PORT 3001, Vite dev server proxies /api here.
 * In production:  serves the built dist/ folder AND the /api routes.
 *
 * Start: node server.js
 * Env:   DATABASE_URL, SESSION_SECRET, PORT, NODE_ENV
 *
 * Safe without DATABASE_URL: falls back to in-memory sessions and returns
 * 503 on auth/profile endpoints so the frontend can degrade to localStorage.
 */

import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
let hasDb = Boolean(process.env.DATABASE_URL);

const BCRYPT_ROUNDS = 12;

// ── Schema init ───────────────────────────────────────────────────────────────

async function initSchema(pool) {
  const sql = readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[db] Schema initialized');
}

// Render (and most PaaS) terminate TLS at a proxy and forward as HTTP.
// Without this, Express sees req.protocol as 'http' and silently drops
// secure cookies. Required for express-session to issue Set-Cookie in prod.
if (isProd) app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

// Build session config — use PgSession when DATABASE_URL is present,
// otherwise fall back to the default MemoryStore (not suitable for prod scale,
// but safe for a deploy without Postgres provisioned yet).
let sessionStore = undefined; // undefined → Express MemoryStore
let pool = null;

if (hasDb) {
  try {
    const { default: pgPool } = await import('./db/pool.js');
    // Probe connectivity before wiring PgSession — a dead pool here would
    // cause every request to error on session store access.
    await pgPool.query('SELECT 1');
    const { default: connectPgSimple } = await import('connect-pg-simple');
    const PgSession = connectPgSimple(session);
    pool = pgPool;
    sessionStore = new PgSession({
      pool,
      tableName: 'sessions',
      createTableIfMissing: true,
    });
  } catch (err) {
    console.error('[server] Database unreachable — falling back to MemoryStore:', err.message);
    hasDb = false;
    pool = null;
  }
} else {
  console.warn('[server] DATABASE_URL not set — using MemoryStore for sessions, auth endpoints disabled');
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
    },
  })
);

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireDb(req, res, next) {
  if (!hasDb) {
    return res.status(503).json({ error: 'Database not configured — auth unavailable' });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// ── Auth routes ───────────────────────────────────────────────────────────────

app.post('/api/auth/register', requireDb, async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !/^[a-z0-9_-]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–30 lowercase characters: letters, numbers, hyphens, underscores',
      });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, hash]
    );
    const user = rows[0];

    req.session.userId = user.id;
    req.session.username = user.username;

    res.status(201).json({
      user: { id: user.id, username: user.username, createdAt: user.created_at },
    });
  } catch (err) {
    console.error('[auth] register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', requireDb, async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ user: { id: user.id, username: user.username, createdAt: user.created_at } });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: { id: req.session.userId, username: req.session.username } });
});

// ── Profile routes ────────────────────────────────────────────────────────────

app.get('/api/profiles', requireDb, requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM profiles WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.userId]
    );
    res.json({ profiles: rows });
  } catch (err) {
    console.error('[profiles] list error:', err);
    res.status(500).json({ error: 'Failed to load profiles' });
  }
});

app.post('/api/profiles', requireDb, requireAuth, async (req, res) => {
  try {
    const { name, type = 'poker', table_size, range_data, postflop_thresholds } = req.body ?? {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Profile name required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO profiles (user_id, name, type, table_size, range_data, postflop_thresholds)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.session.userId,
        name.trim(),
        type,
        table_size ?? null,
        range_data ?? null,
        postflop_thresholds ?? null,
      ]
    );
    res.status(201).json({ profile: rows[0] });
  } catch (err) {
    console.error('[profiles] create error:', err);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

app.put('/api/profiles/:id', requireDb, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, table_size, range_data, postflop_thresholds } = req.body ?? {};
    const { rows } = await pool.query(
      `UPDATE profiles SET
         name                = COALESCE($1, name),
         type                = COALESCE($2, type),
         table_size          = COALESCE($3, table_size),
         range_data          = COALESCE($4, range_data),
         postflop_thresholds = COALESCE($5, postflop_thresholds),
         updated_at          = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        name ?? null,
        type ?? null,
        table_size ?? null,
        range_data ?? null,
        postflop_thresholds ?? null,
        id,
        req.session.userId,
      ]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('[profiles] update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.delete('/api/profiles/:id', requireDb, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM profiles WHERE id = $1 AND user_id = $2',
      [id, req.session.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[profiles] delete error:', err);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  if (!hasDb) {
    return res.json({ ok: true, db: 'not configured' });
  }
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch {
    res.status(500).json({ ok: false, db: 'error' });
  }
});

// ── Serve frontend in production ──────────────────────────────────────────────

if (isProd) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  if (hasDb) {
    try {
      await initSchema(pool);
    } catch (err) {
      console.error('[db] Schema init failed — disabling DB features:', err.message);
      hasDb = false;
    }
  }

  app.listen(PORT, () => {
    console.log(`[server] Listening on :${PORT} (${isProd ? 'production' : 'development'})`);
    if (!hasDb) {
      console.warn('[server] Running without database — auth/profiles unavailable, frontend uses localStorage');
    }
  });
}

start();
