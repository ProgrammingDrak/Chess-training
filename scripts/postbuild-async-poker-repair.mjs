if (!process.env.DATABASE_URL) {
  console.log('[async-poker-repair] skipped because DATABASE_URL is not set');
} else {
  await import('./repair-async-poker-schema.mjs');
}
