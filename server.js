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
 *
 * Lazy reconnect: if the database is unreachable at boot (e.g. Supabase
 * paused), the server still starts.  `requireDb` re-probes Postgres on
 * demand with a short cache so endpoints recover automatically once the
 * database comes back — no manual restart needed.
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
const dbConfigured = Boolean(process.env.DATABASE_URL);
const skipSchemaInit = process.env.SKIP_SCHEMA_INIT === 'true';

const BCRYPT_ROUNDS = 12;
const USER_TIERS = new Set(['user', 'gold', 'platinum', 'diamond']);

function normalizeUserTier(tier) {
  return USER_TIERS.has(tier) ? tier : 'user';
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    tier: normalizeUserTier(user.membership_tier),
    createdAt: user.created_at,
  };
}

// ── Schema init ───────────────────────────────────────────────────────────────

async function initSchema(pool) {
  if (skipSchemaInit) {
    console.log('[db] Schema init skipped');
    return;
  }
  const sql = readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[db] Schema initialized');
}

// ── DB health tracking ────────────────────────────────────────────────────────
//
// The session store and route handlers share a single connection pool.  We
// track whether Postgres is reachable with a small in-memory cache:
//
//   - If healthy, reuse the result for HEALTHY_CACHE_MS to avoid hammering
//     the DB on every request.
//   - If unhealthy, retry every UNHEALTHY_RETRY_MS so endpoints come back
//     online quickly when the DB does.
//
// Schema init runs lazily on the first successful probe.

const HEALTHY_CACHE_MS  = 5000;
const UNHEALTHY_RETRY_MS = 2000;

let dbHealthy = false;
let lastHealthCheckAt = 0;
let schemaInitialized = false;

async function checkDbHealth(pool) {
  if (!dbConfigured || !pool) return false;
  const now = Date.now();
  const interval = dbHealthy ? HEALTHY_CACHE_MS : UNHEALTHY_RETRY_MS;
  if (now - lastHealthCheckAt < interval) return dbHealthy;
  lastHealthCheckAt = now;
  try {
    await pool.query('SELECT 1');
    if (!dbHealthy) console.log('[db] Connection restored');
    dbHealthy = true;
    if (!schemaInitialized) {
      try {
        await initSchema(pool);
        schemaInitialized = true;
      } catch (err) {
        console.error('[db] Schema init failed (will retry on next health check):', err.message);
      }
    }
    return true;
  } catch (err) {
    if (dbHealthy) console.warn('[db] Connection lost:', err.message);
    dbHealthy = false;
    return false;
  }
}

// Render (and most PaaS) terminate TLS at a proxy and forward as HTTP.
// Without this, Express sees req.protocol as 'http' and silently drops
// secure cookies. Required for express-session to issue Set-Cookie in prod.
if (isProd) app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

// Build session config — use PgSession when DATABASE_URL is present and
// reachable at boot, otherwise fall back to the default MemoryStore.
//
// The pool itself is always created when DATABASE_URL is set, so route
// handlers can recover when the DB comes back online without a server
// restart.  Sessions stay in MemoryStore for this process lifetime if the
// DB was down at boot — losing them on container restart is acceptable
// since the alternative is a fully failed boot.
let sessionStore = undefined; // undefined → Express MemoryStore
let pool = null;

