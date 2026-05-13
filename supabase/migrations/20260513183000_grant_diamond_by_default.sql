ALTER TABLE users
  ALTER COLUMN membership_tier SET DEFAULT 'diamond';

UPDATE users
  SET membership_tier = 'diamond'
  WHERE membership_tier IS DISTINCT FROM 'diamond';
