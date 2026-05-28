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
import { createPublicKey, createVerify, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  appendLiveAction,
  actionSummary,
  blindSeatsForButton,
  createForcedBlindActions,
  firstPreflopActor,
  nextClockwise,
  nextGuidedActionState,
  totalPotBB,
  unfoldedSeats,
} from './src/utils/pokerGameplay.js';
import {
  asyncPokerQueuedActionNote,
  normalizeAsyncPokerQueuedAction,
  prepareAsyncPokerQueuedAction,
} from './src/utils/asyncPokerQueuedAction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const dbConfigured = Boolean(process.env.DATABASE_URL);
const skipSchemaInit = process.env.SKIP_SCHEMA_INIT === 'true';
const cloudflareAccessEnabled = process.env.CLOUDFLARE_ACCESS_ENABLED === 'true';
const cloudflareAccessTeamDomain = (process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? '').replace(/\/$/, '');
const cloudflareAccessAud = process.env.CLOUDFLARE_ACCESS_AUD ?? '';

const BCRYPT_ROUNDS = 12;
const USER_TIERS = new Set(['user', 'gold', 'platinum', 'diamond']);
const DEFAULT_USER_TIER = 'diamond';
const USER_ROLES = new Set(['user', 'admin']);
const MAX_PROMO_DURATION_DAYS = 3650;
const ASYNC_POKER_ACTIONS = new Set(['check', 'call', 'bet', 'raise', 'fold', 'pass']);
const ASYNC_POKER_STREETS = ['preflop', 'flop', 'turn', 'river'];
const ASYNC_POKER_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const ASYNC_POKER_SUITS = ['h', 'd', 'c', 's'];
const ASYNC_POKER_MIN_TURN_SECONDS = 5;
const ASYNC_POKER_MAX_TURN_SECONDS = 5 * 24 * 60 * 60;
const ASYNC_POKER_DEFAULT_STACK = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIER_RANK = {
  user: 0,
  gold: 1,
  platinum: 2,
  diamond: 3,
};

function parseEmailList(value) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

const ADMIN_EMAILS = parseEmailList(process.env.ADMIN_EMAILS);
const BUG_NOTIFICATION_EMAILS = parseEmailList(process.env.BUG_NOTIFICATION_EMAILS || process.env.ADMIN_EMAILS);
const WELCOME_FROM_EMAIL = process.env.WELCOME_FROM_EMAIL || process.env.NOTIFICATION_FROM_EMAIL;

function normalizeUserTier(tier) {
  return USER_TIERS.has(tier) ? tier : DEFAULT_USER_TIER;
}

function maxTier(a, b) {
  const left = normalizeUserTier(a);
  const right = normalizeUserTier(b);
  return TIER_RANK[right] > TIER_RANK[left] ? right : left;
}

function normalizeUserRole(role) {
  return USER_ROLES.has(role) ? role : 'user';
}

function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveUserRole(user) {
  return normalizeUserRole(user.role);
}

function normalizePromoCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

function isValidPromoCode(code) {
  return /^[A-Z0-9_-]{3,32}$/.test(code);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isPermanentPromo(promo) {
  return promo.expires_at === null
    && promo.max_redemptions === null
    && Number(promo.duration_days) === MAX_PROMO_DURATION_DAYS;
}

function serializePromoExpiresAt(value) {
  return value === Infinity ? null : value;
}

// ── Cloudflare Access auth ──────────────────────────────────────────────────

let cloudflareJwksCache = { expiresAt: 0, keys: [] };

function base64UrlToBuffer(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function base64UrlJson(value) {
  return JSON.parse(base64UrlToBuffer(value).toString('utf8'));
}

function getCloudflareAccessToken(req) {
  const assertion = req.get('cf-access-jwt-assertion');
  if (assertion) return assertion;
  const cookie = req.get('cookie') ?? '';
  const authCookie = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('CF_Authorization='));
  return authCookie ? decodeURIComponent(authCookie.slice('CF_Authorization='.length)) : null;
}

async function getCloudflareAccessKeys() {
  const now = Date.now();
  if (cloudflareJwksCache.keys.length > 0 && cloudflareJwksCache.expiresAt > now) {
    return cloudflareJwksCache.keys;
  }
  if (!cloudflareAccessTeamDomain) {
    throw new Error('CLOUDFLARE_ACCESS_TEAM_DOMAIN is required when Cloudflare Access auth is enabled');
  }

  const response = await fetch(`${cloudflareAccessTeamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new Error(`Failed to load Cloudflare Access certs: HTTP ${response.status}`);
  }
  const body = await response.json();
  cloudflareJwksCache = {
    expiresAt: now + 60 * 60 * 1000,
    keys: Array.isArray(body.keys) ? body.keys : [],
  };
  return cloudflareJwksCache.keys;
}

function verifyRs256JwtSignature(token, jwk) {
  const [headerSegment, payloadSegment, signatureSegment] = token.split('.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerSegment}.${payloadSegment}`);
  verifier.end();
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  return verifier.verify(publicKey, base64UrlToBuffer(signatureSegment));
}

async function verifyCloudflareAccessJwt(req) {
  if (!cloudflareAccessEnabled) return null;
  if (!cloudflareAccessTeamDomain || !cloudflareAccessAud) {
    throw new Error('CLOUDFLARE_ACCESS_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD are required when Cloudflare Access auth is enabled');
  }

  const token = getCloudflareAccessToken(req);
  if (!token) return null;
  const segments = token.split('.');
  if (segments.length !== 3) throw new Error('Invalid Cloudflare Access JWT');

  const header = base64UrlJson(segments[0]);
  const payload = base64UrlJson(segments[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Cloudflare Access JWT');

  const keys = await getCloudflareAccessKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk || !verifyRs256JwtSignature(token, jwk)) {
    throw new Error('Cloudflare Access JWT signature verification failed');
  }

  const now = Math.floor(Date.now() / 1000);
  const issuer = typeof payload.iss === 'string' ? payload.iss.replace(/\/$/, '') : '';
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (issuer !== cloudflareAccessTeamDomain) throw new Error('Cloudflare Access JWT issuer mismatch');
  if (!audiences.includes(cloudflareAccessAud)) {
    throw new Error('Cloudflare Access JWT audience mismatch');
  }
  if (payload.exp && payload.exp <= now) throw new Error('Cloudflare Access JWT expired');
  if (payload.nbf && payload.nbf > now) throw new Error('Cloudflare Access JWT not yet valid');
  if (payload.type && payload.type !== 'app') throw new Error('Cloudflare Access JWT is not an application token');

  const email = normalizeEmail(payload.email);
  if (!email || !isValidEmail(email)) throw new Error('Cloudflare Access JWT is missing a valid email');
  return { email, subject: payload.sub ?? null };
}

function usernameBaseFromEmail(email) {
  const localPart = email.split('@')[0] ?? 'user';
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (normalized || 'user').slice(0, 24);
}

async function findOrCreateCloudflareAccessUser(identity) {
  const email = identity.email;
  const role = ADMIN_EMAILS.has(email) ? 'admin' : 'user';
  const { rows: existing } = await pool.query(
    'SELECT id, username, email, role, membership_tier, created_at FROM users WHERE email = $1',
    [email]
  );
  if (existing[0]) {
    if (existing[0].role !== role && role === 'admin') {
      const { rows } = await pool.query(
        `UPDATE users SET role = 'admin'
         WHERE id = $1
         RETURNING id, username, email, role, membership_tier, created_at`,
        [existing[0].id]
      );
      return rows[0];
    }
    return existing[0];
  }

  const base = usernameBaseFromEmail(email);
  const hash = await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const username = `${base}${suffix}`.slice(0, 30);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, membership_tier)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, role, membership_tier, created_at`,
        [username, email, hash, role, DEFAULT_USER_TIER]
      );
      await sendWelcomeEmail(rows[0]);
      return rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('Failed to create a unique username for Cloudflare Access user');
}

async function setSessionUser(req, user) {
  const serialized = await serializeUser(user);
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.email = user.email ?? null;
  req.session.membershipTier = serialized.tier;
  req.session.role = resolveUserRole(user);
  return serialized;
}

async function authenticateCloudflareAccess(req) {
  const identity = await verifyCloudflareAccessJwt(req);
  if (!identity) return null;
  const user = await findOrCreateCloudflareAccessUser(identity);
  const serialized = await setSessionUser(req, user);
  await recordLoginEvent(req, user, 'cloudflare_access');
  return serialized;
}

async function getActivePromo(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT pc.code, pr.tier, pr.redeemed_at, pr.expires_at
     FROM promo_redemptions pr
     JOIN promo_codes pc ON pc.id = pr.promo_code_id
     WHERE pr.user_id = $1
       AND pr.expires_at > NOW()
     ORDER BY
       CASE pr.tier
         WHEN 'diamond' THEN 3
         WHEN 'platinum' THEN 2
         WHEN 'gold' THEN 1
         ELSE 0
       END DESC,
       pr.expires_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

async function serializeUser(user, db = pool) {
  const membershipTier = maxTier(normalizeUserTier(user.membership_tier), DEFAULT_USER_TIER);
  const activePromo = user.id ? await getActivePromo(user.id, db) : null;
  const effectiveTier = activePromo ? maxTier(membershipTier, activePromo.tier) : membershipTier;
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    tier: effectiveTier,
    membershipTier,
    activePromo: activePromo ? {
      code: activePromo.code,
      tier: normalizeUserTier(activePromo.tier),
      redeemedAt: activePromo.redeemed_at,
      expiresAt: serializePromoExpiresAt(activePromo.expires_at),
    } : null,
    role: resolveUserRole(user),
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

async function ensureAsyncPokerActionConstraint(pool) {
  const tableCheck = await pool.query("SELECT to_regclass('public.async_poker_actions') AS table_name");
  if (!tableCheck.rows[0]?.table_name) return;

  const { rows } = await pool.query(`
    SELECT pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'async_poker_actions'
      AND c.conname = 'async_poker_actions_action_check'
  `);
  const definition = rows[0]?.definition ?? '';
  if (definition.includes("'leave'")) return;

  await pool.query(`
    ALTER TABLE async_poker_actions
      DROP CONSTRAINT IF EXISTS async_poker_actions_action_check;

    ALTER TABLE async_poker_actions
      ADD CONSTRAINT async_poker_actions_action_check
      CHECK (action IN ('check', 'call', 'bet', 'raise', 'fold', 'pass', 'timeout', 'join', 'leave', 'start', 'end', 'ready_next', 'show'));
  `);
  console.log("[db] Async poker action constraint allows 'leave'");
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
        await ensureAsyncPokerActionConstraint(pool);
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

async function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
    return;
  }
  try {
    const user = await authenticateCloudflareAccess(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
  } catch (err) {
    console.warn('[auth] Cloudflare Access auth failed:', err.message);
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

async function requireAdmin(req, res, next) {
  if (normalizeUserRole(req.session.role) !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    if (normalizeUserRole(rows[0]?.role) !== 'admin') {
      req.session.role = 'user';
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.warn('[auth] admin role refresh failed:', err.message);
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
}

async function redeemPromoCode(userId, rawCode, db = pool) {
  const code = normalizePromoCode(rawCode);
  if (!isValidPromoCode(code)) {
    const err = new Error('Promo code must be 3–32 letters, numbers, hyphens, or underscores');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT pc.*,
            (SELECT COUNT(*)::int FROM promo_redemptions pr WHERE pr.promo_code_id = pc.id) AS redeemed_count
     FROM promo_codes pc
     WHERE pc.code = $1
     FOR UPDATE`,
    [code]
  );
  const promo = rows[0];
  if (!promo) {
    const err = new Error('Promo code not found');
    err.statusCode = 404;
    throw err;
  }
  if (!promo.active) {
    const err = new Error('Promo code is no longer active');
    err.statusCode = 400;
    throw err;
  }
  if (promo.expires_at && new Date(promo.expires_at) <= new Date()) {
    const err = new Error('Promo code has expired');
    err.statusCode = 400;
    throw err;
  }
  if (promo.max_redemptions !== null && promo.redeemed_count >= promo.max_redemptions) {
    const err = new Error('Promo code has reached its redemption limit');
    err.statusCode = 400;
    throw err;
  }

  const expiresAt = isPermanentPromo(promo) ? 'infinity' : addDays(new Date(), promo.duration_days);
  try {
    const { rows: redemptionRows } = await db.query(
      `INSERT INTO promo_redemptions (user_id, promo_code_id, tier, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING tier, redeemed_at, expires_at`,
      [userId, promo.id, normalizeUserTier(promo.tier), expiresAt]
    );
    return {
      code: promo.code,
      tier: normalizeUserTier(redemptionRows[0].tier),
      redeemedAt: redemptionRows[0].redeemed_at,
      expiresAt: serializePromoExpiresAt(redemptionRows[0].expires_at),
    };
  } catch (err) {
    if (err.code === '23505') {
      const duplicate = new Error('Promo code has already been used on this account');
      duplicate.statusCode = 400;
      throw duplicate;
    }
    throw err;
  }
}

// ── Feedback inbox schema ───────────────────────────────────────────────────

let feedbackSchemaReady = false;

