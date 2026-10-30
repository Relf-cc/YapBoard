// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Turn a copy of the production database into a beta database.
 *
 *   node scripts/beta-snapshot.mjs --from /data/yapboard.db --db /data/yapboard-beta.db
 *   node scripts/beta-snapshot.mjs --db /data/yapboard-beta.db          # scrub a copy you already have
 *   node scripts/beta-snapshot.mjs --db ... --dry                       # say what it would do
 *
 * ## What this is for
 *
 * The beta is only worth running on real data - an empty board tests nothing, and the new ranking in
 * particular cannot be judged against a handful of seeded servers. But every row in that copy names
 * somebody who never asked to be in a test, so the copy has to be defused before it is served.
 *
 * Two rules decide what happens to each table:
 *
 * 1. **Anything that could act on the real world is removed.** Sessions, API keys, Stripe customer links,
 *    queued messages. Not because they would obviously fire, but because the whole point of a beta is
 *    that somebody is about to press buttons nobody has pressed before.
 * 2. **Everything that makes the board look like the board is kept.** Servers, bots, clients, their
 *    owners, badges, tags, bumps, votes, uploads, and the Pro subscriptions - the last of those because a
 *    Pro listing that is not Pro on beta makes the one perk that touches ranking untestable.
 *
 * ## Why there is no Prisma in here
 *
 * This runs *before* the beta exists: on a server with no Node installed, against a database no app has
 * opened yet, from a checkout with no `node_modules` - and the runtime image does not carry `scripts/`
 * either. An ops tool that needs the application's dependencies is one that cannot be run when it is
 * needed. `node:sqlite` has shipped with Node since 22.5, so this needs nothing but a Node binary:
 *
 *   docker run --rm -v /srv/YapBoard-beta:/w -w /w node:24-bookworm-slim \
 *     node Site/scripts/beta-snapshot.mjs --db /w/yapboard-beta.db
 *
 * It is safe to run twice, and it refuses to touch a database whose path does not look like a beta one -
 * pointed at production, it would delete every session on the real board.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const DRY = args.includes('--dry');
/** Accepts a bare path or Prisma's `file:` form, since both are lying around in this project. */
const path = (v) => (v ? v.replace(/^file:/, '') : null);
const target = path(flag('db') || process.env.DATABASE_URL);
const source = path(flag('from'));

if (!target) {
  console.error('Usage: node scripts/beta-snapshot.mjs [--from <prod.db>] --db <beta.db> [--dry]');
  process.exit(1);
}

/**
 * The guard that matters.
 *
 * This deletes every session and every API key in whatever database it is pointed at. Pointed at
 * production by a tired person at the wrong hour, that is an outage and a pile of support tickets. So the
 * path has to say "beta" out loud, and `--force` is deliberately not offered - renaming a file is a
 * thirty-second job and a far better one than teaching this script to override itself.
 */
if (!/beta/i.test(target)) {
  console.error(`Refusing to run: "${target}" does not look like a beta database.`);
  console.error('Name the copy something with "beta" in it, and point this at the copy.');
  process.exit(1);
}

/**
 * Take the copy, if asked to.
 *
 * `VACUUM INTO` rather than `cp`, because production is still running: SQLite can be mid-write when a
 * plain file copy reads it, and in WAL mode the file on disk is not the whole database anyway - so a
 * copied `.db` can arrive subtly inconsistent, which is the worst failure available here because it looks
 * like it worked. `VACUUM INTO` is one statement, needs no downtime, and writes a single consistent file.
 *
 * It refuses to overwrite. That is deliberate: the beta database accumulates beta-only reviews, and
 * quietly replacing it would throw away the thing the beta exists to produce.
 */
function snapshot(from, to) {
  if (!existsSync(from)) {
    console.error(`No database at ${from}.`);
    process.exit(1);
  }
  if (existsSync(to)) {
    console.error(`Refusing to overwrite ${to}.`);
    console.error('Delete it first if you really want a fresh copy - it holds every review written on beta.');
    process.exit(1);
  }
  let src;
  try {
    src = new DatabaseSync(from, { readOnly: true });
    // A path, not a value, and VACUUM takes no parameters - so quoted and escaped by hand.
    src.exec(`VACUUM INTO '${to.replace(/'/g, "''")}'`);
    console.log(`Copied ${from} -> ${to}`);
  } catch (e) {
    if (existsSync(to)) unlinkSync(to);
    console.error(`Could not copy the database: ${e.message}`);
    process.exit(1);
  } finally {
    src?.close();
  }
}

