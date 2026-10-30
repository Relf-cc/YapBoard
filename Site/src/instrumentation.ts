// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/** Runs once when the server starts, before it takes requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { backfillRanks, checkBetaConfig, checkProductionConfig, resetUngrantedRoles, startRankingSweep } = await import('./lib/startup');
  checkProductionConfig();
  // Beta runs on a copy of real people's data, so the checks that keep it separate refuse to boot rather
  // than warn. A beta quietly sharing production's session cookie is worse than a beta that is down.
  const beta = checkBetaConfig();
  for (const w of beta.warn) console.error(`[beta] ${w}`);
  if (beta.fatal.length) {
    for (const f of beta.fatal) console.error(`[beta] ${f}`);
    throw new Error(`beta misconfigured: ${beta.fatal.join('; ')}`);
  }
  await backfillRanks().catch((e) => console.error('[votes] rank backfill failed', e));
  // A failure here shouldn't keep the site down; it's logged and the next start tries again.
  await resetUngrantedRoles().catch((e) => console.error('[roles] cleanup failed', e));
  startRankingSweep();
  const { sweepUploads } = await import('./lib/uploads');
  sweepUploads().then((n) => { if (n) console.log(`[uploads] swept ${n} orphaned upload${n === 1 ? '' : 's'}`); }).catch(() => {});
}
