if (process.env.NODE_ENV !== 'production') {
  console.log('[async-poker-repair] skipped outside production build');
} else {
  await import('./repair-async-poker-schema.mjs');
}