async function ensureFeedbackSchema() {
  if (feedbackSchemaReady) return true;
  const { rows: existing } = await pool.query("SELECT to_regclass('public.feedback_messages') AS table_name");
  if (existing[0]?.table_name) {
    feedbackSchemaReady = true;
    return true;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_messages (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reporter_username VARCHAR(30),
        reporter_email    VARCHAR(254),
        contact_email     VARCHAR(254),
        message           TEXT NOT NULL,
        source            VARCHAR(200),
        path              VARCHAR(500),
        status            VARCHAR(20) NOT NULL DEFAULT 'new'
          CHECK (status IN ('new', 'read')),
        read_at           TIMESTAMPTZ,
        read_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_messages_status_created
        ON feedback_messages (status, created_at DESC)
    `);
    feedbackSchemaReady = true;
    return true;
  } catch (err) {
    if (err.code === '42501') {
      console.warn('[feedback] feedback_messages table is not available; run the latest migration to enable feedback storage');
      return false;
    }
    throw err;
  }
}

// ── Login event schema/audit ────────────────────────────────────────────────

let loginEventsSchemaReady = false;

async function ensureLoginEventsSchema() {
  if (loginEventsSchemaReady) return true;
  const { rows: existing } = await pool.query("SELECT to_regclass('public.login_events') AS table_name");
  if (existing[0]?.table_name) {
    loginEventsSchemaReady = true;
    return true;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_events (
        id          BIGSERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username    VARCHAR(30),
        email       VARCHAR(254),
        method      VARCHAR(40) NOT NULL DEFAULT 'password',
        ip_address  TEXT,
        country     VARCHAR(120),
        user_agent  TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_login_events_created
        ON login_events (created_at DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_login_events_user_created
        ON login_events (user_id, created_at DESC)
    `);
    loginEventsSchemaReady = true;
    return true;
  } catch (err) {
    if (err.code === '42501') {
      console.warn('[auth] login_events table is not available; run the latest migration to enable login audit capture');
      return false;
    }
    throw err;
  }
}

function firstHeaderValue(value) {
  if (!value) return null;
  return String(value).split(',')[0]?.trim() || null;
}

function getRequestIp(req) {
  return firstHeaderValue(req.get('cf-connecting-ip'))
    ?? firstHeaderValue(req.get('x-forwarded-for'))
    ?? req.ip
    ?? req.socket?.remoteAddress
    ?? null;
}

function getRequestCountry(req) {
  return firstHeaderValue(req.get('cf-ipcountry'))
    ?? firstHeaderValue(req.get('x-vercel-ip-country'))
    ?? firstHeaderValue(req.get('x-country-code'));
}

async function recordLoginEvent(req, user, method) {
  try {
    if (!dbConfigured || !pool || !user?.id) return;
    const available = await ensureLoginEventsSchema();
    if (!available) return;
    await pool.query(
      `INSERT INTO login_events (user_id, username, email, method, ip_address, country, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        user.username ?? null,
        user.email ?? null,
        method,
        getRequestIp(req),
        getRequestCountry(req),
        req.get('user-agent') ?? null,
      ]
    );
  } catch (err) {
    console.warn('[auth] failed to record login event:', err.message);
  }
}

// ── Admin notifications ─────────────────────────────────────────────────────

function notificationRecipients() {
  return [...BUG_NOTIFICATION_EMAILS];
}

function adminEmailRecipients() {
  return [...ADMIN_EMAILS];
}

function trimText(value, maxLength = 5000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

async function sendNotificationEmail(subject, text, recipients, label = 'admin-notify') {
  if (recipients.length === 0) {
    console.warn(`[${label}] no recipients configured`);
    return { sent: false, reason: 'no_recipients' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn(`[${label}] ${subject}\nRecipients: ${recipients.join(', ')}\n${text}`);
    return { sent: false, reason: 'email_provider_not_configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Resend failed with HTTP ${response.status}: ${details}`);
  }

  return { sent: true };
}

async function notifyAdmins(subject, text) {
  return sendNotificationEmail(subject, text, notificationRecipients());
}

async function notifyAdminEmails(subject, text) {
  return sendNotificationEmail(subject, text, adminEmailRecipients(), 'feedback-notify');
}

