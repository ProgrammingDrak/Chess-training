ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

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
