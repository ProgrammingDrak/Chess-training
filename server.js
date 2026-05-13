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
