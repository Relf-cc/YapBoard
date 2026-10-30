// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Turn a copy of the production database into a beta database.
 *
 *   node scripts/beta-snapshot.mjs --from file:/data/yapboard.db --db file:/data/yapboard-beta.db
 *   node scripts/beta-snapshot.mjs --db file:/data/yapboard-beta.db          # scrub a copy you already have
 *   node scripts/beta-snapshot.mjs --db ... --dry                           # say what it would do
 *
 * ## What this is for
 *
 * The beta is only worth running on real data - an empty board tests nothing, and the new ranking in
 * particular cannot be judged against ten seeded servers. But every row in that copy names somebody who
 * never asked to be in a test, so the copy has to be defused before it is served.
 *
 * Two rules decide what happens to each table:
 *
 * 1. **Anything that could act on the real world is removed.** Sessions, API keys, Stripe customer links,
 *    queued messages. Not because they would obviously fire, but because the whole point of a beta is that
 *    somebody is about to press buttons nobody has pressed before.
 * 2. **Everything that makes the board look like the board is kept.** Servers, bots, clients, their
 *    owners, badges, tags, bumps, votes, uploads, and the Pro subscriptions - the last of those because a
 *    Pro listing that is not Pro on beta makes the one perk that touches ranking untestable.
 *
 * It is written to be safe to run twice, and it refuses to touch a database whose path does not look like
 * a beta one - running it against production would delete every session on the real board.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const DRY = args.includes('--dry');
const url = flag('db') || process.env.DATABASE_URL;
const from = flag('from');

if (!url) {
  console.error('Usage: node scripts/beta-snapshot.mjs --db file:/data/yapboard-beta.db [--dry]');
  process.exit(1);
}

/**
 * The guard that matters.
 *
 * This script deletes every session and every API key in whatever database it is pointed at. Pointed at
 * production by a tired person at the wrong hour, that is an outage and a pile of support tickets. So the
 * path has to say "beta" out loud, and `--force` is deliberately not offered - renaming the file is a
 * thirty-second job and a much better one than teaching this script to override itself.
 */
if (!/beta/i.test(url)) {
  console.error(`Refusing to run: "${url}" does not look like a beta database.`);
  console.error('Copy production first, name the copy something with "beta" in it, and point this at the copy.');
  process.exit(1);
}

const fileOf = (u) => u.replace(/^file:/, '');

/**
 * Take the copy, if asked to.
 *
 * `VACUUM INTO` rather than `cp`, because the production site is still running: SQLite can be mid-write when
 * a plain file copy reads it, and in WAL mode the file on disk is not the whole database anyway - so a
 * copied `.db` can arrive subtly inconsistent, which is the worst failure available here because it looks
 * like it worked. `VACUUM INTO` is one statement, needs no downtime, and writes a single consistent file.
 *
 * Through `node:sqlite` rather than Prisma: Prisma’s SQLite driver refuses the statement outright
 * (SQLITE_CANTOPEN on any target), and Node has shipped a SQLite module since 22.5 - so this needs no
 * sqlite3 binary in the image either.
 *
 * It refuses to overwrite. That is deliberate: the beta database accumulates beta-only reviews, and
 * quietly replacing it would throw away the thing the beta exists to produce.
 */
function snapshot(sourceUrl, targetUrl) {
  const source = fileOf(sourceUrl);
  const target = fileOf(targetUrl);
  if (!existsSync(source)) {
    console.error(`No database at ${source}.`);
    process.exit(1);
  }
  if (existsSync(target)) {
    console.error(`Refusing to overwrite ${target}.`);
    console.error('Delete it first if you really want a fresh copy - it holds every review written on beta.');
    process.exit(1);
  }
  let src;
  try {
    src = new DatabaseSync(source, { readOnly: true });
    // A path, not a value, and VACUUM takes no parameters - so quoted and escaped by hand.
    src.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    console.log(`Copied ${source} -> ${target}`);
  } catch (e) {
    if (existsSync(target)) unlinkSync(target);
    console.error(`Could not copy the database: ${e.message}`);
    process.exit(1);
  } finally {
    src?.close();
  }
}

if (from) {
  if (DRY) console.log(`Would copy ${fileOf(from)} -> ${fileOf(url)}`);
  else snapshot(from, url);
}

const db = new PrismaClient({ datasources: { db: { url } } });

