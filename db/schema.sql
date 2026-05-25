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
  membership_tier VARCHAR(20) NOT NULL DEFAULT 'diamond'
    CHECK (membership_tier IN ('user', 'gold', 'platinum', 'diamond')),
  is_npc        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(20) NOT NULL DEFAULT 'diamond',
  ADD COLUMN IF NOT EXISTS is_npc BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ALTER COLUMN membership_tier SET DEFAULT 'diamond';

UPDATE users
  SET membership_tier = 'diamond'
  WHERE membership_tier IS DISTINCT FROM 'diamond';

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

-- ── Login Events (admin activity/audit view) ────────────────────────────────
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
);
CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_user_created ON login_events (user_id, created_at DESC);

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

-- ── Async Poker (hosted social turn-based games) ────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_turn_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  discord_turn_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  discord_user_id          VARCHAR(64),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(60) NOT NULL,
  title       VARCHAR(160) NOT NULL,
  body        TEXT NOT NULL,
  action_path VARCHAR(500),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE in_app_notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_created
  ON in_app_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread
  ON in_app_notifications (user_id, read_at)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS async_poker_games (
  id                      UUID PRIMARY KEY,
  host_user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                    VARCHAR(120) NOT NULL,
  table_size              INTEGER NOT NULL DEFAULT 6 CHECK (table_size BETWEEN 2 AND 9),
  turn_seconds            INTEGER NOT NULL DEFAULT 86400 CHECK (turn_seconds BETWEEN 5 AND 432000),
  status                  VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'finished')),
  current_player_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  current_turn_started_at TIMESTAMPTZ,
  current_turn_expires_at TIMESTAMPTZ,
  hand_number             INTEGER NOT NULL DEFAULT 1,
  pot_chips               INTEGER NOT NULL DEFAULT 0 CHECK (pot_chips >= 0),
  small_blind_chips       INTEGER NOT NULL DEFAULT 10 CHECK (small_blind_chips > 0),
  big_blind_chips         INTEGER NOT NULL DEFAULT 20 CHECK (big_blind_chips > 0),
  state                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_async_poker_games_status_updated
  ON async_poker_games (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_async_poker_games_current_player
  ON async_poker_games (current_player_user_id, current_turn_expires_at);

CREATE TABLE IF NOT EXISTS async_poker_game_players (
  game_id     UUID NOT NULL REFERENCES async_poker_games(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_index  INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 8),
  stack_chips INTEGER NOT NULL DEFAULT 1000 CHECK (stack_chips >= 0),
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'folded', 'left')),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  PRIMARY KEY (game_id, user_id),
  UNIQUE (game_id, seat_index)
);
CREATE INDEX IF NOT EXISTS idx_async_poker_players_user
  ON async_poker_game_players (user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS async_poker_actions (
  id           BIGSERIAL PRIMARY KEY,
  game_id      UUID NOT NULL REFERENCES async_poker_games(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hand_number  INTEGER NOT NULL DEFAULT 1,
  action       VARCHAR(20) NOT NULL
    CHECK (action IN ('check', 'call', 'bet', 'raise', 'fold', 'pass', 'timeout', 'join', 'start', 'end', 'ready_next', 'show')),
  street       VARCHAR(20) NOT NULL DEFAULT 'preflop'
    CHECK (street IN ('preflop', 'flop', 'turn', 'river')),
  amount_chips INTEGER CHECK (amount_chips IS NULL OR amount_chips >= 0),
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE async_poker_actions
  ADD COLUMN IF NOT EXISTS hand_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE async_poker_actions
  ADD COLUMN IF NOT EXISTS street VARCHAR(20) NOT NULL DEFAULT 'preflop';
ALTER TABLE async_poker_actions
  DROP CONSTRAINT IF EXISTS async_poker_actions_action_check;
ALTER TABLE async_poker_actions
  ADD CONSTRAINT async_poker_actions_action_check
  CHECK (action IN ('check', 'call', 'bet', 'raise', 'fold', 'pass', 'timeout', 'join', 'start', 'end', 'ready_next', 'show'));
DO $$
BEGIN
  ALTER TABLE async_poker_actions
    ADD CONSTRAINT async_poker_actions_street_check
    CHECK (street IN ('preflop', 'flop', 'turn', 'river'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_async_poker_actions_game_created
  ON async_poker_actions (game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_async_poker_actions_game_hand_created
  ON async_poker_actions (game_id, hand_number DESC, created_at DESC);

-- ── Feedback inbox ──────────────────────────────────────────────────────────
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
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_status_created
  ON feedback_messages (status, created_at DESC);