async function sendEmail({ to, subject, text, html }) {
  const recipients = Array.isArray(to) ? to : [to];
  const cleanRecipients = recipients.map(normalizeEmail).filter(Boolean);
  if (cleanRecipients.length === 0) {
    return { sent: false, reason: 'no_recipients' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !WELCOME_FROM_EMAIL) {
    console.warn(`[email] ${subject}\nRecipients: ${cleanRecipients.join(', ')}\n${text}`);
    return { sent: false, reason: 'email_provider_not_configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: WELCOME_FROM_EMAIL,
      to: cleanRecipients,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Resend failed with HTTP ${response.status}: ${details}`);
  }

  return { sent: true };
}

async function sendWelcomeEmail(user) {
  const email = normalizeEmail(user.email);
  if (!email) return { sent: false, reason: 'no_email' };
  const username = user.username;
  try {
    return await sendEmail({
      to: email,
      subject: 'Welcome to GTO Training',
      text: [
        `Thanks for signing up for GTO Training, ${username}!`,
        '',
        `Your username is: ${username}`,
        '',
        'You can use your account to save progress and access the training tools.',
      ].join('\n'),
      html: [
        `<p>Thanks for signing up for GTO Training, <strong>${username}</strong>!</p>`,
        `<p>Your username is: <strong>${username}</strong></p>`,
        '<p>You can use your account to save progress and access the training tools.</p>',
      ].join(''),
    });
  } catch (err) {
    console.warn('[email] welcome email failed:', err.message);
    return { sent: false, reason: 'send_failed' };
  }
}

// ── Async poker notifications ───────────────────────────────────────────────

function normalizeDiscordUserId(value) {
  if (typeof value !== 'string') return null;
  const digits = value.trim().replace(/[<@!>]/g, '');
  return /^\d{5,30}$/.test(digits) ? digits : null;
}

function normalizeTurnSeconds(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) return 24 * 60 * 60;
  return Math.min(ASYNC_POKER_MAX_TURN_SECONDS, Math.max(ASYNC_POKER_MIN_TURN_SECONDS, parsed));
}

function isValidUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function normalizeTableSize(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) return 6;
  return Math.min(9, Math.max(2, parsed));
}

function serializeNotificationPreference(row) {
  const source = row ?? {};
  return {
    emailTurnNotifications: Boolean(source.email_turn_notifications),
    discordTurnNotifications: Boolean(source.discord_turn_notifications),
    discordUserId: source.discord_user_id ?? '',
    discordConfigured: Boolean(process.env.DISCORD_TURN_WEBHOOK_URL),
  };
}

function isNotificationStorageUnavailable(err) {
  return err?.code === '42501' || err?.code === '42P01';
}

let notificationStorageDisabled = false;

function disableNotificationStorage(err, context) {
  notificationStorageDisabled = true;
  console.warn(`[notifications] ${context}:`, err.message);
}

async function getNotificationPreference(userId, db = pool) {
  if (notificationStorageDisabled) return null;
  try {
    await db.query(
      `INSERT INTO notification_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const { rows } = await db.query(
      `SELECT email_turn_notifications, discord_turn_notifications, discord_user_id
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );
    return rows[0];
  } catch (err) {
    if (isNotificationStorageUnavailable(err)) {
      disableNotificationStorage(err, 'preference storage unavailable');
      return null;
    }
    throw err;
  }
}

async function createInAppNotification(db, { userId, type, title, body, actionPath = null, metadata = {} }) {
  if (notificationStorageDisabled) return;
  try {
    await db.query(
      `INSERT INTO in_app_notifications (user_id, type, title, body, action_path, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, title, body, actionPath, metadata]
    );
  } catch (err) {
    if (isNotificationStorageUnavailable(err)) {
      disableNotificationStorage(err, 'in-app storage unavailable');
      return;
    }
    throw err;
  }
}

async function sendDiscordTurnMessage(discordUserId, game) {
  const webhookUrl = process.env.DISCORD_TURN_WEBHOOK_URL;
  if (!webhookUrl || !discordUserId) {
    return { sent: false, reason: webhookUrl ? 'no_discord_user_id' : 'discord_webhook_not_configured' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `<@${discordUserId}> your turn is up in ${game.name}. Turn timer: ${formatTurnDuration(game.turn_seconds)}.`,
      allowed_mentions: { users: [discordUserId] },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Discord webhook failed with HTTP ${response.status}: ${details}`);
  }
  return { sent: true };
}

function formatTurnDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function notificationTurnStartedSql() {
  return "to_char(g.current_turn_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";
}

async function markAsyncPokerTurnNotificationsRead(db, { gameId, userId, turnStartedAt = null }) {
  if (notificationStorageDisabled) return;
  try {
    await db.query(
      `UPDATE in_app_notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1
         AND type IN ('async_poker_turn', 'async_poker_turn_reminder')
         AND read_at IS NULL
         AND metadata->>'asyncPokerGameId' = $2
         AND ($3::text IS NULL OR metadata->>'turnStartedAt' = $3)`,
      [userId, String(gameId), turnStartedAt]
    );
  } catch (err) {
    if (isNotificationStorageUnavailable(err)) {
      disableNotificationStorage(err, 'mark read skipped');
      return;
    }
    throw err;
  }
}

async function notifyAsyncPokerTurn(db, gameId, userId, options = {}) {
  if (notificationStorageDisabled) return;
  const { rows } = await db.query(
    `SELECT g.id, g.name, g.turn_seconds, g.current_turn_started_at, g.current_turn_expires_at,
            u.id AS user_id, u.username, u.email,
            (npc.user_id IS NOT NULL) AS is_npc,
            COALESCE(np.email_turn_notifications, false) AS email_turn_notifications,
            COALESCE(np.discord_turn_notifications, false) AS discord_turn_notifications,
            np.discord_user_id
     FROM async_poker_games g
     JOIN users u ON u.id = $2
     LEFT JOIN async_poker_npc_users npc ON npc.user_id = u.id
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE g.id = $1`,
    [gameId, userId]
  );
  const row = rows[0];
  if (!row) return;
  if (row.is_npc) return;

  await markAsyncPokerTurnNotificationsRead(db, { gameId, userId });

  const isReminder = options.reminder === true;
  const type = isReminder ? 'async_poker_turn_reminder' : 'async_poker_turn';
  const metadata = {
    asyncPokerGameId: String(gameId),
    turnStartedAt: row.current_turn_started_at ? new Date(row.current_turn_started_at).toISOString() : null,
    turnExpiresAt: row.current_turn_expires_at ? new Date(row.current_turn_expires_at).toISOString() : null,
    reminder: isReminder,
  };
  const body = isReminder
    ? `Still your turn in ${row.name}. About 10 minutes left to act.`
    : `It is your turn in ${row.name}. You have ${formatTurnDuration(row.turn_seconds)} to act.`;
  await createInAppNotification(db, {
    userId,
    type,
    title: isReminder ? 'Poker turn ending soon' : 'Your poker turn',
    body,
    actionPath: `poker_async?asyncPokerGame=${gameId}`,
    metadata,
  });

  if (row.email_turn_notifications && row.email) {
    try {
      await sendEmail({
        to: row.email,
        subject: `[GTO Training] Your turn in ${row.name}`,
        text: [
          `Hi ${row.username},`,
          '',
          body,
          '',
          isReminder
            ? 'Open GTO Training and go to Async Poker before the turn expires.'
            : 'Open GTO Training and go to Async Poker to act.',
        ].join('\n'),
      });
    } catch (err) {
      console.warn('[async-poker] turn email failed:', err.message);
    }
  }

  const discordUserId = normalizeDiscordUserId(row.discord_user_id);
  if (row.discord_turn_notifications && discordUserId) {
    try {
      await sendDiscordTurnMessage(discordUserId, row);
    } catch (err) {
      console.warn('[async-poker] discord notification failed:', err.message);
    }
  }
}

async function refreshAsyncPokerTurnReminders(userId, db = pool) {
  if (notificationStorageDisabled) return;
  const turnStartedSql = notificationTurnStartedSql();
  let rows = [];
  try {
    const result = await db.query(
      `SELECT g.id
       FROM async_poker_games g
       WHERE g.status = 'active'
         AND g.current_player_user_id = $1
         AND g.current_turn_expires_at IS NOT NULL
         AND g.current_turn_expires_at > NOW()
         AND g.current_turn_expires_at <= NOW() + INTERVAL '10 minutes'
         AND NOT EXISTS (
           SELECT 1
           FROM in_app_notifications n
           WHERE n.user_id = $1
             AND n.type = 'async_poker_turn_reminder'
             AND n.metadata->>'asyncPokerGameId' = g.id::text
             AND n.metadata->>'turnStartedAt' = ${turnStartedSql}
         )`,
      [userId]
    );
    rows = result.rows;
  } catch (err) {
    if (isNotificationStorageUnavailable(err)) {
      disableNotificationStorage(err, 'turn reminders skipped');
      return;
    }
    throw err;
  }

  for (const row of rows) {
    await notifyAsyncPokerTurn(db, row.id, userId, { reminder: true });
  }
}

async function clearStaleAsyncPokerTurnNotifications(userId, db = pool) {
  if (notificationStorageDisabled) return;
  const turnStartedSql = notificationTurnStartedSql();
  try {
    await db.query(
      `UPDATE in_app_notifications n
       SET read_at = COALESCE(n.read_at, NOW())
       WHERE n.user_id = $1
         AND n.read_at IS NULL
         AND n.type IN ('async_poker_turn', 'async_poker_turn_reminder')
         AND NOT EXISTS (
           SELECT 1
           FROM async_poker_games g
           WHERE g.id::text = n.metadata->>'asyncPokerGameId'
             AND g.status = 'active'
             AND g.current_player_user_id = n.user_id
             AND (
               n.metadata->>'turnStartedAt' IS NULL
               OR n.metadata->>'turnStartedAt' = ${turnStartedSql}
             )
         )`,
      [userId]
    );
  } catch (err) {
    if (isNotificationStorageUnavailable(err)) {
      disableNotificationStorage(err, 'stale turn cleanup skipped');
      return;
    }
    throw err;
  }
}

async function listUnreadInAppNotifications(userId, db = pool) {
  if (notificationStorageDisabled) return [];
  try {
    const { rows } = await db.query(
      `SELECT id, type, title, body, action_path, metadata, read_at, created_at
       FROM in_app_notifications
       WHERE user_id = $1
         AND read_at IS NULL
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    return rows;
  } catch (err) {
    if (isNotificationStorageUnavailable(err)) {
      disableNotificationStorage(err, 'unread list skipped');
      return [];
    }
    throw err;
  }
}

function normalizeAsyncPokerHandState(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const street = [...ASYNC_POKER_STREETS, 'showdown'].includes(source.street) ? source.street : 'preflop';
  const streetActions = source.streetActions && typeof source.streetActions === 'object' && !Array.isArray(source.streetActions)
    ? source.streetActions
    : {};
  const pendingActions = source.pendingActions && typeof source.pendingActions === 'object' && !Array.isArray(source.pendingActions)
    ? source.pendingActions
    : {};
  const holeCards = source.holeCards && typeof source.holeCards === 'object' && !Array.isArray(source.holeCards)
    ? source.holeCards
    : {};

  return {
    ...source,
    street,
    deck: Array.isArray(source.deck) ? source.deck : [],
    board: Array.isArray(source.board) ? source.board : [],
    actions: Array.isArray(source.actions) ? source.actions : [],
    previousHandResult: source.previousHandResult && typeof source.previousHandResult === 'object' && !Array.isArray(source.previousHandResult)
      ? source.previousHandResult
      : null,
    holeCards,
    dealtUserIds: Array.isArray(source.dealtUserIds)
      ? source.dealtUserIds
      : Object.keys(holeCards).map((userId) => Number(userId)).filter(Number.isFinite),
    pendingActions,
    foldedUserIds: Array.isArray(source.foldedUserIds) ? source.foldedUserIds : [],
    streetActions: Object.fromEntries(
      ASYNC_POKER_STREETS.map((name) => [
        name,
        Array.isArray(streetActions[name]) ? streetActions[name] : [],
      ])
    ),
    winnerUserIds: Array.isArray(source.winnerUserIds) ? source.winnerUserIds : [],
    shownUserIds: Array.isArray(source.shownUserIds) ? source.shownUserIds : [],
    nextHandReadyUserIds: Array.isArray(source.nextHandReadyUserIds) ? source.nextHandReadyUserIds : [],
    pendingBigBlindUserIds: Array.isArray(source.pendingBigBlindUserIds) ? source.pendingBigBlindUserIds : [],
    pendingLeaveUserIds: Array.isArray(source.pendingLeaveUserIds) ? source.pendingLeaveUserIds : [],
  };
}

function sanitizeAsyncPokerState(state, viewerUserId, extraVisibleUserIds = []) {
  const normalized = normalizeAsyncPokerHandState(state);
  const { deck, holeCards, pendingActions, pendingLeaveUserIds, ...safeState } = normalized;
  const viewerKey = String(viewerUserId);
  const visibleUserIds = new Set([
    ...(normalized.shownUserIds ?? []).map(String),
    ...extraVisibleUserIds.map(String),
  ]);
  const visibleHoleCards = {};

  if (Array.isArray(holeCards[viewerKey])) {
    visibleHoleCards[viewerKey] = holeCards[viewerKey];
  }
  for (const [userId, cards] of Object.entries(holeCards)) {
    if (visibleUserIds.has(String(userId)) && Array.isArray(cards)) visibleHoleCards[userId] = cards;
  }

  return {
    ...safeState,
    holeCards: visibleHoleCards,
    pendingActions: Object.fromEntries(
      [viewerKey, ...extraVisibleUserIds.map(String)]
        .filter((userId) => pendingActions?.[userId])
        .map((userId) => [userId, pendingActions[userId]])
    ),
  };
}

function createAsyncPokerDeck() {
  return ASYNC_POKER_RANKS.flatMap((rank) => ASYNC_POKER_SUITS.map((suit) => ({ rank, suit })));
}

function shuffleAsyncPokerDeck(deck) {
  const cards = [...deck];
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
}

function createAsyncPokerHandState(players, {
  tableSize,
  buttonSeat,
  smallBlindChips,
  bigBlindChips,
  pendingBigBlindUserIds = [],
}) {
  const deck = shuffleAsyncPokerDeck(createAsyncPokerDeck());
  const sortedPlayers = [...players].sort((a, b) => a.seat_index - b.seat_index);
  const holeCards = {};
  const seatedPlayers = sortedPlayers.map((player) => player.seat_index);
  const effectiveButtonSeat = buttonSeat ?? seatedPlayers[0] ?? null;
  const { smallBlindSeat, bigBlindSeat } = blindSeatsForButton({
    buttonSeat: effectiveButtonSeat,
    seatedPlayers,
    tableSize,
  });
  const playerIdBySeat = new Map(sortedPlayers.map((player) => [player.seat_index, String(player.user_id)]));
  let actions = createForcedBlindActions({
    baseActions: [],
    smallBlindSeat,
    bigBlindSeat,
    smallBlind: smallBlindChips,
    bigBlind: bigBlindChips,
    currency: '',
    playerIdBySeat,
  });
  const pendingBigBlindUserIdSet = new Set(pendingBigBlindUserIds.map(Number));
  for (const player of sortedPlayers) {
    if (!pendingBigBlindUserIdSet.has(Number(player.user_id))) continue;
    const existingBlindChips = (
      (player.seat_index === smallBlindSeat ? smallBlindChips : 0)
      + (player.seat_index === bigBlindSeat ? bigBlindChips : 0)
    );
    const postedBlindChips = Math.max(0, bigBlindChips - existingBlindChips);
    if (postedBlindChips <= 0 || bigBlindChips <= 0) continue;
    actions = appendLiveAction({
      actions,
      street: 'preflop',
      seatId: player.seat_index,
      playerProfileId: String(player.user_id),
      action: 'post-blind',
      amount: postedBlindChips,
      amountBB: postedBlindChips / bigBlindChips,
    });
  }

  for (let round = 0; round < 2; round += 1) {
    for (const player of sortedPlayers) {
      const key = String(player.user_id);
      holeCards[key] = holeCards[key] ?? [];
      holeCards[key].push(deck.pop());
    }
  }

  return {
    street: 'preflop',
    deck,
    board: [],
    actions,
    buttonSeat: effectiveButtonSeat,
    smallBlindSeat,
    bigBlindSeat,
    holeCards,
    foldedUserIds: [],
    dealtUserIds: sortedPlayers.map((player) => player.user_id),
    shownUserIds: [],
    nextHandReadyUserIds: [],
    pendingBigBlindUserIds: [],
    pendingActions: {},
    streetActions: {
      preflop: [],
      flop: [],
      turn: [],
      river: [],
    },
    winnerUserIds: [],
    resolvedAt: null,
  };
}

function createPreviousAsyncPokerHandResult(state, handNumber, potChips = null) {
  const shownUserIds = new Set((state.shownUserIds ?? []).map(Number));
  const visibleHoleCards = {};
  for (const userId of shownUserIds) {
    const cards = state.holeCards?.[String(userId)];
    if (Array.isArray(cards)) visibleHoleCards[String(userId)] = cards;
  }

  return {
    handNumber,
    resolvedAt: state.resolvedAt,
    resolutionReason: state.resolutionReason,
    board: state.board ?? [],
    actions: state.actions ?? [],
    potChips,
    winnerUserIds: state.winnerUserIds ?? [],
    winnerUserId: state.winnerUserId ?? null,
    showdown: state.showdown ?? {},
    shownUserIds: [...shownUserIds],
    holeCards: visibleHoleCards,
  };
}

function withoutPendingAsyncPokerAction(state, userId) {
  const pendingActions = { ...(state.pendingActions ?? {}) };
  delete pendingActions[String(userId)];
  return { ...state, pendingActions };
}

function withoutWaitingAsyncPokerUser(state, userId) {
  const id = Number(userId);
  return {
    ...withoutPendingAsyncPokerAction(state, id),
    nextHandReadyUserIds: (state.nextHandReadyUserIds ?? []).map(Number).filter((value) => value !== id),
    pendingBigBlindUserIds: (state.pendingBigBlindUserIds ?? []).map(Number).filter((value) => value !== id),
    pendingLeaveUserIds: (state.pendingLeaveUserIds ?? []).map(Number).filter((value) => value !== id),
  };
}

function hasPendingAsyncPokerFold(state, userId) {
  return state.pendingActions?.[String(userId)]?.action === 'fold';
}

function withPendingAsyncPokerLeave(state, userId) {
  const id = Number(userId);
  const pendingLeaveUserIds = new Set((state.pendingLeaveUserIds ?? []).map(Number));
  pendingLeaveUserIds.add(id);
  return {
    ...state,
    pendingLeaveUserIds: [...pendingLeaveUserIds],
  };
}

function withoutPendingAsyncPokerLeave(state, userId) {
  const id = Number(userId);
  return {
    ...state,
    pendingLeaveUserIds: (state.pendingLeaveUserIds ?? []).map(Number).filter((value) => value !== id),
  };
}

function isAsyncPokerPlayerInCurrentHand(player, state) {
  const cards = state.holeCards?.[String(player?.user_id)];
  return player?.status === 'active' && Array.isArray(cards) && cards.length > 0;
}

async function dealAsyncPokerHand(db, {
  gameId,
  game,
  players,
  buttonSeat,
  handNumberIncrement = 0,
}) {
  const previousState = normalizeAsyncPokerHandState(game.state);
  const pendingBigBlindUserIds = previousState.pendingBigBlindUserIds ?? [];
  const handState = createAsyncPokerHandState(players, {
    tableSize: game.table_size,
    buttonSeat,
    smallBlindChips: game.small_blind_chips,
    bigBlindChips: game.big_blind_chips,
    pendingBigBlindUserIds,
  });
  const seatedPlayers = players.map((player) => player.seat_index).sort((a, b) => a - b);
  const firstPlayerSeat = firstPreflopActor({
    seatedPlayers,
    tableSize: game.table_size,
    bigBlindSeat: handState.bigBlindSeat,
  });
  const firstPlayerId = players.find((player) => player.seat_index === firstPlayerSeat)?.user_id
    ?? players[0]?.user_id
    ?? null;

  if (handState.smallBlindSeat !== null) {
    const smallBlindPlayer = players.find((player) => player.seat_index === handState.smallBlindSeat);
    if (smallBlindPlayer) {
      await db.query(
        `UPDATE async_poker_game_players
         SET stack_chips = GREATEST(stack_chips - $3, 0)
         WHERE game_id = $1 AND user_id = $2`,
        [gameId, smallBlindPlayer.user_id, game.small_blind_chips]
      );
    }
  }
  if (handState.bigBlindSeat !== null) {
    const bigBlindPlayer = players.find((player) => player.seat_index === handState.bigBlindSeat);
    if (bigBlindPlayer) {
      await db.query(
        `UPDATE async_poker_game_players
         SET stack_chips = GREATEST(stack_chips - $3, 0)
         WHERE game_id = $1 AND user_id = $2`,
        [gameId, bigBlindPlayer.user_id, game.big_blind_chips]
      );
    }
  }
  const pendingBigBlindUserIdSet = new Set(pendingBigBlindUserIds.map(Number));
  for (const player of players) {
    if (!pendingBigBlindUserIdSet.has(Number(player.user_id))) continue;
    const existingBlindChips = (
      (player.seat_index === handState.smallBlindSeat ? game.small_blind_chips : 0)
      + (player.seat_index === handState.bigBlindSeat ? game.big_blind_chips : 0)
    );
    const postedBlindChips = Math.max(0, game.big_blind_chips - existingBlindChips);
    if (postedBlindChips <= 0) continue;
    await db.query(
      `UPDATE async_poker_game_players
       SET stack_chips = GREATEST(stack_chips - $3, 0)
       WHERE game_id = $1 AND user_id = $2`,
      [gameId, player.user_id, postedBlindChips]
    );
  }

  const startingPotChips = Math.round(totalPotBB(handState.actions) * game.big_blind_chips);
  await db.query(
    `UPDATE async_poker_games
     SET status = 'active',
         current_player_user_id = $2,
         current_turn_started_at = NOW(),
         current_turn_expires_at = NOW() + ($3 || ' seconds')::interval,
         hand_number = hand_number + $6,
         state = $4,
         pot_chips = $5,
         updated_at = NOW()
     WHERE id = $1`,
    [gameId, firstPlayerId, game.turn_seconds, handState, startingPotChips, handNumberIncrement]
  );
  return { handState, firstPlayerId };
}

function activeAsyncPokerPlayers(players, state) {
  const folded = new Set((state.foldedUserIds ?? []).map(Number));
  return players
    .filter((player) => isAsyncPokerPlayerInCurrentHand(player, state) && !folded.has(Number(player.user_id)))
    .sort((a, b) => a.seat_index - b.seat_index);
}

function firstAsyncPokerActor(players, state) {
  return activeAsyncPokerPlayers(players, state)[0] ?? null;
}

function nextAsyncPokerActor(players, state, actorUserId) {
  const activePlayers = activeAsyncPokerPlayers(players, state);
  if (activePlayers.length === 0) return null;
  const actorSeat = players.find((player) => Number(player.user_id) === Number(actorUserId))?.seat_index
    ?? activePlayers[0].seat_index;
  return activePlayers.find((player) => player.seat_index > actorSeat) ?? activePlayers[0];
}

function isAsyncPokerStreetComplete(players, state) {
  const activePlayers = activeAsyncPokerPlayers(players, state);
  const acted = new Set((state.streetActions?.[state.street] ?? []).map(Number));
  return activePlayers.length > 0 && activePlayers.every((player) => acted.has(Number(player.user_id)));
}

function drawAsyncPokerCards(state, count) {
  const deck = [...state.deck];
  deck.pop();
  const cards = deck.splice(Math.max(0, deck.length - count), count);
  return { deck, cards };
}

const ASYNC_POKER_RANK_VALUE = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const ASYNC_POKER_HAND_LABELS = [
  'high card',
  'pair',
  'two pair',
  'three of a kind',
  'straight',
  'flush',
  'full house',
  'four of a kind',
  'straight flush',
];

function compareAsyncPokerScores(a, b) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function straightHighFromRanks(ranks) {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2)) {
    return 5;
  }
  for (let index = 0; index <= unique.length - 5; index += 1) {
    const slice = unique.slice(index, index + 5);
    if (slice[0] - slice[4] === 4) return slice[0];
  }
  return null;
}

function scoreFiveAsyncPokerCards(cards) {
  const ranks = cards.map((card) => ASYNC_POKER_RANK_VALUE[card.rank]).filter(Boolean).sort((a, b) => b - a);
  const flush = cards.every((card) => card.suit === cards[0]?.suit);
  const straightHigh = straightHighFromRanks(ranks);
  const counts = new Map();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (flush && straightHigh) return { score: [8, straightHigh], label: ASYNC_POKER_HAND_LABELS[8] };
  if (groups[0]?.count === 4) {
    return { score: [7, groups[0].rank, groups.find((group) => group.count === 1)?.rank ?? 0], label: ASYNC_POKER_HAND_LABELS[7] };
  }
  if (groups[0]?.count === 3 && groups[1]?.count === 2) {
    return { score: [6, groups[0].rank, groups[1].rank], label: ASYNC_POKER_HAND_LABELS[6] };
  }
  if (flush) return { score: [5, ...ranks], label: ASYNC_POKER_HAND_LABELS[5] };
  if (straightHigh) return { score: [4, straightHigh], label: ASYNC_POKER_HAND_LABELS[4] };
  if (groups[0]?.count === 3) {
    return {
      score: [3, groups[0].rank, ...groups.filter((group) => group.count === 1).map((group) => group.rank).slice(0, 2)],
      label: ASYNC_POKER_HAND_LABELS[3],
    };
  }
  if (groups[0]?.count === 2 && groups[1]?.count === 2) {
    return {
      score: [2, groups[0].rank, groups[1].rank, groups.find((group) => group.count === 1)?.rank ?? 0],
      label: ASYNC_POKER_HAND_LABELS[2],
    };
  }
  if (groups[0]?.count === 2) {
    return {
      score: [1, groups[0].rank, ...groups.filter((group) => group.count === 1).map((group) => group.rank).slice(0, 3)],
      label: ASYNC_POKER_HAND_LABELS[1],
    };
  }
  return { score: [0, ...ranks], label: ASYNC_POKER_HAND_LABELS[0] };
}

function evaluateAsyncPokerHand(cards) {
  let best = null;
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const score = scoreFiveAsyncPokerCards([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareAsyncPokerScores(score.score, best.score) > 0) best = score;
          }
        }
      }
    }
  }
  return best ?? { score: [0], label: ASYNC_POKER_HAND_LABELS[0] };
}

