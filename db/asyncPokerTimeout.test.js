import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import pg from 'pg';
import { afterEach, expect, test } from 'vitest';

const { Pool } = pg;
const databaseTest = process.env.TEST_DATABASE_URL ? test : test.skip;
const TEST_SCHEMA = 'gto_timeout_test';

let child;
let adminPool;
let schemaPool;

async function availablePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForServer(baseUrl, output) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const health = await response.json();
      if (response.ok && health.db === 'connected') return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready.\n${output.join('')}`);
}

async function request(baseUrl, path, { cookie, method = 'GET', body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

afterEach(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  child = undefined;

  if (schemaPool) await schemaPool.end();
  schemaPool = undefined;

  if (adminPool) {
    await adminPool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await adminPool.end();
  }
  adminPool = undefined;
});

databaseTest('auto-folds one expired turn during concurrent refreshes', { timeout: 30_000 }, async () => {
  adminPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await adminPool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  await adminPool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);

  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      DB_SCHEMA: TEST_SCHEMA,
      NODE_ENV: 'test',
      PORT: String(port),
      SESSION_SECRET: 'async-poker-timeout-test-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));
  await waitForServer(baseUrl, output);

  schemaPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${TEST_SCHEMA},public`,
  });

  const register = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { username: 'timeout-host', password: 'test-password' },
  });
  expect(register.status, output.join('')).toBe(201);
  const registered = await register.json();
  const cookie = register.headers.get('set-cookie')?.split(';')[0];
  expect(cookie).toBeTruthy();

  const create = await request(baseUrl, '/api/async-poker/games', {
    cookie,
    method: 'POST',
    body: { name: 'Timeout test', tableSize: 2, turnSeconds: 60 },
  });
  expect(create.status, output.join('')).toBe(201);
  const { game } = await create.json();

  const addNpc = await request(baseUrl, `/api/async-poker/games/${game.id}/npcs`, {
    cookie,
    method: 'POST',
    body: { name: 'timeout-npc' },
  });
  expect(addNpc.status, output.join('')).toBe(200);

  const start = await request(baseUrl, `/api/async-poker/games/${game.id}/start`, {
    cookie,
    method: 'POST',
  });
  expect(start.status, output.join('')).toBe(200);

  const before = await schemaPool.query(
    `SELECT current_player_user_id, hand_number
     FROM async_poker_games
     WHERE id = $1`,
    [game.id]
  );
  expect(before.rows[0].current_player_user_id).toBe(registered.user.id);
  const expiredHand = before.rows[0].hand_number;

  await schemaPool.query(
    `UPDATE async_poker_games
     SET current_turn_expires_at = NOW() - INTERVAL '1 second'
     WHERE id = $1`,
    [game.id]
  );

  const responses = await Promise.all([
    request(baseUrl, '/api/async-poker/games', { cookie }),
    request(baseUrl, '/api/async-poker/games', { cookie }),
  ]);
  expect(responses.map((response) => response.status), output.join('')).toEqual([200, 200]);

  const timeoutActions = await schemaPool.query(
    `SELECT user_id, hand_number
     FROM async_poker_actions
     WHERE game_id = $1 AND action = 'timeout'`,
    [game.id]
  );
  expect(timeoutActions.rows).toEqual([{
    user_id: registered.user.id,
    hand_number: expiredHand,
  }]);

  const advanced = await schemaPool.query(
    `SELECT current_player_user_id, current_turn_expires_at, hand_number
     FROM async_poker_games
     WHERE id = $1`,
    [game.id]
  );
  expect(advanced.rows[0].current_player_user_id).toBe(registered.user.id);
  expect(advanced.rows[0].hand_number).toBe(expiredHand + 1);
  expect(new Date(advanced.rows[0].current_turn_expires_at).getTime()).toBeGreaterThan(Date.now());

  const thirdRefresh = await request(baseUrl, '/api/async-poker/games', { cookie });
  expect(thirdRefresh.status, output.join('')).toBe(200);
  const finalCount = await schemaPool.query(
    `SELECT COUNT(*)::int AS count
     FROM async_poker_actions
     WHERE game_id = $1 AND action = 'timeout'`,
    [game.id]
  );
  expect(finalCount.rows[0].count).toBe(1);
});
