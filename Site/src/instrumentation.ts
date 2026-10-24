/** Runs once when the server starts, before it takes requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { checkProductionConfig, resetUngrantedRoles } = await import('./lib/startup');
  checkProductionConfig();
  // A failure here shouldn't keep the site down; it's logged and the next start tries again.
  await resetUngrantedRoles().catch((e) => console.error('[roles] cleanup failed', e));
}