function resolveAsyncPokerHand(state, activePlayers, reason) {
  const shownUserIds = reason === 'showdown'
    ? activePlayers.map((player) => player.user_id)
    : [];
  if (activePlayers.length === 1) {
    return {
      ...state,
      street: 'showdown',
      winnerUserIds: [activePlayers[0].user_id],
      winnerUserId: activePlayers[0].user_id,
      shownUserIds,
      nextHandReadyUserIds: [],
      resolutionReason: reason,
      resolvedAt: new Date().toISOString(),
    };
  }

  const showdown = {};
  let bestScore = null;
  let winners = [];
  for (const player of activePlayers) {
    const cards = [
      ...(state.holeCards?.[String(player.user_id)] ?? []),
      ...(state.board ?? []),
    ];
    const result = evaluateAsyncPokerHand(cards);
    showdown[String(player.user_id)] = { label: result.label };
    const comparison = bestScore ? compareAsyncPokerScores(result.score, bestScore) : 1;
    if (comparison > 0) {
      bestScore = result.score;
      winners = [player.user_id];
    } else if (comparison === 0) {
      winners.push(player.user_id);
    }
  }

  return {
    ...state,
    street: 'showdown',
    winnerUserIds: winners,
    winnerUserId: winners[0] ?? null,
    showdown,
    shownUserIds,
    nextHandReadyUserIds: [],
    resolutionReason: reason,
    resolvedAt: new Date().toISOString(),
  };
}

async function advanceAsyncPokerTurn(db, gameId, actorUserId, action) {
  const { rows: gameRows } = await db.query(
    'SELECT table_size, turn_seconds, hand_number, state, small_blind_chips, big_blind_chips FROM async_poker_games WHERE id = $1 FOR UPDATE',
    [gameId]
  );
  const game = gameRows[0];
  const { rows: players } = await db.query(
    `SELECT user_id, seat_index, status
     FROM async_poker_game_players
     WHERE game_id = $1
     ORDER BY seat_index`,
    [gameId]
  );
  let state = withoutPendingAsyncPokerAction(normalizeAsyncPokerHandState(game?.state), actorUserId);
  const actor = players.find((player) => Number(player.user_id) === Number(actorUserId));
  if (!actor) return null;
  const actorLeavesAfterFold = action.name === 'fold'
    && (state.pendingLeaveUserIds ?? []).map(Number).includes(Number(actorUserId));

  const amountChips = Number.isInteger(action.amountChips) ? action.amountChips : undefined;
  const liveAction = action.name === 'pass' ? 'check' : action.name;
  const nextActions = appendLiveAction({
    actions: state.actions,
    street: state.street,
    seatId: actor.seat_index,
    playerProfileId: String(actor.user_id),
    action: liveAction,
    ...(amountChips !== undefined ? {
      amount: amountChips,
      amountBB: amountChips / Math.max(1, game.big_blind_chips),
    } : {}),
  });
  const seatedPlayers = players
    .filter((player) => isAsyncPokerPlayerInCurrentHand(player, state))
    .map((player) => player.seat_index)
    .sort((a, b) => a - b);
  const nextGuided = nextGuidedActionState({
    actions: nextActions,
    street: state.street,
    actedSeat: actor.seat_index,
    seatedPlayers,
    tableSize: game.table_size,
    buttonSeat: state.buttonSeat ?? seatedPlayers[0] ?? 0,
  });
  const foldedSeatIds = new Set(nextActions.filter((item) => item.action === 'fold').map((item) => item.seatId));
  const foldedUserIds = players
    .filter((player) => foldedSeatIds.has(player.seat_index))
    .map((player) => player.user_id);

  await db.query(
    `UPDATE async_poker_game_players
     SET last_seen_at = NOW()
     WHERE game_id = $1 AND user_id = $2`,
    [gameId, actorUserId]
  );

  if (nextGuided.handActionClosed) {
    const winnerSeats = unfoldedSeats(nextActions, seatedPlayers);
    const activePlayers = players.filter((player) => winnerSeats.includes(player.seat_index));
    state = resolveAsyncPokerHand(
      { ...state, actions: nextActions, foldedUserIds },
      activePlayers,
      winnerSeats.length <= 1 ? 'all_but_one_folded' : 'showdown'
    );
    const finalPotChips = Math.round(totalPotBB(nextActions) * game.big_blind_chips);
    if (state.winnerUserIds.length > 0 && finalPotChips > 0) {
      const share = Math.floor(finalPotChips / state.winnerUserIds.length);
      const remainder = finalPotChips - (share * state.winnerUserIds.length);
      for (const [index, winnerUserId] of state.winnerUserIds.entries()) {
        await db.query(
          `UPDATE async_poker_game_players
           SET stack_chips = stack_chips + $3
           WHERE game_id = $1 AND user_id = $2`,
          [gameId, winnerUserId, share + (index === 0 ? remainder : 0)]
        );
      }
    }
    if (actorLeavesAfterFold) {
      await db.query(
        `DELETE FROM async_poker_game_players
         WHERE game_id = $1 AND user_id = $2`,
        [gameId, actorUserId]
      );
    }
    const nextButtonSeat = nextClockwise(state.buttonSeat ?? seatedPlayers[0], seatedPlayers, game.table_size)
      ?? state.buttonSeat
      ?? seatedPlayers[0];
    const dealt = await dealAsyncPokerHand(db, {
      gameId,
      game,
      players: players.filter((player) => (
        player.status === 'active'
        && !(actorLeavesAfterFold && Number(player.user_id) === Number(actorUserId))
      )),
      buttonSeat: nextButtonSeat,
      handNumberIncrement: 1,
    });
    const previousHandResult = createPreviousAsyncPokerHandResult(state, game.hand_number, finalPotChips);
    await db.query(
      `UPDATE async_poker_games
       SET state = state || jsonb_build_object('previousHandResult', $2::jsonb),
           updated_at = NOW()
       WHERE id = $1`,
      [gameId, previousHandResult]
    );
    return dealt.firstPlayerId;
  }

  if (nextGuided.street !== state.street) {
    const drawCount = nextGuided.street === 'flop' ? 3 : 1;
    const drawn = drawAsyncPokerCards(state, drawCount);
    state = {
      ...state,
      street: nextGuided.street,
      actions: nextActions,
      deck: drawn.deck,
      board: [...(state.board ?? []), ...drawn.cards],
      foldedUserIds,
    };
  } else {
    state = {
      ...state,
      actions: nextActions,
      foldedUserIds,
    };
  }
  if (actorLeavesAfterFold) {
    await db.query(
      `DELETE FROM async_poker_game_players
       WHERE game_id = $1 AND user_id = $2`,
      [gameId, actorUserId]
    );
    state = withoutPendingAsyncPokerLeave(state, actorUserId);
  }
  const nextPlayer = players.find((player) => player.seat_index === nextGuided.seatId) ?? null;

  await db.query(
    `UPDATE async_poker_games
     SET state = $2,
         current_player_user_id = $3,
         pot_chips = $5,
         current_turn_started_at = NOW(),
         current_turn_expires_at = NOW() + ($4 || ' seconds')::interval,
         updated_at = NOW()
     WHERE id = $1`,
    [gameId, state, nextPlayer?.user_id ?? null, game.turn_seconds, Math.round(totalPotBB(nextActions) * game.big_blind_chips)]
  );
  return nextPlayer?.user_id ?? null;
}

function validateAsyncPokerManualAction({ game, state, actor, action, amountChips }) {
  if (!isAsyncPokerPlayerInCurrentHand(actor, state)) return 'You will be dealt into the next hand';
  const summary = actionSummary(state.actions, state.street, actor.seat_index);
  const amount = Number.isInteger(amountChips) ? amountChips : null;
  const contributionChips = Math.max(0, Math.round(summary.seatContributionBB * game.big_blind_chips));
  const minRaiseToChips = Math.max(0, Math.round(summary.minRaiseToBB * game.big_blind_chips));

  if (action === 'bet') {
    if (!summary.canBet) return 'Cannot bet after a bet has been made';
    if (amount === null || amount <= 0) return 'Bet amount must be positive';
  }
  if (action === 'raise') {
    if (!summary.canRaise) return 'Cannot raise without a bet to raise';
    if (amount === null || amount <= 0) return 'Raise amount must be positive';
    const targetChips = contributionChips + amount;
    if (targetChips < minRaiseToChips) {
      return `Minimum raise is to ${minRaiseToChips} chips`;
    }
  }
  return null;
}