if (dbConfigured) {
  try {
    const { default: pgPool } = await import('./db/pool.js');
    pool = pgPool;
    // Probe connectivity to decide whether to wire PgSession.  A dead pool
    // wired into the session store would cause every request to error.
    let bootHealthy = false;
    try {
      await pgPool.query('SELECT 1');
      bootHealthy = true;
    } catch (err) {
      console.warn('[server] Database unreachable at boot — sessions in MemoryStore, requireDb will retry:', err.message);
    }
    if (bootHealthy) {
      const { default: connectPgSimple } = await import('connect-pg-simple');
      const PgSession = connectPgSimple(session);
      sessionStore = new PgSession({
        pool,
        tableName: 'sessions',
        createTableIfMissing: true,
      });
      dbHealthy = true;
      lastHealthCheckAt = Date.now();
    }
  } catch (err) {
    console.error('[server] Failed to load pg pool — DB features disabled:', err.message);
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

async function requireDb(req, res, next) {
  if (!dbConfigured) {
    return res.status(503).json({ error: 'Database not configured — auth unavailable' });
  }
  const ok = await checkDbHealth(pool);
  if (!ok) {
    return res.status(503).json({ error: 'Database temporarily unavailable — try again in a moment' });
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
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, membership_tier, created_at',
      [username, hash]
    );
    const user = rows[0];

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.membershipTier = normalizeUserTier(user.membership_tier);

    res.status(201).json({
      user: serializeUser(user),
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
    req.session.membershipTier = normalizeUserTier(user.membership_tier);

    res.json({ user: serializeUser(user) });
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

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  if (dbConfigured && pool) {
    const ok = await checkDbHealth(pool);
    if (ok) {
      try {
        const { rows } = await pool.query(
          'SELECT membership_tier FROM users WHERE id = $1',
          [req.session.userId]
        );
        if (rows[0]) {
          req.session.membershipTier = normalizeUserTier(rows[0].membership_tier);
        }
      } catch (err) {
        console.warn('[auth] failed to refresh membership tier:', err.message);
      }
    }
  }
  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
      tier: normalizeUserTier(req.session.membershipTier),
    },
  });
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

// ── Live Sessions (in-person tracker) ─────────────────────────────────────────
//
// UPSERT semantics by client_id (UUID).  This lets the client write to
// localStorage immediately, queue a sync, and PUT whenever it has a
// connection — without races between offline devices.

app.get('/api/live-sessions', requireDb, requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM live_sessions WHERE user_id = $1 ORDER BY started_at DESC',
      [req.session.userId]
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error('[live-sessions] list error:', err);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

app.put('/api/live-sessions/:clientId', requireDb, requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { name, started_at, ended_at, table_size, data } = req.body ?? {};
    if (!started_at || !table_size || !data) {
      return res.status(400).json({ error: 'started_at, table_size and data are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO live_sessions (user_id, client_id, name, started_at, ended_at, table_size, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (client_id) DO UPDATE SET
         name       = EXCLUDED.name,
         ended_at   = EXCLUDED.ended_at,
         table_size = EXCLUDED.table_size,
         data       = EXCLUDED.data,
         updated_at = NOW()
       WHERE live_sessions.user_id = $1
       RETURNING *`,
      [req.session.userId, clientId, name ?? null, started_at, ended_at ?? null, table_size, data]
    );
    if (rows.length === 0) {
      // Either inserted-but-conflicted-on-another-user, or update matched 0
      // rows because client_id belongs to a different user.
      return res.status(403).json({ error: 'Session belongs to another user' });
    }
    res.json({ session: rows[0] });
  } catch (err) {
    console.error('[live-sessions] upsert error:', err);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

app.delete('/api/live-sessions/:clientId', requireDb, requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      'DELETE FROM live_sessions WHERE client_id = $1 AND user_id = $2',
      [clientId, req.session.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[live-sessions] delete error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

const COMMIT = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local';

app.get('/api/health', async (_req, res) => {
  const base = { ok: true, commit: COMMIT, trustProxy: app.get('trust proxy') || false };
  if (!dbConfigured) return res.json({ ...base, db: 'not configured' });
  const ok = await checkDbHealth(pool);
  res.json({ ...base, db: ok ? 'connected' : 'unreachable' });
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
  // Run schema init eagerly when the boot probe succeeded.  If the DB was
  // unreachable at boot, schema init is deferred to checkDbHealth() and runs
  // on the first successful re-probe.
  if (dbConfigured && dbHealthy) {
    try {
      await initSchema(pool);
      schemaInitialized = true;
    } catch (err) {
      console.error('[db] Schema init failed — will retry lazily:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`[server] Listening on :${PORT} (${isProd ? 'production' : 'development'})`);
    if (!dbConfigured) {
      console.warn('[server] Running without database — auth/profiles unavailable, frontend uses localStorage');
    } else if (!dbHealthy) {
      console.warn('[server] Database unreachable at boot — endpoints will recover automatically once it comes back');
    }
  });
}

start();