/** Each step: what it does, and why it is safe or necessary. Printed as it runs. */
const steps = [
  {
    what: 'sessions',
    why: 'a copied session plus a shared cookie domain would be one login across both sites',
    run: () => db.session.deleteMany({}),
  },
  {
    what: 'platform API keys',
    why: 'a partner bot pointed at beta would otherwise authenticate with its real key',
    run: () => db.platformKey.deleteMany({}),
  },
  {
    what: 'platform usage and outcomes',
    why: 'beta traffic would be mixed into a developer’s real call history',
    run: async () => {
      const a = await db.platformUsage.deleteMany({});
      const b = await db.platformOutcome.deleteMany({});
      return { count: a.count + b.count };
    },
  },
  {
    what: 'queued bot DMs',
    why: 'these are addressed to real accounts; beta starts with an empty queue so only beta-made ones exist',
    run: () => db.botDm.deleteMany({}),
  },
  {
    what: 'broadcasts and their deliveries',
    why: 'addressed to channel ids in real servers',
    run: async () => {
      const a = await db.broadcastDelivery.deleteMany({});
      const b = await db.broadcast.deleteMany({});
      return { count: a.count + b.count };
    },
  },
  {
    what: 'Stripe customer links',
    why: 'nothing on beta should be able to resolve an account to a real Stripe customer',
    run: () => db.user.updateMany({ where: { stripeCustomerId: { not: null } }, data: { stripeCustomerId: null } }),
  },
  {
    what: 'billing consents, alerts and webhook history',
    why: 'evidence records belong to the real sale, and a replayed event id must not be marked handled here',
    run: async () => {
      const a = await db.billingConsent.deleteMany({});
      const b = await db.billingAlert.deleteMany({});
      const c = await db.stripeEvent.deleteMany({});
      return { count: a.count + b.count + c.count };
    },
  },
  {
    what: 'announcements',
    why: 'a notice about the real board is confusing on a copy of it, and beta has its own bar',
    run: () => db.announcement.deleteMany({}),
  },
  {
    what: 'the ranking and review settings',
    why: 'beta is where these get tuned, so it starts from the defaults in code rather than production’s values',
    run: () => db.setting.deleteMany({ where: { key: { in: ['ranking', 'comments'] } } }),
  },
];

/** Kept on purpose, said out loud - a reader should not have to diff the list above against the schema. */
const KEPT = [
  ['servers, bots and clients', 'the board is the point'],
  ['users, badges and tags', 'listings need owners, and the badges are what the cards draw'],
  ['bumps and votes', 'the ranking has nothing to measure without them'],
  ['uploads', 'the images listings point at live in the database'],
  ['Pro subscriptions and assignments', 'so Pro listings are Pro, and the ranking boost is testable'],
  ['reports', 'the staff queue is one of the things being tested'],
  ['co-managers', 'the Team badge on a comment needs somebody to hold it'],
];

const n = (r) => (typeof r?.count === 'number' ? r.count : 0);

try {
  console.log(`\nBeta snapshot: ${url}${DRY ? '  (dry run - nothing will be written)' : ''}\n`);

  const before = {
    servers: await db.server.count(),
    users: await db.user.count(),
    comments: await db.comment.count(),
  };
  console.log(`Found ${before.servers} servers, ${before.users} users, ${before.comments} comments.\n`);

  let total = 0;
  for (const step of steps) {
    if (DRY) {
      console.log(`  would clear  ${step.what}`);
      console.log(`               ${step.why}`);
      continue;
    }
    const res = await step.run();
    total += n(res);
    console.log(`  cleared ${String(n(res)).padStart(6)}  ${step.what}`);
  }

  console.log(`\n${DRY ? 'Would keep' : 'Kept'}:`);
  for (const [what, why] of KEPT) console.log(`  ${what.padEnd(34)} ${why}`);

  if (!DRY) {
    console.log(`\nDone. ${total} rows cleared.`);
    console.log('\nStill to do by hand, because only you can:');
    console.log('  - give the beta stack its own SESSION_SECRET (different from production)');
    console.log('  - leave COOKIE_DOMAIN empty (the site refuses to start otherwise)');
    console.log('  - leave the six STRIPE_* variables unset');
    console.log('  - give the beta bot its own Yapin’ token, and invite it only to a server you own');
    console.log('  - add https://beta.yapboard.dev/api/auth/callback to the Yapin’ OAuth app');
  }
} catch (e) {
  console.error('\nFailed:', e.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
