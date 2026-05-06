import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[pool] DATABASE_URL not set — database features will be unavailable');
}

const needsSsl =
  process.env.NODE_ENV === 'production' ||
  connectionString?.includes('supabase.com') ||
  connectionString?.includes('sslmode=require');

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  ...(needsSsl && {
    ssl: { rejectUnauthorized: false },
  }),
});

pool.on('error', (err) => {
  console.error('[pool] Unexpected error on idle client:', err);
});

export default pool;
