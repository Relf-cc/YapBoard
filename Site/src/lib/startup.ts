// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
// No 'server-only' here (or env.ts, which has it): this runs from instrumentation.ts at server start.
import { db } from './db';

/**
 * Logins used to save STAFF_IDS as an ADMIN role, and it stayed after the ID was taken out of STAFF_IDS. Now a
 * saved role only stands if the portal's Users page set it (every change there is in the audit log as role.*);
 * anything else goes back to USER. STAFF_IDS themselves are applied live by getUser and never saved.
 */
/** Missing, too short, or still the example value. Shared by both checks below. */
const weak = (s: string | undefined, min: number) => !s || s.length < min || /change-me/i.test(s);

/** Loud warnings at start for production settings that leave something unsafe or broken. */
export function checkProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const problems = [
    weak(process.env.SESSION_SECRET, 32) && 'SESSION_SECRET is missing, short or the example value: nobody can log in',
    weak(process.env.INTERNAL_API_SECRET, 16) && 'INTERNAL_API_SECRET is missing, short or the example value: the bot is locked out',
    !(process.env.YAPIN_CLIENT_ID && process.env.YAPIN_CLIENT_SECRET) && 'YAPIN_CLIENT_ID / YAPIN_CLIENT_SECRET not set: login is off',
    !process.env.YAPPER_BOT_TOKEN && 'YAPPER_BOT_TOKEN not set: nobody can add servers (owners and admins can’t be checked)',
    !/^https:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL || '') && 'NEXT_PUBLIC_SITE_URL is not https://',
  ].filter(Boolean);
  for (const p of problems) console.error(`[config] ${p}`);
}

/**
 * Beta-only configuration that must be wrong-proof, because getting it wrong is silent.
 *
 * Returns the problems rather than logging them, so the caller can decide: the cookie one is fatal and the
 * rest are warnings. See src/lib/beta.ts for what beta mode is and why.
 */
export function checkBetaConfig(): { fatal: string[]; warn: string[] } {
  const fatal: string[] = [];
  const warn: string[] = [];
  if (!process.env.NEXT_PUBLIC_BETA_VERSION) return { fatal, warn };

  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const cookieDomain = (process.env.COOKIE_DOMAIN || '').trim();

  /*
    The one that has to stop the boot.

    A cookie scoped to `.yapboard.dev` is sent to yapboard.dev as well, so beta and production would share
    a session: one login, both sites, and a staff cookie minted on a copy of the database working against
    the real one. That is not a beta with "no connection to production" - it is the same site twice. Beta
    must set a host-only cookie, which is what an empty COOKIE_DOMAIN does.
  */
  if (cookieDomain) {
    fatal.push(`COOKIE_DOMAIN is set to "${cookieDomain}" - leave it empty on beta, or beta and production share one session cookie`);
  }

  // A beta pointed at the production database is the other way to join them, and the default path is the
  // same on both stacks, so this is worth saying out loud even though compose sets the volume.
  if (!/beta/i.test(process.env.DATABASE_URL || '')) {
    warn.push(`DATABASE_URL does not look like a beta database ("${process.env.DATABASE_URL || 'unset'}") - make sure it is a copy, not production`);
  }
  if (!/beta/i.test(site)) warn.push(`NEXT_PUBLIC_SITE_URL is "${site}" - expected the beta host`);
  if (process.env.STRIPE_SECRET_KEY) warn.push('STRIPE_SECRET_KEY is set on beta - leave Stripe unconfigured so billing routes answer 503');
  // Nothing here can see production's secret to compare against it, so this only checks the shape. The
  // real rule - a *different* secret from production, so copied Session rows and real cookies are both
  // useless on beta - is in docs/beta.md, because only the person deploying can know it holds.
  if (weak(process.env.SESSION_SECRET, 32)) warn.push('SESSION_SECRET is missing or short - beta needs its own, different from production');
  return { fatal, warn };
}

/** Servers listed before voting existed have no rankedAt yet (lib/votes.ts), and would drop out of "recently bumped". */
export async function backfillRanks() {
  await db.$executeRaw`UPDATE "Server" SET "rankedAt" = COALESCE("bumpedAt", "createdAt") WHERE "rankedAt" IS NULL`;
}

export async function resetUngrantedRoles() {
  const staffIds = (process.env.STAFF_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  console.log(`[roles] STAFF_IDS: ${staffIds.length ? staffIds.join(', ') : '(none)'}`);

  // Dev login saves the role it's given ("staff" ticked), with no audit entry. Leave dev databases alone.
  const devLogin = !(process.env.YAPIN_CLIENT_ID && process.env.YAPIN_CLIENT_SECRET) && process.env.NODE_ENV !== 'production';
  if (devLogin) return;

  const users = await db.user.findMany({
    where: { role: { not: 'USER' }, id: { notIn: staffIds } },
    select: { id: true, username: true, role: true },
  });
  for (const u of users) {
    const last = await db.auditLog.findFirst({
      where: { targetType: 'user', targetId: u.id, action: { startsWith: 'role.' } },
      orderBy: { id: 'desc' },
      select: { action: true },
    });
    const granted = last ? last.action.slice('role.'.length).toUpperCase() : 'USER';
    if (granted === u.role) continue;
    await db.user.update({ where: { id: u.id }, data: { role: granted } });
    console.log(`[roles] @${u.username} (${u.id}): ${u.role} -> ${granted} (not in STAFF_IDS, not granted in the portal)`);
  }
}

/**
 * The nightly rebuild of every engagement score, plus one on start.
 *
 * It exists as a backstop rather than as the thing that keeps the ranking alive: `hotScore` is anchored to
 * a fixed epoch and never decayed in storage, so the ordering stays correct between rebuilds on its own
 * (src/lib/engagement.ts). What this catches is drift - a call site somebody forgot, a plan that lapsed
 * quietly, a cap that now bites differently after a settings change. Any of those is gone by morning.
 *
 * That a full rebuild is both affordable and always safe is the property worth keeping. It is what makes
 * the incremental paths safe to be occasionally wrong.
 */
export function startRankingSweep() {
  const DAY = 24 * 60 * 60_000;
  const run = async () => {
    const { refreshAllHot } = await import('./engagement');
    const { listings } = await refreshAllHot();
    if (listings) console.log(`[ranking] rebuilt ${listings} score${listings === 1 ? '' : 's'}`);
  };
  // Once now, so a listing added while the process was down is scored, then once a day.
  void run().catch((e) => console.error('[ranking] rebuild failed', e));
  const timer = setInterval(() => void run().catch((e) => console.error('[ranking] rebuild failed', e)), DAY);
  // Never hold the process open for it.
  timer.unref?.();
  return timer;
}
