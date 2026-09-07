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

// Which Postgres schema this app's tables live in. On a dedicated database this
// is just `public`. On the shared Supabase project (daily-command-center) the
// GTO tables live in their own `gto` schema so generic names (users, sessions,
// …) don't collide with the other apps. Set via DB_SCHEMA. We pin search_path
// through the libpq `options` startup parameter rather than a connect handler so
// it is applied before any query runs (no race) and survives the pooler.
const dbSchema = process.env.DB_SCHEMA?.trim() || 'public';
const searchPath = dbSchema === 'public' ? 'public' : `${dbSchema},public`;

const pool = new Pool({
  connectionString,
  options: `-c search_path=${searchPath}`,
  connectionTimeoutMillis: 5000,
  ...(needsSsl && {
    ssl: { rejectUnauthorized: false },
  }),
});

pool.on('error', (err) => {
  console.error('[pool] Unexpected error on idle client:', err);
});

export default pool;
