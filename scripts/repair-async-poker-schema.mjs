import pool from '../db/pool.js';

const repairTables = [
  'notification_preferences',
  'in_app_notifications',
  'async_poker_games',
  'async_poker_game_players',
  'async_poker_npc_users',
  'async_poker_actions',
];

const repairSequences = [
  'in_app_notifications_id_seq',
  'async_poker_actions_id_seq',
];

const schemaSql = `
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                  INTEGER PRIMARY KEY,
  email_turn_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  discord_turn_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  discord_user_id          VARCHAR(64),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
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
  host_user_id            INTEGER NOT NULL,
  name                    VARCHAR(120) NOT NULL,
  table_size              INTEGER NOT NULL DEFAULT 6 CHECK (table_size BETWEEN 2 AND 9),
  turn_seconds            INTEGER NOT NULL DEFAULT 86400 CHECK (turn_seconds BETWEEN 5 AND 432000),
  status                  VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'finished')),
  current_player_user_id  INTEGER,
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
  game_id      UUID NOT NULL REFERENCES async_poker_games(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL,
  seat_index   INTEGER NOT NULL CHECK (seat_index BETWEEN 0 AND 8),
  stack_chips  INTEGER NOT NULL DEFAULT 1000 CHECK (stack_chips >= 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'folded', 'left')),
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  PRIMARY KEY (game_id, user_id),
  UNIQUE (game_id, seat_index)
);
CREATE INDEX IF NOT EXISTS idx_async_poker_players_user
  ON async_poker_game_players (user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS async_poker_npc_users (
  user_id    INTEGER PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS async_poker_actions (
  id           BIGSERIAL PRIMARY KEY,
  game_id      UUID NOT NULL REFERENCES async_poker_games(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL,
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
`;

async function snapshot() {
  const roleResult = await pool.query(
    `SELECT current_user,
            session_user,
            current_database(),
            current_schema(),
            has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public`
  );
  const { rows: relationRows } = await pool.query(
    `SELECT c.relname,
            c.relkind,
            c.relowner::regrole::text AS owner,
            c.relrowsecurity,
            c.relforcerowsecurity
     FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relname = ANY($1::text[])
     ORDER BY c.relkind, c.relname`,
    [[...repairTables, ...repairSequences]]
  );
  const relations = Object.fromEntries(
    relationRows.map((row) => [
      row.relname,
      {
        kind: row.relkind,
        owner: row.owner,
        rowSecurity: row.relrowsecurity,
        forceRowSecurity: row.relforcerowsecurity,
      },
    ])
  );
  const counts = {};
  for (const table of repairTables) {
    if (!relations[table]) {
      counts[table] = null;
      continue;
    }
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM public.${table}`);
    counts[table] = rows[0].count;
  }
  return { role: roleResult.rows[0], relations, counts };
}

try {
  const before = await snapshot();
  const populatedTables = repairTables.filter((table) => Number(before.counts[table] ?? 0) > 0);
  if (populatedTables.length > 0) {
    throw new Error(`Async poker repair aborted because tables contain rows: ${populatedTables.join(', ')}`);
  }
  await pool.query(schemaSql);
  const after = await snapshot();
  console.log(JSON.stringify({ ok: true, before, after }, null, 2));
} finally {
  await pool.end();
}
