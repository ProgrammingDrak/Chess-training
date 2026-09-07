import { afterEach, expect, test, vi } from 'vitest';

let pool;

afterEach(async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
  delete process.env.DATABASE_URL;
  delete process.env.DB_SCHEMA;
  vi.resetModules();
});

const databaseTest = process.env.TEST_DATABASE_URL ? test : test.skip;

databaseTest('routes unqualified queries through the configured schema', async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DB_SCHEMA = 'gto';
  ({ default: pool } = await import('./pool.js'));

  await pool.query('CREATE SCHEMA gto');
  await pool.query('CREATE TABLE public.search_path_probe (source text NOT NULL)');
  await pool.query('CREATE TABLE gto.search_path_probe (source text NOT NULL)');
  await pool.query("INSERT INTO public.search_path_probe VALUES ('public')");
  await pool.query("INSERT INTO gto.search_path_probe VALUES ('gto')");

  const path = await pool.query('SHOW search_path');
  const probe = await pool.query('SELECT source FROM search_path_probe');

  expect(path.rows[0].search_path.replaceAll(' ', '')).toBe('gto,public');
  expect(probe.rows).toEqual([{ source: 'gto' }]);
});