async function settleAsyncPokerNpcTurns(db, gameId) {
  let finalPlayerId = null;
  for (let step = 0; step < 24; step += 1) {
    const { rows: gameRows } = await db.query(
        `SELECT g.id, g.status, g.current_player_user_id, g.state, g.hand_number, g.big_blind_chips,
              (current_player_npc.user_id IS NOT NULL) AS current_player_is_npc
       FROM async_poker_games g
       LEFT JOIN users current_player ON current_player.id = g.current_player_user_id
       LEFT JOIN async_poker_npc_users current_player_npc ON current_player_npc.user_id = current_player.id
       WHERE g.id = $1
       FOR UPDATE OF g`,
      [gameId]
    );
    const game = gameRows[0];
    finalPlayerId = game?.current_player_user_id ?? null;
    if (!game || game.status !== 'active' || !game.current_player_user_id) {
      return finalPlayerId;
    }

    const { rows: players } = await db.query(
      `SELECT user_id, seat_index, status, stack_chips
       FROM async_poker_game_players
       WHERE game_id = $1
       ORDER BY seat_index`,
      [gameId]
    );
    const actor = players.find((player) => Number(player.user_id) === Number(game.current_player_user_id));
    if (!actor) return null;

    const state = normalizeAsyncPokerHandState(game.state);
    const queuedAction = state.pendingActions?.[String(actor.user_id)] ?? null;
    let amountChips = null;
    let action = null;
    let note = null;

    if (queuedAction) {
      const stateWithoutPending = withoutPendingAsyncPokerAction(state, actor.user_id);
      await db.query(
        `UPDATE async_poker_games
         SET state = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [gameId, stateWithoutPending]
      );
      const prepared = prepareAsyncPokerQueuedAction({ game, players, state, actor, queuedAction });
      if (!prepared) {
        return actor.user_id;
      }
      action = prepared.action;
      amountChips = prepared.amountChips;
      note = asyncPokerQueuedActionNote(queuedAction);
      await markAsyncPokerTurnNotificationsRead(db, { gameId, userId: actor.user_id });
    } else if (game.current_player_is_npc) {
      const summary = actionSummary(state.actions, state.street, actor.seat_index);
      const callChips = Math.max(0, Math.round(summary.toCallBB * game.big_blind_chips));
      amountChips = summary.canCall ? Math.min(actor.stack_chips, callChips) : null;
      action = summary.canCall ? 'call' : 'check';
      note = 'NPC acted automatically';
    } else {
      return finalPlayerId;
    }

    if (amountChips !== null && amountChips > 0) {
      await db.query(
        `UPDATE async_poker_game_players
         SET stack_chips = GREATEST(stack_chips - $3, 0)
         WHERE game_id = $1 AND user_id = $2`,
        [gameId, actor.user_id, amountChips]
      );
    }
    await db.query(
      `INSERT INTO async_poker_actions (game_id, user_id, hand_number, action, street, amount_chips, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, actor.user_id, game.hand_number, action, state.street, amountChips, note]
    );
    finalPlayerId = await advanceAsyncPokerTurn(db, gameId, actor.user_id, { name: action, amountChips });
  }
  return finalPlayerId;
}

async function settleVisibleAsyncPokerNpcTurns(db, userId) {
  const { rows } = await db.query(
    `SELECT g.id
     FROM async_poker_games g
     LEFT JOIN users current_player ON current_player.id = g.current_player_user_id
     LEFT JOIN async_poker_npc_users current_player_npc ON current_player_npc.user_id = current_player.id
     WHERE g.status = 'active'
       AND g.current_player_user_id IS NOT NULL
       AND (
         current_player_npc.user_id IS NOT NULL
         OR (COALESCE(g.state->'pendingActions', '{}'::jsonb) ? g.current_player_user_id::text)
       )
       AND (
         g.host_user_id = $1
         OR EXISTS (
           SELECT 1 FROM async_poker_game_players mine
           WHERE mine.game_id = g.id AND mine.user_id = $1
         )
       )
     ORDER BY g.updated_at DESC
     LIMIT 20`,
    [userId]
  );
  for (const row of rows) {
    const nextPlayerId = await settleAsyncPokerNpcTurns(db, row.id);
    if (nextPlayerId) await notifyAsyncPokerTurn(db, row.id, nextPlayerId);
  }
}

function serializeAsyncPokerGame(row, viewerUserId) {
  const hostVisibleNpcUserIds = Number(row.host_user_id) === Number(viewerUserId) && Array.isArray(row.players)
    ? row.players.filter((player) => player?.isNpc).map((player) => player.userId)
    : [];
  return {
    id: row.id,
    name: row.name,
    hostUserId: row.host_user_id,
    hostUsername: row.host_username,
    tableSize: row.table_size,
    turnSeconds: row.turn_seconds,
    status: row.status,
    currentPlayerUserId: row.current_player_user_id,
    currentPlayerUsername: row.current_player_username,
    currentPlayerIsNpc: Boolean(row.current_player_is_npc),
    currentTurnStartedAt: row.current_turn_started_at,
    currentTurnExpiresAt: row.current_turn_expires_at,
    handNumber: row.hand_number,
    potChips: row.pot_chips,
    smallBlindChips: row.small_blind_chips,
    bigBlindChips: row.big_blind_chips,
    state: sanitizeAsyncPokerState(row.state, viewerUserId, hostVisibleNpcUserIds),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPlayer: Boolean(row.is_player),
    players: Array.isArray(row.players) ? row.players : [],
    recentActions: Array.isArray(row.recent_actions) ? row.recent_actions : [],
  };
}

async function listAsyncPokerGames(userId) {
  const { rows } = await pool.query(
    `SELECT g.*,
            host.username AS host_username,
            current_player.username AS current_player_username,
            (current_player_npc.user_id IS NOT NULL) AS current_player_is_npc,
            EXISTS (
              SELECT 1 FROM async_poker_game_players mine
              WHERE mine.game_id = g.id AND mine.user_id = $1
            ) AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(COALESCE(g.state->'pendingLeaveUserIds', '[]'::jsonb)) AS pending_leave(user_id)
              WHERE pending_leave.user_id = $1::text
            ) AS is_player,
            COALESCE(
              jsonb_agg(
                DISTINCT jsonb_build_object(
                  'userId', p.user_id,
                  'username', player.username,
                  'seatIndex', p.seat_index,
                  'stackChips', p.stack_chips,
                  'status', p.status,
                  'joinedAt', p.joined_at,
                  'isNpc', player_npc.user_id IS NOT NULL
                )
              ) FILTER (WHERE p.user_id IS NOT NULL),
              '[]'::jsonb
            ) AS players,
            (
              SELECT COALESCE(jsonb_agg(row_to_json(action_row) ORDER BY action_row."createdAt" DESC), '[]'::jsonb)
              FROM (
                SELECT a.id,
                       a.user_id AS "userId",
                       action_user.username,
                       a.hand_number AS "handNumber",
                       a.action,
                       a.street,
                       a.amount_chips AS "amountChips",
                       a.note,
                       a.created_at AS "createdAt"
                FROM async_poker_actions a
                JOIN users action_user ON action_user.id = a.user_id
                WHERE a.game_id = g.id
                ORDER BY a.created_at DESC
                LIMIT 80
              ) action_row
            ) AS recent_actions
     FROM async_poker_games g
     JOIN users host ON host.id = g.host_user_id
     LEFT JOIN users current_player ON current_player.id = g.current_player_user_id
     LEFT JOIN async_poker_npc_users current_player_npc ON current_player_npc.user_id = current_player.id
     LEFT JOIN async_poker_game_players p ON p.game_id = g.id
     LEFT JOIN users player ON player.id = p.user_id
     LEFT JOIN async_poker_npc_users player_npc ON player_npc.user_id = player.id
     WHERE g.host_user_id = $1
        OR (
          EXISTS (
          SELECT 1 FROM async_poker_game_players mine
          WHERE mine.game_id = g.id AND mine.user_id = $1
          )
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(g.state->'pendingLeaveUserIds', '[]'::jsonb)) AS pending_leave(user_id)
            WHERE pending_leave.user_id = $1::text
          )
        )
     GROUP BY g.id, host.username, current_player.username, current_player_npc.user_id
     ORDER BY g.updated_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows.map((row) => serializeAsyncPokerGame(row, userId));
}

async function getAsyncPokerGameForUser(gameId, userId) {
  const games = await listAsyncPokerGames(userId);
  return games.find((game) => game.id === gameId) ?? null;
}

async function getNextAsyncPokerSeat(db, gameId, tableSize) {
  const { rows } = await db.query(
    'SELECT seat_index FROM async_poker_game_players WHERE game_id = $1 ORDER BY seat_index',
    [gameId]
  );
  const taken = new Set(rows.map((row) => row.seat_index));
  for (let seat = 0; seat < tableSize; seat += 1) {
    if (!taken.has(seat)) return seat;
  }
  return null;
}

function normalizeNpcUsernameSeed(value) {
  const normalized = trimText(value, 24)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'npc';
}

async function createNpcUser(db, seed) {
  const base = normalizeNpcUsernameSeed(seed);
  const hash = await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const username = `${base}${suffix}`.slice(0, 30);
    try {
      const { rows } = await db.query(
        `INSERT INTO users (username, email, password_hash, role, membership_tier)
         VALUES ($1, NULL, $2, 'user', $3)
         RETURNING id, username`,
        [username, hash, DEFAULT_USER_TIER]
      );
      await db.query(
        `INSERT INTO async_poker_npc_users (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [rows[0].id]
      );
      return rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('Failed to create a unique NPC name');
}

// ── Bug reports ──────────────────────────────────────────────────────────────

app.post('/api/bug-reports', async (req, res) => {
  try {
    const message = trimText(req.body?.message);
    if (message.length < 3) {
      return res.status(400).json({ error: 'Bug report message required' });
    }

    const pathName = trimText(req.body?.path, 500) || 'Unknown page';
    const source = trimText(req.body?.source, 200) || 'app';
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object'
      ? JSON.stringify(req.body.metadata, null, 2).slice(0, 5000)
      : '';
    const reporter = req.session?.userId
      ? `${req.session.username ?? 'user'} (#${req.session.userId})`
      : 'Anonymous';

    const body = [
      `Reporter: ${reporter}`,
      `Source: ${source}`,
      `Path: ${pathName}`,
      '',
      message,
      metadata ? `\nMetadata:\n${metadata}` : '',
    ].join('\n');

    const result = await notifyAdmins('[GTO Training] Bug report', body);
    res.status(202).json({
      ok: true,
      notified: result.sent,
      recipientsConfigured: notificationRecipients().length > 0,
    });
  } catch (err) {
    console.error('[bug-reports] notify error:', err);
    res.status(500).json({ error: 'Failed to submit bug report' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    if (!dbConfigured) {
      return res.status(503).json({ error: 'Feedback inbox unavailable' });
    }
    const ok = await checkDbHealth(pool);
    if (!ok) {
      return res.status(503).json({ error: 'Feedback inbox temporarily unavailable' });
    }
    await ensureFeedbackSchema();

    const message = trimText(req.body?.message);
    if (message.length < 3) {
      return res.status(400).json({ error: 'Feedback message required' });
    }

    const contactEmail = normalizeEmail(req.body?.email);
    if (contactEmail && !isValidEmail(contactEmail)) {
      return res.status(400).json({ error: 'Email must be a valid address' });
    }

    const pathName = trimText(req.body?.path, 500) || 'Unknown page';
    const source = trimText(req.body?.source, 200) || 'feedback button';
    const reporterEmail = normalizeEmail(req.session?.email);
    const reporter = req.session?.userId
      ? `${req.session.username ?? 'user'} (#${req.session.userId}${reporterEmail ? `, ${reporterEmail}` : ''})`
      : 'Anonymous';

    const { rows } = await pool.query(
      `INSERT INTO feedback_messages
        (user_id, reporter_username, reporter_email, contact_email, message, source, path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        req.session?.userId ?? null,
        req.session?.username ?? null,
        reporterEmail,
        contactEmail,
        message,
        source,
        pathName,
      ]
    );

    const body = [
      `Feedback ID: ${rows[0].id}`,
      `Reporter: ${reporter}`,
      contactEmail ? `Contact: ${contactEmail}` : 'Contact: not provided',
      `Source: ${source}`,
      `Path: ${pathName}`,
      '',
      message,
    ].join('\n');

    let notification = { sent: false, reason: 'not_attempted' };
    try {
      notification = await notifyAdminEmails('[GTO Training] Feedback', body);
    } catch (err) {
      console.warn('[feedback] optional email notification failed:', err.message);
      notification = { sent: false, reason: 'send_failed' };
    }

    res.status(202).json({
      ok: true,
      id: rows[0].id,
      createdAt: rows[0].created_at,
      notified: notification.sent,
      recipientsConfigured: adminEmailRecipients().length > 0,
    });
  } catch (err) {
    console.error('[feedback] notify error:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ── Auth routes ───────────────────────────────────────────────────────────────

app.post('/api/auth/register', requireDb, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);
    const promoCode = normalizePromoCode(req.body?.promoCode);
    if (!username || !/^[a-z0-9_-]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–30 lowercase characters: letters, numbers, hyphens, underscores',
      });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email must be a valid address' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (promoCode && !isValidPromoCode(promoCode)) {
      return res.status(400).json({ error: 'Promo code must be 3–32 letters, numbers, hyphens, or underscores' });
    }

    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE username = $1 OR ($2::text IS NOT NULL AND email = $2)',
      [username, email]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Username or email already taken' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const role = 'user';
    const { rows } = await client.query(
      `INSERT INTO users (username, password_hash, email, role, membership_tier)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, membership_tier, created_at`,
      [username, hash, email, role, DEFAULT_USER_TIER]
    );
    const user = rows[0];
    if (promoCode) {
      await redeemPromoCode(user.id, promoCode, client);
    }
    await client.query('COMMIT');
    await sendWelcomeEmail(user);
    const serialized = await setSessionUser(req, user);
    await recordLoginEvent(req, user, 'signup');

    res.status(201).json({
      user: serialized,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[auth] register error:', err);
    res.status(err.statusCode ?? 500).json({ error: err.statusCode ? err.message : 'Registration failed' });
  } finally {
    client.release();
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

    const serialized = await setSessionUser(req, user);
    await recordLoginEvent(req, user, 'password');

    res.json({ user: serialized });
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
  if (!req.session.userId) {
    if (!dbConfigured || !pool) return res.json({ user: null });
    const ok = await checkDbHealth(pool);
    if (!ok) return res.json({ user: null });
    try {
      const user = await authenticateCloudflareAccess(req);
      return res.json({ user });
    } catch (err) {
      console.warn('[auth] Cloudflare Access session restore failed:', err.message);
      return res.json({ user: null });
    }
  }
  let currentUser = null;
  if (dbConfigured && pool) {
    const ok = await checkDbHealth(pool);
    if (ok) {
      try {
        const { rows } = await pool.query(
          'SELECT id, username, email, role, membership_tier, created_at FROM users WHERE id = $1',
          [req.session.userId]
        );
        if (rows[0]) {
          const serialized = await serializeUser(rows[0]);
          currentUser = serialized;
          req.session.username = rows[0].username;
          req.session.membershipTier = serialized.tier;
          req.session.email = rows[0].email ?? null;
          req.session.role = resolveUserRole(rows[0]);
        }
      } catch (err) {
        console.warn('[auth] failed to refresh membership tier:', err.message);
      }
    }
  }
  if (currentUser) {
    return res.json({ user: currentUser });
  }
  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
      email: req.session.email ?? null,
      tier: normalizeUserTier(req.session.membershipTier),
      membershipTier: normalizeUserTier(req.session.membershipTier),
      activePromo: null,
      role: normalizeUserRole(req.session.role),
    },
  });
});

// ── Account routes ───────────────────────────────────────────────────────────

app.post('/api/account/promo-code', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const redemption = await redeemPromoCode(req.session.userId, req.body?.code, client);
    await client.query('COMMIT');

    const { rows } = await pool.query(
      'SELECT id, username, email, role, membership_tier, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = await serializeUser(rows[0]);
    req.session.membershipTier = user.tier;
    res.status(201).json({ user, redemption });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[promo] redeem error:', err);
    res.status(err.statusCode ?? 500).json({ error: err.statusCode ? err.message : 'Failed to redeem promo code' });
  } finally {
    client.release();
  }
});

// ── Notifications + async poker routes ──────────────────────────────────────

app.get('/api/notifications', requireDb, requireAuth, async (req, res) => {
  try {
    await clearStaleAsyncPokerTurnNotifications(req.session.userId);
    await refreshAsyncPokerTurnReminders(req.session.userId);
    const unreadOnly = req.query?.unread === 'true';
    const { rows } = await pool.query(
      `SELECT id, type, title, body, action_path, metadata, read_at, created_at
       FROM in_app_notifications
       WHERE user_id = $1
         AND ($2::boolean = false OR read_at IS NULL)
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.session.userId, unreadOnly]
    );
    res.json({
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        actionPath: row.action_path,
        metadata: row.metadata ?? {},
        readAt: row.read_at,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('[notifications] list error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

app.patch('/api/notifications/:id', requireDb, requireAuth, async (req, res) => {
  try {
    const read = req.body?.read !== false;
    const { rows } = await pool.query(
      `UPDATE in_app_notifications
       SET read_at = CASE WHEN $1 THEN COALESCE(read_at, NOW()) ELSE NULL END
       WHERE id = $2 AND user_id = $3
       RETURNING id, read_at`,
      [read, req.params.id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: { id: rows[0].id, readAt: rows[0].read_at } });
  } catch (err) {
    console.error('[notifications] update error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

app.get('/api/notification-preferences', requireDb, requireAuth, async (req, res) => {
  try {
    const preference = await getNotificationPreference(req.session.userId);
    res.json({ preference: serializeNotificationPreference(preference) });
  } catch (err) {
    console.error('[notifications] preference load error:', err);
    res.status(500).json({ error: 'Failed to load notification preferences' });
  }
});

app.put('/api/notification-preferences', requireDb, requireAuth, async (req, res) => {
  try {
    const emailTurnNotifications = Boolean(req.body?.emailTurnNotifications);
    const discordTurnNotifications = Boolean(req.body?.discordTurnNotifications);
    const discordUserId = normalizeDiscordUserId(req.body?.discordUserId);
    if (discordTurnNotifications && !discordUserId) {
      return res.status(400).json({ error: 'Discord user ID is required to enable Discord turn notifications' });
    }

    const { rows } = await pool.query(
      `INSERT INTO notification_preferences
         (user_id, email_turn_notifications, discord_turn_notifications, discord_user_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         email_turn_notifications = EXCLUDED.email_turn_notifications,
         discord_turn_notifications = EXCLUDED.discord_turn_notifications,
         discord_user_id = EXCLUDED.discord_user_id,
         updated_at = NOW()
       RETURNING email_turn_notifications, discord_turn_notifications, discord_user_id`,
      [req.session.userId, emailTurnNotifications, discordTurnNotifications, discordUserId]
    );
    res.json({ preference: serializeNotificationPreference(rows[0]) });
  } catch (err) {
    console.error('[notifications] preference save error:', err);
    res.status(500).json({ error: 'Failed to save notification preferences' });
  }
});

app.get('/api/async-poker/games', requireDb, requireAuth, async (req, res) => {
  try {
    await settleVisibleAsyncPokerNpcTurns(pool, req.session.userId);
    await clearStaleAsyncPokerTurnNotifications(req.session.userId);
    await refreshAsyncPokerTurnReminders(req.session.userId);
    const [games, preferenceResult, notificationsResult] = await Promise.all([
      listAsyncPokerGames(req.session.userId),
      getNotificationPreference(req.session.userId),
      listUnreadInAppNotifications(req.session.userId),
    ]);
    res.json({
      games,
      preference: serializeNotificationPreference(preferenceResult),
      notifications: notificationsResult.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        actionPath: row.action_path,
        metadata: row.metadata ?? {},
        readAt: row.read_at,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('[async-poker] list error:', err);
    res.status(500).json({ error: 'Failed to load async poker games' });
  }
});

app.post('/api/async-poker/games', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const name = trimText(req.body?.name, 120) || `${req.session.username}'s table`;
    const tableSize = normalizeTableSize(req.body?.tableSize);
    const turnSeconds = normalizeTurnSeconds(req.body?.turnSeconds);
    const inviteUsernames = Array.isArray(req.body?.inviteUsernames)
      ? req.body.inviteUsernames.map((name) => trimText(name, 30).toLowerCase()).filter(Boolean)
      : [];
    const gameId = randomUUID();
    const pendingInviteNotifications = [];

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO async_poker_games (id, host_user_id, name, table_size, turn_seconds, state)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [gameId, req.session.userId, name, tableSize, turnSeconds, { invitedUsernames: inviteUsernames }]
    );
    await client.query(
      `INSERT INTO async_poker_game_players (game_id, user_id, seat_index, stack_chips)
       VALUES ($1, $2, 0, $3)`,
      [gameId, req.session.userId, ASYNC_POKER_DEFAULT_STACK]
    );
    await client.query(
      `INSERT INTO async_poker_actions (game_id, user_id, action, note)
       VALUES ($1, $2, 'join', 'Hosted the table')`,
      [gameId, req.session.userId]
    );

    if (inviteUsernames.length > 0) {
      const { rows: invitees } = await client.query(
        `SELECT id, username
         FROM users
         WHERE username = ANY($1::text[])
           AND id <> $2
         LIMIT 8`,
        [inviteUsernames, req.session.userId]
      );
      for (const invitee of invitees) {
        pendingInviteNotifications.push({
          userId: invitee.id,
          type: 'async_poker_invite',
          title: 'Async poker invite',
          body: `${req.session.username} invited you to ${name}.`,
          actionPath: 'poker_async',
        });
      }
    }

    await client.query('COMMIT');
    for (const notification of pendingInviteNotifications) {
      await createInAppNotification(pool, notification);
    }
    const game = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.status(201).json({ game });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] create error:', err);
    res.status(500).json({ error: 'Failed to create async poker game' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/join', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }
    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, table_size, status, state
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    const { rows: existingPlayers } = await client.query(
      `SELECT 1
       FROM async_poker_game_players
       WHERE game_id = $1 AND user_id = $2`,
      [gameId, req.session.userId]
    );
    if (existingPlayers.length > 0) {
      await client.query('COMMIT');
      const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
      return res.json({ game: updated });
    }
    if (!['waiting', 'active'].includes(game.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This table is no longer open' });
    }
    const requestedSeat = req.body?.seatIndex === null || req.body?.seatIndex === undefined
      ? null
      : Number.parseInt(String(req.body.seatIndex), 10);
    if (
      requestedSeat !== null
      && (!Number.isInteger(requestedSeat) || requestedSeat < 0 || requestedSeat >= game.table_size)
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Seat is not available' });
    }
    const seat = requestedSeat ?? await getNextAsyncPokerSeat(client, gameId, game.table_size);
    if (seat === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This table is full' });
    }
    if (requestedSeat !== null) {
      const { rows: occupiedRows } = await client.query(
        `SELECT 1
         FROM async_poker_game_players
         WHERE game_id = $1 AND seat_index = $2`,
        [gameId, requestedSeat]
      );
      if (occupiedRows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Seat is already occupied' });
      }
    }
    await client.query(
      `INSERT INTO async_poker_game_players (game_id, user_id, seat_index, stack_chips)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, user_id) DO NOTHING`,
      [gameId, req.session.userId, seat, ASYNC_POKER_DEFAULT_STACK]
    );
    if (game.status === 'active') {
      const state = normalizeAsyncPokerHandState(game.state);
      const pendingBigBlindUserIds = [
        ...new Set([...(state.pendingBigBlindUserIds ?? []), req.session.userId].map(Number)),
      ];
      await client.query(
        `UPDATE async_poker_games
         SET state = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [gameId, { ...state, pendingBigBlindUserIds }]
      );
    } else {
      await client.query(
        `UPDATE async_poker_games
         SET updated_at = NOW()
         WHERE id = $1`,
        [gameId]
      );
    }
    await client.query(
      `INSERT INTO async_poker_actions (game_id, user_id, action, note)
       VALUES ($1, $2, 'join', $3)`,
      [gameId, req.session.userId, game.status === 'active' ? 'Joined the table for the next hand' : 'Joined the table']
    );
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] join error:', err);
    res.status(500).json({ error: 'Failed to join game' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/leave', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, host_user_id, status, hand_number, state
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    const leavingHost = Number(game.host_user_id) === Number(req.session.userId);
    if (!['waiting', 'active'].includes(game.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This table is no longer open' });
    }

    const { rows: playerRows } = await client.query(
      `SELECT user_id, seat_index, status
       FROM async_poker_game_players
       WHERE game_id = $1 AND user_id = $2`,
      [gameId, req.session.userId]
    );
    const player = playerRows[0];
    if (!player) {
      await client.query('COMMIT');
      const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
      return res.json({ game: updated });
    }

    const state = normalizeAsyncPokerHandState(game.state);
    const playerInCurrentHand = game.status === 'active' && isAsyncPokerPlayerInCurrentHand(player, state);
    const leavingAfterQueuedFold = playerInCurrentHand && hasPendingAsyncPokerFold(state, req.session.userId);
    if (playerInCurrentHand && !leavingAfterQueuedFold) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Finish this hand before leaving the table' });
    }

    let nextHostUserId = Number(game.host_user_id);
    let nextStatus = game.status;
    let leaveNote = game.status === 'active' ? 'Left before being dealt into the next hand' : 'Left the table';
    if (leavingHost) {
      const { rows: hostCandidateRows } = await client.query(
        `SELECT p.user_id
         FROM async_poker_game_players p
         LEFT JOIN async_poker_npc_users npc ON npc.user_id = p.user_id
         WHERE p.game_id = $1
           AND p.user_id <> $2
           AND p.status = 'active'
           AND npc.user_id IS NULL
         ORDER BY p.joined_at ASC, p.seat_index ASC
         LIMIT 1`,
        [gameId, req.session.userId]
      );
      const hostCandidate = hostCandidateRows[0]?.user_id ?? null;
      if (hostCandidate) {
        nextHostUserId = hostCandidate;
        leaveNote = 'Host left and table ownership was transferred';
      } else {
        nextStatus = 'finished';
        leaveNote = 'Host left and closed the table';
      }
    }

    if (leavingAfterQueuedFold && nextStatus !== 'finished') {
      await client.query(
        `UPDATE async_poker_games
         SET host_user_id = $3,
             status = $4,
             state = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [gameId, withPendingAsyncPokerLeave(state, req.session.userId), nextHostUserId, nextStatus]
      );
      await client.query('COMMIT');
      return res.json({ game: null });
    }

    await client.query(
      `DELETE FROM async_poker_game_players
       WHERE game_id = $1 AND user_id = $2`,
      [gameId, req.session.userId]
    );
    await client.query(
      `UPDATE async_poker_games
       SET host_user_id = $3,
           status = $4,
           state = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [gameId, withoutWaitingAsyncPokerUser(state, req.session.userId), nextHostUserId, nextStatus]
    );
    await client.query(
      `INSERT INTO async_poker_actions (game_id, user_id, hand_number, action, note)
       VALUES ($1, $2, $3, 'leave', $4)`,
      [
        gameId,
        req.session.userId,
        game.hand_number,
        leaveNote,
      ]
    );
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] leave error:', err);
    res.status(500).json({ error: 'Failed to leave table' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/npcs', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }
    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, host_user_id, table_size, status
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.host_user_id !== req.session.userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the host can add NPCs' });
    }
    if (game.status !== 'waiting') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'NPCs can only be added before the table starts' });
    }

    const seat = await getNextAsyncPokerSeat(client, gameId, game.table_size);
    if (seat === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This table is full' });
    }
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM async_poker_game_players p
       JOIN async_poker_npc_users npc ON npc.user_id = p.user_id
       WHERE p.game_id = $1`,
      [gameId]
    );
    const requestedName = trimText(req.body?.name, 24);
    const npc = await createNpcUser(client, requestedName || `npc-${countRows[0].count + 1}`);
    await client.query(
      `INSERT INTO async_poker_game_players (game_id, user_id, seat_index, stack_chips)
       VALUES ($1, $2, $3, $4)`,
      [gameId, npc.id, seat, ASYNC_POKER_DEFAULT_STACK]
    );
    await client.query(
      `INSERT INTO async_poker_actions (game_id, user_id, action, note)
       VALUES ($1, $2, 'join', $3)`,
      [gameId, req.session.userId, `${npc.username} joined as an NPC`]
    );
    await client.query(
      `UPDATE async_poker_games
       SET updated_at = NOW()
       WHERE id = $1`,
      [gameId]
    );

    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] add npc error:', err);
    res.status(500).json({ error: 'Failed to add NPC' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/start', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }
    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, host_user_id, table_size, turn_seconds, status, hand_number, small_blind_chips, big_blind_chips
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.host_user_id !== req.session.userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the host can start this game' });
    }
    if (game.status !== 'waiting') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This game has already started' });
    }
    const { rows: players } = await client.query(
      `SELECT user_id, seat_index, status
       FROM async_poker_game_players
       WHERE game_id = $1 AND status = 'active'
       ORDER BY seat_index`,
      [gameId]
    );
    if (players.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least two players are needed to start' });
    }
    const buttonSeat = players.find((player) => player.user_id === game.host_user_id)?.seat_index
      ?? players[0].seat_index;
    const handState = createAsyncPokerHandState(players, {
      tableSize: game.table_size,
      buttonSeat,
      smallBlindChips: game.small_blind_chips,
      bigBlindChips: game.big_blind_chips,
    });
    const seatedPlayers = players.map((player) => player.seat_index).sort((a, b) => a - b);
    const firstPlayerSeat = firstPreflopActor({
      seatedPlayers,
      tableSize: game.table_size,
      bigBlindSeat: handState.bigBlindSeat,
    });
    const firstPlayerId = players.find((player) => player.seat_index === firstPlayerSeat)?.user_id
      ?? players[0].user_id;
    if (handState.smallBlindSeat !== null) {
      const smallBlindPlayer = players.find((player) => player.seat_index === handState.smallBlindSeat);
      if (smallBlindPlayer) {
        await client.query(
          `UPDATE async_poker_game_players
           SET stack_chips = GREATEST(stack_chips - $3, 0)
           WHERE game_id = $1 AND user_id = $2`,
          [gameId, smallBlindPlayer.user_id, game.small_blind_chips]
        );
      }
    }
    if (handState.bigBlindSeat !== null) {
      const bigBlindPlayer = players.find((player) => player.seat_index === handState.bigBlindSeat);
      if (bigBlindPlayer) {
        await client.query(
          `UPDATE async_poker_game_players
           SET stack_chips = GREATEST(stack_chips - $3, 0)
           WHERE game_id = $1 AND user_id = $2`,
          [gameId, bigBlindPlayer.user_id, game.big_blind_chips]
        );
      }
    }
    const startingPotChips = Math.round(totalPotBB(handState.actions) * game.big_blind_chips);
    await client.query(
      `UPDATE async_poker_games
       SET status = 'active',
           current_player_user_id = $2,
           current_turn_started_at = NOW(),
           current_turn_expires_at = NOW() + ($3 || ' seconds')::interval,
           state = $4,
           pot_chips = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [gameId, firstPlayerId, game.turn_seconds, handState, startingPotChips]
    );
    await client.query(
      `INSERT INTO async_poker_actions (game_id, user_id, hand_number, action, note)
       VALUES ($1, $2, $3, 'start', 'Started the game')`,
      [gameId, req.session.userId, game.hand_number]
    );
    const nextPlayerId = await settleAsyncPokerNpcTurns(client, gameId);
    await notifyAsyncPokerTurn(client, gameId, nextPlayerId ?? firstPlayerId);
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] start error:', err);
    res.status(500).json({ error: 'Failed to start game' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/end', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, host_user_id, status, hand_number, state
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.host_user_id !== req.session.userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the host can end this table' });
    }

    if (game.status !== 'finished') {
      await client.query(
        `UPDATE async_poker_games
         SET status = 'finished',
             current_player_user_id = NULL,
             current_turn_started_at = NULL,
             current_turn_expires_at = NULL,
             state = COALESCE(state, '{}'::jsonb) || jsonb_build_object(
               'resolutionReason', 'host_ended',
               'endedByUserId', $2::integer,
               'endedAt', NOW()
             ),
             updated_at = NOW()
         WHERE id = $1`,
        [gameId, req.session.userId]
      );
      await client.query(
        `INSERT INTO async_poker_actions (game_id, user_id, hand_number, action, note)
         VALUES ($1, $2, $3, 'end', 'Host ended the table')`,
        [gameId, req.session.userId, game.hand_number]
      );
    }

    await client.query(
      `UPDATE in_app_notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE read_at IS NULL
         AND type IN ('async_poker_turn', 'async_poker_turn_reminder')
         AND metadata->>'asyncPokerGameId' = $1`,
      [gameId]
    );

    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] end error:', err);
    res.status(500).json({ error: 'Failed to end table' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/show-cards', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, status, hand_number, state
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This table is not active' });
    }
    const { rows: playerRows } = await client.query(
      `SELECT user_id, status
       FROM async_poker_game_players
       WHERE game_id = $1 AND user_id = $2 AND status = 'active'`,
      [gameId, req.session.userId]
    );
    if (playerRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only seated players can show cards' });
    }

    const state = normalizeAsyncPokerHandState(game.state);
    if (!isAsyncPokerPlayerInCurrentHand(playerRows[0], state)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You will be dealt into the next hand' });
    }
    if (!state.resolvedAt) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cards can be shown after the hand resolves' });
    }
    const shownUserIds = [...new Set([...(state.shownUserIds ?? []), req.session.userId].map(Number))];
    await client.query(
      `UPDATE async_poker_games
       SET state = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [gameId, { ...state, shownUserIds }]
    );
    await client.query(
      `INSERT INTO async_poker_actions (game_id, user_id, hand_number, action, note)
       VALUES ($1, $2, $3, 'show', 'Showed hole cards')`,
      [gameId, req.session.userId, game.hand_number]
    );
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] show cards error:', err);
    res.status(500).json({ error: 'Failed to show cards' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/acknowledge-result', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, status, state
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This table is not active' });
    }

    const { rows: players } = await client.query(
      `SELECT user_id
       FROM async_poker_game_players
       WHERE game_id = $1 AND status = 'active'
       ORDER BY seat_index`,
      [gameId]
    );
    if (!players.some((player) => player.user_id === req.session.userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only seated players can acknowledge results' });
    }

    const state = normalizeAsyncPokerHandState(game.state);
    if (!state.previousHandResult) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No previous hand result to acknowledge' });
    }

    const previousHandResult = {
      ...state.previousHandResult,
      acknowledgedUserIds: [
        ...new Set([...(state.previousHandResult.acknowledgedUserIds ?? []), req.session.userId].map(Number)),
      ],
    };
    await client.query(
      `UPDATE async_poker_games
       SET state = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [gameId, { ...state, previousHandResult }]
    );
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] acknowledge result error:', err);
    res.status(500).json({ error: 'Failed to acknowledge result' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/queued-action', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    const parseChipAmount = (value) => (
      value === null || value === undefined || value === ''
        ? null
        : Number.parseInt(String(value), 10)
    );
    const amountChips = parseChipAmount(req.body?.amountChips);
    const raiseToChips = parseChipAmount(req.body?.raiseToChips);
    const callCapChips = parseChipAmount(req.body?.callCapChips);
    const callCapMode = req.body?.callCapMode === 'all_in' ? 'all_in' : 'amount';
    const note = trimText(req.body?.note, 500) || null;
    const actorUserIdRaw = req.body?.actorUserId;
    const requestedActorUserId = actorUserIdRaw === null || actorUserIdRaw === undefined || actorUserIdRaw === ''
      ? req.session.userId
      : Number.parseInt(String(actorUserIdRaw), 10);

    if (action && !['call', 'raise', 'fold'].includes(action)) {
      return res.status(400).json({ error: 'Pre-decision must be call, raise, or fold' });
    }
    if (amountChips !== null && !Number.isInteger(amountChips)) {
      return res.status(400).json({ error: 'Amount must be a chip count' });
    }
    if (raiseToChips !== null && !Number.isInteger(raiseToChips)) {
      return res.status(400).json({ error: 'Raise amount must be a chip count' });
    }
    if (callCapChips !== null && !Number.isInteger(callCapChips)) {
      return res.status(400).json({ error: 'Call cap must be a chip count' });
    }
    if (req.body?.callCapMode && !['amount', 'all_in'].includes(req.body.callCapMode)) {
      return res.status(400).json({ error: 'Call cap mode must be amount or all in' });
    }
    if (amountChips !== null && action === 'call' && amountChips < 0) {
      return res.status(400).json({ error: 'Call amount cannot be negative' });
    }
    if (amountChips !== null && action === 'raise' && amountChips <= 0) {
      return res.status(400).json({ error: 'Raise amount must be positive' });
    }
    if (raiseToChips !== null && raiseToChips <= 0) {
      return res.status(400).json({ error: 'Raise amount must be positive' });
    }
    if (callCapChips !== null && callCapChips < 0) {
      return res.status(400).json({ error: 'Call cap cannot be negative' });
    }
    const queuedAction = normalizeAsyncPokerQueuedAction({
      action,
      amountChips,
      raiseToChips,
      callCapChips,
      callCapMode,
      note,
    });
    if (!queuedAction) {
      return res.status(400).json({ error: 'Add a raise target, a call cap, choose call up to all in, or fold' });
    }
    if (!Number.isInteger(requestedActorUserId)) {
      return res.status(400).json({ error: 'Invalid player for pre-decision' });
    }

    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, host_user_id, status, current_player_user_id, hand_number, state
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This table is not active' });
    }
    if (Number(game.current_player_user_id) === Number(requestedActorUserId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'It is your turn now. Use the action buttons instead.' });
    }

    const { rows: playerRows } = await client.query(
      `SELECT p.status, (npc.user_id IS NOT NULL) AS is_npc
       FROM async_poker_game_players p
       LEFT JOIN async_poker_npc_users npc ON npc.user_id = p.user_id
       WHERE p.game_id = $1 AND p.user_id = $2`,
      [gameId, requestedActorUserId]
    );
    const player = playerRows[0];
    if (!player || player.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not active in this hand' });
    }
    const controllingNpc = Number(requestedActorUserId) !== Number(req.session.userId);
    if (controllingNpc && (Number(game.host_user_id) !== Number(req.session.userId) || !player.is_npc)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only pre-decide for NPCs you host' });
    }

    const state = normalizeAsyncPokerHandState(game.state);
    if (!isAsyncPokerPlayerInCurrentHand({ user_id: requestedActorUserId, status: player.status }, state)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You will be dealt into the next hand' });
    }
    const folded = new Set((state.foldedUserIds ?? []).map(Number));
    if (folded.has(Number(requestedActorUserId)) || state.street === 'showdown' || state.resolvedAt) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot pre-decide for this hand' });
    }
    const pendingActions = {
      ...(state.pendingActions ?? {}),
      [String(requestedActorUserId)]: {
        action: queuedAction.action,
        amountChips: queuedAction.amountChips,
        raiseToChips: queuedAction.raiseToChips,
        callCapChips: queuedAction.callCapChips,
        callCapMode: queuedAction.callCapMode,
        handNumber: game.hand_number,
        street: state.street,
        note,
        createdAt: new Date().toISOString(),
      },
    };

    await client.query(
      `UPDATE async_poker_games
       SET state = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [gameId, { ...state, pendingActions }]
    );
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] queued action error:', err);
    res.status(500).json({ error: 'Failed to save pre-decision' });
  } finally {
    client.release();
  }
});

app.delete('/api/async-poker/games/:id/queued-action', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const actorUserIdRaw = req.query?.actorUserId;
    const requestedActorUserId = actorUserIdRaw === null || actorUserIdRaw === undefined || actorUserIdRaw === ''
      ? req.session.userId
      : Number.parseInt(String(actorUserIdRaw), 10);
    if (!Number.isInteger(requestedActorUserId)) {
      return res.status(400).json({ error: 'Invalid player for pre-decision' });
    }
    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT id, host_user_id, state
       FROM async_poker_games
       WHERE id = $1
       FOR UPDATE`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (Number(requestedActorUserId) !== Number(req.session.userId)) {
      const { rows: playerRows } = await client.query(
        `SELECT (npc.user_id IS NOT NULL) AS is_npc
         FROM async_poker_game_players p
         LEFT JOIN async_poker_npc_users npc ON npc.user_id = p.user_id
         WHERE p.game_id = $1 AND p.user_id = $2`,
        [gameId, requestedActorUserId]
      );
      if (Number(game.host_user_id) !== Number(req.session.userId) || !playerRows[0]?.is_npc) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You can only clear NPC pre-decisions you host' });
      }
    }
    const state = withoutPendingAsyncPokerAction(normalizeAsyncPokerHandState(game.state), requestedActorUserId);
    await client.query(
      `UPDATE async_poker_games
       SET state = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [gameId, state]
    );
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] clear queued action error:', err);
    res.status(500).json({ error: 'Failed to clear pre-decision' });
  } finally {
    client.release();
  }
});

app.post('/api/async-poker/games/:id/actions', requireDb, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!isValidUuid(gameId)) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    const amountRaw = req.body?.amountChips;
    const amountChips = amountRaw === null || amountRaw === undefined || amountRaw === ''
      ? null
      : Number.parseInt(String(amountRaw), 10);
    const note = trimText(req.body?.note, 500) || null;

    if (!ASYNC_POKER_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Action must be check, call, bet, raise, fold, or pass' });
    }
    if (amountChips !== null && (!Number.isInteger(amountChips) || amountChips < 0)) {
      return res.status(400).json({ error: 'Amount must be a positive chip count' });
    }

    await client.query('BEGIN');
    const { rows: gameRows } = await client.query(
      `SELECT g.id, g.host_user_id, g.status, g.current_player_user_id, g.current_turn_started_at, g.hand_number, g.state,
              g.big_blind_chips,
              (current_player_npc.user_id IS NOT NULL) AS current_player_is_npc
       FROM async_poker_games g
       LEFT JOIN users current_player ON current_player.id = g.current_player_user_id
       LEFT JOIN async_poker_npc_users current_player_npc ON current_player_npc.user_id = current_player.id
       WHERE g.id = $1
       FOR UPDATE OF g`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This game is not active' });
    }
    const actingForNpc = Boolean(game.current_player_is_npc && game.host_user_id === req.session.userId);
    if (game.current_player_user_id !== req.session.userId && !actingForNpc) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'It is not your turn' });
    }
    const actorUserId = actingForNpc ? game.current_player_user_id : req.session.userId;

    const currentState = normalizeAsyncPokerHandState(game.state);
    const { rows: actorRows } = await client.query(
      `SELECT user_id, seat_index, stack_chips, status
       FROM async_poker_game_players
       WHERE game_id = $1 AND user_id = $2`,
      [gameId, actorUserId]
    );
    const actor = actorRows[0];
    if (!actor) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Actor is not seated' });
    }
    const actionError = validateAsyncPokerManualAction({
      game,
      state: currentState,
      actor,
      action,
      amountChips,
    });
    if (actionError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: actionError });
    }
    if (amountChips !== null && amountChips > 0) {
      await client.query(
        `UPDATE async_poker_game_players
         SET stack_chips = GREATEST(stack_chips - $3, 0)
         WHERE game_id = $1 AND user_id = $2`,
        [gameId, actorUserId, amountChips]
      );
    }
    await client.query(
      `INSERT INTO async_poker_actions (game_id, user_id, hand_number, action, street, amount_chips, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, actorUserId, game.hand_number, action, currentState.street, amountChips, note]
    );
    if (!actingForNpc) {
      await markAsyncPokerTurnNotificationsRead(client, {
        gameId,
        userId: req.session.userId,
        turnStartedAt: game.current_turn_started_at ? new Date(game.current_turn_started_at).toISOString() : null,
      });
    }
    const nextPlayerId = await advanceAsyncPokerTurn(client, gameId, actorUserId, { name: action, amountChips });
    const settledPlayerId = await settleAsyncPokerNpcTurns(client, gameId);
    const notifyPlayerId = settledPlayerId ?? nextPlayerId;
    if (notifyPlayerId) {
      await notifyAsyncPokerTurn(client, gameId, notifyPlayerId);
    }
    await client.query('COMMIT');
    const updated = await getAsyncPokerGameForUser(gameId, req.session.userId);
    res.json({ game: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[async-poker] action error:', err);
    res.status(500).json({ error: 'Failed to record poker action' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/activity', requireDb, requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [loginEventsAvailable, feedbackAvailable] = await Promise.all([ensureLoginEventsSchema(), ensureFeedbackSchema()]);

    const [
      summaryResult,
      usersByTierResult,
      usersByRoleResult,
      loginsByMethodResult,
      recentUsersResult,
      activeSessionsResult,
      recentLoginEventsResult,
      topLiveUsersResult,
      recentFeedbackResult,
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,
          (SELECT COUNT(*)::int FROM sessions WHERE expire > NOW()) AS active_sessions,
          ${loginEventsAvailable
            ? `(SELECT COUNT(*)::int FROM login_events WHERE created_at >= NOW() - INTERVAL '24 hours')`
            : '0::int'} AS logins_24h,
          ${loginEventsAvailable
            ? `(SELECT COUNT(*)::int FROM login_events WHERE created_at >= NOW() - INTERVAL '7 days')`
            : '0::int'} AS logins_7d,
          ${loginEventsAvailable
            ? `(SELECT COUNT(DISTINCT user_id)::int FROM login_events WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days')`
            : '0::int'} AS unique_login_users_7d,
          (SELECT COUNT(*)::int FROM live_sessions) AS total_live_sessions,
          (SELECT COUNT(*)::int FROM live_sessions WHERE ended_at IS NULL) AS open_live_sessions,
          (SELECT COUNT(*)::int FROM live_sessions WHERE started_at >= NOW() - INTERVAL '7 days') AS live_sessions_7d,
          ${feedbackAvailable ? '(SELECT COUNT(*)::int FROM feedback_messages)' : '0::int'} AS total_feedback,
          ${feedbackAvailable ? `(SELECT COUNT(*)::int FROM feedback_messages WHERE status = 'new')` : '0::int'} AS unread_feedback
      `),
      pool.query(`
        SELECT membership_tier AS tier, COUNT(*)::int AS count
        FROM users
        GROUP BY membership_tier
        ORDER BY membership_tier
      `),
      pool.query(`
        SELECT role, COUNT(*)::int AS count
        FROM users
        GROUP BY role
        ORDER BY role
      `),
      loginEventsAvailable ? pool.query(`
        SELECT method, COUNT(*)::int AS count, MAX(created_at) AS last_seen_at
        FROM login_events
        GROUP BY method
        ORDER BY count DESC, method
      `) : Promise.resolve({ rows: [] }),
      loginEventsAvailable ? pool.query(`
        SELECT u.id, u.username, u.email, u.role, u.membership_tier, u.created_at,
               MAX(le.created_at) AS last_login_at,
               COUNT(le.id)::int AS login_count
        FROM users u
        LEFT JOIN login_events le ON le.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 20
      `) : pool.query(`
        SELECT u.id, u.username, u.email, u.role, u.membership_tier, u.created_at,
               NULL::timestamptz AS last_login_at,
               0::int AS login_count
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT s.sid, s.expire,
               s.sess->>'userId' AS user_id,
               COALESCE(u.username, s.sess->>'username') AS username,
               COALESCE(u.email, s.sess->>'email') AS email,
               u.role,
               u.membership_tier
        FROM sessions s
        LEFT JOIN users u ON u.id::text = s.sess->>'userId'
        WHERE s.expire > NOW()
        ORDER BY s.expire DESC
        LIMIT 50
      `),
      loginEventsAvailable ? pool.query(`
        SELECT le.id, le.user_id,
               COALESCE(u.username, le.username) AS username,
               COALESCE(u.email, le.email) AS email,
               le.method, le.ip_address, le.country, le.user_agent, le.created_at
        FROM login_events le
        LEFT JOIN users u ON u.id = le.user_id
        ORDER BY le.created_at DESC
        LIMIT 50
      `) : Promise.resolve({ rows: [] }),
      pool.query(`
        SELECT u.id, u.username, u.email,
               COUNT(ls.id)::int AS live_session_count,
               MAX(ls.started_at) AS last_started_at,
               MAX(ls.updated_at) AS last_updated_at
        FROM live_sessions ls
        JOIN users u ON u.id = ls.user_id
        GROUP BY u.id
        ORDER BY live_session_count DESC, last_updated_at DESC
        LIMIT 10
      `),
      feedbackAvailable ? pool.query(`
        SELECT fm.id, fm.user_id, fm.reporter_username, fm.reporter_email,
               fm.contact_email, fm.message, fm.path, fm.status, fm.created_at
        FROM feedback_messages fm
        ORDER BY fm.created_at DESC
        LIMIT 10
      `) : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      summary: summaryResult.rows[0],
      usersByTier: usersByTierResult.rows,
      usersByRole: usersByRoleResult.rows,
      loginsByMethod: loginsByMethodResult.rows,
      recentUsers: recentUsersResult.rows,
      activeSessions: activeSessionsResult.rows,
      recentLoginEvents: recentLoginEventsResult.rows,
      topLiveUsers: topLiveUsersResult.rows,
      recentFeedback: recentFeedbackResult.rows,
    });
  } catch (err) {
    console.error('[admin] activity error:', err);
    res.status(500).json({ error: 'Failed to load admin activity' });
  }
});

app.get('/api/admin/promo-codes', requireDb, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pc.id, pc.code, pc.tier, pc.duration_days, pc.max_redemptions,
              pc.expires_at, pc.active, pc.created_at,
              COUNT(pr.id)::int AS redeemed_count
       FROM promo_codes pc
       LEFT JOIN promo_redemptions pr ON pr.promo_code_id = pc.id
       GROUP BY pc.id
       ORDER BY pc.created_at DESC`
    );
    res.json({ promoCodes: rows });
  } catch (err) {
    console.error('[promo] admin list error:', err);
    res.status(500).json({ error: 'Failed to load promo codes' });
  }
});

