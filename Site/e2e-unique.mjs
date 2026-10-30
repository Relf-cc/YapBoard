// Does the database itself stop one person reviewing one listing twice? The app checks too, but two
// clicks can race through a check; only the index can't be raced.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const out = [];
const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ` - ${x}` : ''}`);
const ids = [];

try {
  const server = await db.server.findFirst({ where: { status: 'PUBLIC' }, select: { id: true } });
  const other = await db.server.findFirst({ where: { status: 'PUBLIC', id: { not: server.id } }, select: { id: true } });
  await db.user.upsert({ where: { id: 'dev-uniq' }, create: { id: 'dev-uniq', username: 'uniq' }, update: {} });

  const review = (serverId, body) => ({ serverId, userId: 'dev-uniq', body, rating: 4, reviewKey: `server:${serverId}`, ipHash: 'x' });

  const a = await db.comment.create({ data: review(server.id, 'first review of this one'), select: { id: true } });
  ids.push(a.id);
  ok('a review inserts', true);

  let blocked = false;
  try {
    const b = await db.comment.create({ data: review(server.id, 'second review of the same one'), select: { id: true } });
    ids.push(b.id);
  } catch (e) {
    blocked = e.code === 'P2002';
  }
  ok('a second review of the SAME listing is blocked by the index', blocked);

  // The same person must still be able to review a different listing.
  const c = await db.comment.create({ data: review(other.id, 'review of a different listing'), select: { id: true } });
  ids.push(c.id);
  ok('a review of a DIFFERENT listing still inserts', true);

  // And replies must stay uncapped: reviewKey is null on those, and null never collides.
  for (let i = 0; i < 3; i++) {
    const r = await db.comment.create({
      data: { serverId: server.id, userId: 'dev-uniq', body: `reply ${i}`, parentId: a.id, reviewKey: null, ipHash: 'x' },
      select: { id: true },
    });
    ids.push(r.id);
  }
  ok('three replies from one person all insert', true);
} catch (e) {
  out.push(`ERROR  ${e.message}`);
} finally {
  await db.comment.deleteMany({ where: { userId: 'dev-uniq' } }).catch(() => {});
  await db.user.deleteMany({ where: { id: 'dev-uniq' } }).catch(() => {});
  await db.$disconnect();
}

console.log(out.join('\n'));
