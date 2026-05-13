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
