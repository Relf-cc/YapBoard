/**
 * One-off: gives the FOUNDER badge to the first 25 servers that were listed.
 *
 *   node prisma/grant-founders.mjs           # shows what it would do
 *   node prisma/grant-founders.mjs --apply   # grants them
 *
 * Servers that already have it are left alone, so running it twice is harmless. Change COUNT if you want a
 * different cut-off; removed listings are skipped but still count as "first", since they were there first.
 */
import { PrismaClient } from '@prisma/client';

const COUNT = 25;
const KIND = 'FOUNDER';
const apply = process.argv.includes('--apply');
const db = new PrismaClient();

const first = await db.server.findMany({
  orderBy: { createdAt: 'asc' },
  take: COUNT,
  select: { id: true, name: true, status: true, createdAt: true, badges: { select: { kind: true } } },
});

const todo = first.filter((s) => s.status !== 'REMOVED' && !s.badges.some((b) => b.kind === KIND));
for (const [i, s] of first.entries()) {
  const why = s.status === 'REMOVED' ? 'skipped (removed)' : s.badges.some((b) => b.kind === KIND) ? 'already has it' : 'grant';
  console.log(`${String(i + 1).padStart(2)}. ${s.createdAt.toISOString().slice(0, 10)}  ${s.name.padEnd(28)} ${why}`);
}

if (!apply) {
  console.log(`\n${todo.length} to grant. Re-run with --apply to do it.`);
} else {
  const r = await db.serverBadge.createMany({ data: todo.map((s) => ({ serverId: s.id, kind: KIND })) });
  console.log(`\nGranted ${r.count} ${KIND} badge${r.count === 1 ? '' : 's'}.`);
}

await db.$disconnect();
