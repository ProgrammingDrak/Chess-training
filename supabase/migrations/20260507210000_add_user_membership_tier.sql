ALTER TABLE users
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
