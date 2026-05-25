ALTER TABLE async_poker_actions
  ADD COLUMN IF NOT EXISTS hand_number INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_async_poker_actions_game_hand_created
  ON async_poker_actions (game_id, hand_number DESC, created_at DESC);
