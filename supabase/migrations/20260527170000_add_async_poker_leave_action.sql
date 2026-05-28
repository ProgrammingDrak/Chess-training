ALTER TABLE async_poker_actions
  DROP CONSTRAINT IF EXISTS async_poker_actions_action_check;

ALTER TABLE async_poker_actions
  ADD CONSTRAINT async_poker_actions_action_check
  CHECK (action IN ('check', 'call', 'bet', 'raise', 'fold', 'pass', 'timeout', 'join', 'leave', 'start', 'end', 'ready_next', 'show'));
