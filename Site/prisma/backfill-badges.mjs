/**
 * Moves the old one-per-server `Server.badge` column into the ServerBadge table.
 *
 * `prisma db push` drops the column in the same breath as it creates the table, so this runs in two halves:
 *
 *   node prisma/backfill-badges.mjs dump      # before the push: saves the old values to prisma/.badges.json
 *   npx prisma db push --accept-data-loss     # drops Server.badge, creates ServerBadge
 *   node prisma/backfill-badges.mjs restore   # after the push: writes them back as ServerBadge rows
 *
 * Safe to run once and then delete. A fresh database doesn't need it at all (prisma/seed.mjs covers that).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const FILE = new URL('.badges.json', import.meta.url);
const db = new PrismaClient();
const mode = process.argv[2];

if (mode === 'dump') {
  // Raw SQL: by now the Prisma schema has no `badge` field to select.
  const rows = await db.$queryRawUnsafe('SELECT id, badge, badgedAt FROM Server WHERE badge IS NOT NULL');
  writeFileSync(FILE, JSON.stringify(rows, null, 2));
  console.log(`Saved ${rows.length} badge${rows.length === 1 ? '' : 's'} to prisma/.badges.json`);
} else if (mode === 'restore') {
  const rows = JSON.parse(readFileSync(FILE, 'utf8'));
  let n = 0;
  for (const r of rows) {
    const grantedAt = r.badgedAt ? new Date(r.badgedAt) : new Date();
    const { count } = await db.serverBadge.createMany({ data: [{ serverId: r.id, kind: r.badge, grantedAt }] }).catch(() => ({ count: 0 }));
    n += count;
  }
  console.log(`Restored ${n} of ${rows.length} badges`);
} else {
  console.error('Usage: node prisma/backfill-badges.mjs dump|restore');
  process.exitCode = 1;
}

await db.$disconnect();
