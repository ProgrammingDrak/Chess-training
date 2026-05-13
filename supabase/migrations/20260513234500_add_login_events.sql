-- Capture successful signups/logins for the admin activity dashboard.

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

CREATE INDEX IF NOT EXISTS idx_login_events_created
  ON login_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_events_user_created
  ON login_events (user_id, created_at DESC);