app.post('/api/admin/promo-codes', requireDb, requireAuth, requireAdmin, async (req, res) => {
  try {
    const code = normalizePromoCode(req.body?.code);
    const tier = normalizeUserTier(req.body?.tier);
    const durationDays = Number.parseInt(String(req.body?.durationDays ?? ''), 10);
    const maxRedemptionsRaw = req.body?.maxRedemptions;
    const maxRedemptions = maxRedemptionsRaw === null || maxRedemptionsRaw === undefined || maxRedemptionsRaw === ''
      ? null
      : Number.parseInt(String(maxRedemptionsRaw), 10);
    const expiresAtRaw = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt.trim() : '';
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

    if (!isValidPromoCode(code)) {
      return res.status(400).json({ error: 'Promo code must be 3–32 letters, numbers, hyphens, or underscores' });
    }
    if (!USER_TIERS.has(req.body?.tier)) {
      return res.status(400).json({ error: 'Promo tier must be user, gold, platinum, or diamond' });
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_PROMO_DURATION_DAYS) {
      return res.status(400).json({ error: `Duration must be 1–${MAX_PROMO_DURATION_DAYS} days` });
    }
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
      return res.status(400).json({ error: 'Max redemptions must be blank or at least 1' });
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: 'Expiration date is invalid' });
    }

    const { rows } = await pool.query(
      `INSERT INTO promo_codes (code, tier, duration_days, max_redemptions, expires_at, active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, code, tier, duration_days, max_redemptions, expires_at, active, created_at`,
      [code, tier, durationDays, maxRedemptions, expiresAt, req.session.userId]
    );
    res.status(201).json({ promoCode: { ...rows[0], redeemed_count: 0 } });
  } catch (err) {
    console.error('[promo] admin create error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Promo code already exists' });
    }
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

