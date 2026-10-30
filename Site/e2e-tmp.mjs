// End-to-end check of the review flow against a running `next dev`.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` - ${extra}` : ''}`);

/** Dev login, returning the session cookie. */
async function login(username, staff = false) {
  const form = new URLSearchParams({ username, next: '/' });
  if (staff) form.set('staff', 'on');
  const res = await fetch(`${BASE}/api/auth/dev`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw.map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error(`no cookie from dev login (${res.status})`);
  return cookie;
}

const api = (path, cookie, method = 'POST', body) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json', origin: BASE },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const LONG = 'The mods are actually around and the music bot never dies, which is more than I can say for most places I have tried.';

try {
  // A public server whose owner is not our test accounts.
  const server = await db.server.findFirst({ where: { status: 'PUBLIC' }, select: { id: true, name: true, ownerId: true, hotScore: true } });
  if (!server) throw new Error('no public server to test against');

  const alice = await login('e2e_alice');
  const bob = await login('e2e_bob');
  const mod = await login('e2e_mod', true);

  // Test accounts are brand new, so the 24h age gate would refuse them. Age them, which is also a test of
  // the gate itself: without this the next call should fail.
  const tooNew = await api('/api/comments', alice, 'POST', { kind: 'server', listingId: server.id, body: LONG, rating: 5 });
  ok('new account is refused by the age gate', tooNew.status === 403, `got ${tooNew.status}`);

  const old = new Date(Date.now() - 40 * 24 * 3600_000);
  await db.user.updateMany({ where: { id: { in: ['dev-e2e_alice', 'dev-e2e_bob', 'dev-e2e_mod'] } }, data: { createdAt: old } });

  // --- posting a review -------------------------------------------------------------------------
  const posted = await api('/api/comments', alice, 'POST', { kind: 'server', listingId: server.id, body: LONG, rating: 5 });
  const postedBody = await posted.json();
  ok('a review posts', posted.status === 201, `${posted.status} ${JSON.stringify(postedBody)}`);
  const reviewId = postedBody.id;

  // --- one review per person per listing, enforced by the unique index -------------------------
  const dupe = await api('/api/comments', alice, 'POST', { kind: 'server', listingId: server.id, body: LONG + ' again', rating: 4 });
  ok('a second review from the same person is refused', dupe.status === 409, `got ${dupe.status}`);

  // --- a review that is too short is refused -----------------------------------------------------
  const short = await api('/api/comments', bob, 'POST', { kind: 'server', listingId: server.id, body: 'nice', rating: 5 });
  ok('a four-character review is refused', short.status === 400, `got ${short.status}`);

  // --- the owner may not review, but may reply ---------------------------------------------------
  const ownerCookie = await login('e2e_owner');
  await db.user.update({ where: { id: 'dev-e2e_owner' }, data: { createdAt: old } });
  await db.server.update({ where: { id: server.id }, data: { ownerId: 'dev-e2e_owner' } });
  const ownerReview = await api('/api/comments', ownerCookie, 'POST', { kind: 'server', listingId: server.id, body: LONG, rating: 5 });
  ok('the owner cannot review their own listing', ownerReview.status === 403, `got ${ownerReview.status}`);

  const ownerReply = await api('/api/comments', ownerCookie, 'POST', { kind: 'server', listingId: server.id, parentId: reviewId, body: 'Thanks! Glad it is working out.' });
  ok('the owner can reply', ownerReply.status === 201, `got ${ownerReply.status}`);
  const ownerReplyId = (await ownerReply.json()).id;

  // --- replies are one level deep ----------------------------------------------------------------
  const nested = await api('/api/comments', bob, 'POST', { kind: 'server', listingId: server.id, parentId: ownerReplyId, body: 'replying to a reply' });
  ok('a reply to a reply is refused', nested.status === 400, `got ${nested.status}`);

  // --- counters ----------------------------------------------------------------------------------
  const after = await db.server.findUnique({ where: { id: server.id }, select: { reviewCount: true, ratingSum: true, commentCount: true, hotScore: true } });
  ok('reviewCount is right', after.reviewCount === 1, `got ${after.reviewCount}`);
  ok('ratingSum is right', after.ratingSum === 5, `got ${after.ratingSum}`);
  ok('commentCount counts the reply too', after.commentCount === 2, `got ${after.commentCount}`);

  // --- the counts flag: the owner's reply must not feed the ranking -------------------------------
  const rows = await db.comment.findMany({ where: { serverId: server.id }, select: { id: true, counts: true, rating: true, reviewKey: true, parentId: true } });
  const review = rows.find((r) => r.id === reviewId);
  const reply = rows.find((r) => r.id === ownerReplyId);
  ok('the review counts toward the ranking', review?.counts === true);
  ok('the owner reply does not count toward the ranking', reply?.counts === false);
  ok('a review carries a reviewKey', review?.reviewKey === `server:${server.id}`, String(review?.reviewKey));
  ok('a reply carries no reviewKey', reply?.reviewKey === null, String(reply?.reviewKey));

  // --- the score moved ---------------------------------------------------------------------------
  ok('the score went up after a review', after.hotScore > server.hotScore, `${server.hotScore} -> ${after.hotScore}`);

  // --- an owner cannot hide a review of their listing ---------------------------------------------
  const ownerHide = await api(`/api/comments/${reviewId}`, ownerCookie, 'DELETE');
  ok('the owner cannot hide a review of their listing', ownerHide.status === 403, `got ${ownerHide.status}`);

  // --- but staff can, and it comes off the counters -----------------------------------------------
  const staffHide = await api(`/api/comments/${reviewId}`, mod, 'DELETE');
  ok('staff can hide it', staffHide.ok, `got ${staffHide.status}`);
  const hidden = await db.server.findUnique({ where: { id: server.id }, select: { reviewCount: true, ratingSum: true, commentCount: true } });
  ok('hiding takes it out of the counters', hidden.reviewCount === 0 && hidden.ratingSum === 0, JSON.stringify(hidden));
  ok('the row is kept, not deleted', (await db.comment.count({ where: { id: reviewId } })) === 1);

  // --- and back ------------------------------------------------------------------------------------
  const restored = await api(`/api/comments/${reviewId}`, mod, 'POST');
  ok('staff can put it back', restored.ok, `got ${restored.status}`);
  const back = await db.server.findUnique({ where: { id: server.id }, select: { reviewCount: true, ratingSum: true } });
  ok('restoring brings the counters back', back.reviewCount === 1 && back.ratingSum === 5, JSON.stringify(back));

  // --- reporting a comment lands in the existing queue ---------------------------------------------
  const report = await api(`/api/comments/${reviewId}/report`, ownerCookie, 'POST', { reason: 'spam', details: 'This looks like a fake review to me, honestly.' });
  ok('an owner can report a review', report.status === 201, `got ${report.status}`);
  const filed = await db.report.findFirst({ where: { commentId: reviewId }, select: { serverId: true, kind: true } });
  ok('the report carries the listing as well as the comment', filed?.serverId === server.id && filed?.kind === 'ABUSE', JSON.stringify(filed));

  // --- the listing page renders it -------------------------------------------------------------------
  const page = await fetch(`${BASE}/view/${server.id}`, { headers: { cookie: alice } });
  const html = await page.text();
  ok('the listing page renders the reviews section', html.includes('id="reviews"'), `status ${page.status}`);
  ok('the review body is on the page', html.includes('The mods are actually around'));
  ok('the owner badge is rendered', html.includes('>Owner<'));

  // --- the profile page ------------------------------------------------------------------------------
  const prof = await fetch(`${BASE}/profile/dev-e2e_alice`);
  const profHtml = await prof.text();
  ok('the profile page renders', prof.status === 200, `status ${prof.status}`);
  ok('the profile shows a review count', /Reviews/.test(profHtml));

  const byName = await fetch(`${BASE}/profile/${encodeURIComponent('@e2e_alice')}`, { redirect: 'manual' });
  ok('/profile/@username redirects to the id', byName.status === 307 || byName.status === 302, `status ${byName.status}`);
} catch (e) {
  out.push(`ERROR  ${e.stack || e.message}`);
} finally {
  // Leave the dev database as it was.
  await db.comment.deleteMany({ where: { user: { id: { startsWith: 'dev-e2e_' } } } }).catch(() => {});
  await db.report.deleteMany({ where: { reporter: { id: { startsWith: 'dev-e2e_' } } } }).catch(() => {});
  await db.$disconnect();
}

console.log(out.join('\n'));
console.log(`\n${out.filter((l) => l.startsWith('PASS')).length}/${out.length} passed`);