/** Each step: what it clears, and why leaving it would be a mistake. Printed as it runs. */
const steps = [
  {
    what: 'sessions',
    why: 'a copied session plus a shared cookie domain would be one login across both sites',
    sql: ['DELETE FROM "Session"'],
  },
  {
    what: 'platform API keys',
    why: 'a partner bot pointed at beta would otherwise authenticate with its real key',
    sql: ['DELETE FROM "PlatformKey"'],
  },
  {
    what: 'platform usage and outcomes',
    why: "beta traffic would be mixed into a developer's real call history",
    sql: ['DELETE FROM "PlatformOutcome"', 'DELETE FROM "PlatformUsage"'],
  },
  {
    what: 'queued bot DMs',
    why: 'these are addressed to real accounts; beta starts empty so only beta-made ones exist',
    sql: ['DELETE FROM "BotDm"'],
  },
  {
    what: 'broadcasts and their deliveries',
    why: 'addressed to channel ids in real servers',
    sql: ['DELETE FROM "BroadcastDelivery"', 'DELETE FROM "Broadcast"'],
  },
  {
    what: 'Stripe customer links',
    why: 'nothing on beta should be able to resolve an account to a real Stripe customer',
    sql: ['UPDATE "User" SET "stripeCustomerId" = NULL WHERE "stripeCustomerId" IS NOT NULL'],
  },
  {
    what: 'billing consents, alerts and webhook history',
    why: 'evidence records belong to the real sale, and a replayed event id must not read as handled here',
    sql: ['DELETE FROM "BillingConsent"', 'DELETE FROM "BillingAlert"', 'DELETE FROM "StripeEvent"'],
  },
  {
    what: 'announcements',
    why: 'a notice about the real board is confusing on a copy of it, and beta has its own bar',
    // Children first: foreign keys may or may not be enforced here, and this works either way.
    sql: ['DELETE FROM "AnnouncementSeen"', 'DELETE FROM "Announcement"'],
  },
  {
    what: 'the ranking and review settings',
    why: 'beta is where these get tuned, so it starts from the defaults in code rather than production values',
    sql: [`DELETE FROM "Setting" WHERE "key" IN ('ranking', 'comments')`],
  },
];

/** Kept on purpose, said out loud - a reader should not have to diff the list above against the schema. */
const KEPT = [
  ['servers, bots and clients', 'the board is the point'],
  ['users, badges and tags', 'listings need owners, and badges are what the cards draw'],
  ['bumps and votes', 'the ranking has nothing to measure without them'],
  ['uploads', 'the images listings point at live in the database'],
  ['Pro subscriptions and assignments', 'so Pro listings are Pro, and the ranking boost is testable'],
  ['reports', 'the staff queue is one of the things being tested'],
  ['co-managers', 'the Team badge on a comment needs somebody to hold it'],
];

if (source) {
  if (DRY) console.log(`Would copy ${source} -> ${target}`);
  else snapshot(source, target);
}

if (!existsSync(target)) {
  console.error(`No database at ${target}. Pass --from to take a copy first.`);
  process.exit(1);
}

const db = new DatabaseSync(target);
try {
  console.log(`\nBeta snapshot: ${target}${DRY ? '  (dry run - nothing will be written)' : ''}\n`);

  const count = (table) => {
    try {
      return db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
    } catch {
      return 0;
    }
  };
  console.log(`Found ${count('Server')} servers, ${count('User')} users, ${count('Comment')} comments.\n`);

  let total = 0;
  for (const step of steps) {
    if (DRY) {
      console.log(`  would clear  ${step.what}`);
      console.log(`               ${step.why}`);
      continue;
    }
    let n = 0;
    for (const sql of step.sql) {
      try {
        n += db.prepare(sql).run().changes;
      } catch (e) {
        // A table that is not there yet (an older snapshot, a schema never pushed) is not a failure: the
        // point is that the rows are gone, and a missing table has no rows.
        if (!/no such table/i.test(e.message)) throw e;
      }
    }
    total += n;
    console.log(`  cleared ${String(n).padStart(6)}  ${step.what}`);
  }

  console.log(`\n${DRY ? 'Would keep' : 'Kept'}:`);
  for (const [what, why] of KEPT) console.log(`  ${what.padEnd(34)} ${why}`);

  if (!DRY) {
    console.log(`\nDone. ${total} rows cleared.`);
    console.log('\nStill to do by hand, because only you can:');
    console.log('  - give the beta stack its own SESSION_SECRET (different from production)');
    console.log('  - leave COOKIE_DOMAIN empty (the site refuses to start otherwise)');
    console.log('  - leave the six STRIPE_* variables unset');
    console.log('  - give the beta bot its own Yapin’ token, invited only to a server you own');
    console.log('  - add https://beta.yapboard.dev/api/auth/callback to the Yapin’ OAuth app');
  }
} catch (e) {
  console.error('\nFailed:', e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