app.get('/api/admin/feedback', requireDb, requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureFeedbackSchema();
    const { rows } = await pool.query(
      `SELECT fm.id, fm.user_id, fm.reporter_username, fm.reporter_email,
              fm.contact_email, fm.message, fm.source, fm.path, fm.status,
              fm.read_at, fm.created_at,
              reader.username AS read_by_username
       FROM feedback_messages fm
       LEFT JOIN users reader ON reader.id = fm.read_by
       ORDER BY fm.created_at DESC
       LIMIT 100`
    );
    res.json({
      feedback: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        reporterUsername: row.reporter_username,
        reporterEmail: row.reporter_email,
        contactEmail: row.contact_email,
        message: row.message,
        source: row.source,
        path: row.path,
        status: row.status,
        readAt: row.read_at,
        readByUsername: row.read_by_username,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('[feedback] admin list error:', err);
    res.status(500).json({ error: 'Failed to load feedback inbox' });
  }
});

app.patch('/api/admin/feedback/:id', requireDb, requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureFeedbackSchema();
    const status = req.body?.status === 'read' ? 'read' : req.body?.status === 'new' ? 'new' : null;
    if (!status) {
      return res.status(400).json({ error: 'Status must be new or read' });
    }

    const { rows } = await pool.query(
      `UPDATE feedback_messages
       SET status = $1,
           read_at = CASE WHEN $1 = 'read' THEN COALESCE(read_at, NOW()) ELSE NULL END,
           read_by = CASE WHEN $1 = 'read' THEN $2 ELSE NULL END
       WHERE id = $3
       RETURNING id, status, read_at`,
      [status, req.session.userId, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Feedback message not found' });
    }
    res.json({ feedback: { id: rows[0].id, status: rows[0].status, readAt: rows[0].read_at } });
  } catch (err) {
    console.error('[feedback] admin update error:', err);
    res.status(500).json({ error: 'Failed to update feedback message' });
  }
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
      await ensureAsyncPokerActionConstraint(pool);
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
