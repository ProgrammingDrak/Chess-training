-- GTO Trainer — PostgreSQL Schema
-- Initial Supabase migration for app-owned auth/session/profile/session data.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(30) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);

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

CREATE TABLE IF NOT EXISTS bankroll (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  amount      NUMERIC NOT NULL,
  game_type   VARCHAR(50),
  stakes      VARCHAR(50),
  notes       TEXT
);

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
