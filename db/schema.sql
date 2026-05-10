-- GTO Trainer — PostgreSQL Schema
-- Run on first start; all statements are idempotent (CREATE … IF NOT EXISTS).

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(30) UNIQUE NOT NULL,
  email         VARCHAR(254),
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  membership_tier VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (membership_tier IN ('user', 'gold', 'platinum', 'diamond')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(20) NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_membership_tier_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_membership_tier_check
      CHECK (membership_tier IN ('user', 'gold', 'platinum', 'diamond'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_unique
      UNIQUE (email);
  END IF;
END $$;

-- ── Promotional tier codes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(64) UNIQUE NOT NULL,
  tier            VARCHAR(20) NOT NULL
    CHECK (tier IN ('user', 'gold', 'platinum', 'diamond')),
  duration_days   INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 3650),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  tier          VARCHAR(20) NOT NULL
    CHECK (tier IN ('user', 'gold', 'platinum', 'diamond')),
  redeemed_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, promo_code_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user_active
  ON promo_redemptions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code
  ON promo_codes (code);

-- ── Sessions (connect-pg-simple) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);

-- ── Profiles (poker range / strategy profiles) ───────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 VARCHAR(100) NOT NULL,
  type                 VARCHAR(50)  NOT NULL DEFAULT 'poker',
  table_size           INTEGER CHECK (table_size BETWEEN 2 AND 9),
  range_data           JSONB,
  postflop_thresholds  JSONB,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Hand History (future — no UI yet) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hand_history (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  played_at   TIMESTAMPTZ DEFAULT NOW(),
  game_type   VARCHAR(50),
  position    VARCHAR(20),
  hero_cards  JSONB,
  board       JSONB,
  actions     JSONB,
  result_bb   NUMERIC,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scenarios (future — no UI yet) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenarios (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(200) NOT NULL,
  game_type      VARCHAR(50),
  scenario_data  JSONB,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bankroll (future — no UI yet) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bankroll (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  amount      NUMERIC NOT NULL,
  game_type   VARCHAR(50),
  stakes      VARCHAR(50),
  notes       TEXT
);

-- ── Live Sessions (in-person poker session tracker) ──────────────────────────
-- One row per session.  client_id is a UUID generated by the browser at
-- session creation; server upserts on this so two devices working offline
-- never overwrite each other.  The full session blob (seats, hands, etc.)
-- lives in `data` as JSONB — schema is defined client-side in
-- src/types/liveSession.ts.
CREATE TABLE IF NOT EXISTS live_sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   UUID UNIQUE NOT NULL,
  name        VARCHAR(200),
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  table_size  INTEGER NOT NULL CHECK (table_size BETWEEN 2 AND 9),
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_user ON live_sessions (user_id, started_at DESC);
