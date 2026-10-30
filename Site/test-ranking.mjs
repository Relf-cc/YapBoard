// Tests the real ranking arithmetic, compiled from src/lib/ranking-fields.ts.
// Run: npx tsc src/lib/ranking-fields.ts --outDir .rank-test --module nodenext --target es2022 --skipLibCheck
//      && node test-ranking.mjs
import { factorAsHours, hoursSinceEpoch, log2SumExp, shouldCount, spacePromoted, medianOf, RANKING_DEFAULTS } from './.rank-test/ranking-fields.js';

const out = [];
const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ` - ${x}` : ''}`);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/* --- log-sum-exp: the thing that stops the exponent overflowing ------------------------------ */
ok('log2SumExp(0,0) is 1', near(log2SumExp(0, 0), 1), String(log2SumExp(0, 0)));
ok('log2SumExp absorbs -Infinity', log2SumExp(-Infinity, 5) === 5 && log2SumExp(5, -Infinity) === 5);
ok(
  'log2SumExp matches the naive sum for small values',
  near(log2SumExp(3, 4), Math.log2(2 ** 3 + 2 ** 4)),
);
// The whole reason it exists: an exponent that would overflow a double if formed directly.
const huge = log2SumExp(5000, 5001);
ok('log2SumExp survives exponents a double could never hold', Number.isFinite(huge) && near(huge, 5001 + Math.log2(1.5)), String(huge));

/* --- the ordering invariance claim ------------------------------------------------------------- */
// Two listings scored at different moments must still order correctly, because neither stores a decayed
// value. Build each score the way the scorer does and check the order survives an arbitrary "now".
const H = 72;
const score = (events) => events.reduce((acc, [w, at]) => log2SumExp(acc, Math.log2(w) + hoursSinceEpoch(at) / H), -Infinity);
const now = Date.now();
const day = 86400_000;
// A: one review today. B: three replies three days ago.
const A = score([[14, now]]);
const B = score([
  [5, now - 3 * day],
  [5, now - 3 * day],
  [5, now - 3 * day],
]);
const decayedAt = (s, t) => s - (t - Date.UTC(2026, 0, 1)) / 3600_000 / H;
const order1 = A > B;
const order2 = decayedAt(A, now) > decayedAt(B, now);
const order3 = decayedAt(A, now + 400 * day) > decayedAt(B, now + 400 * day);
ok('stored order equals decayed order', order1 === order2, `${order1} vs ${order2}`);
ok('and it is still the same order a year later', order2 === order3, 'decay is common to every row');

/* --- a weight read as time ---------------------------------------------------------------------- */
// The documented claim: a reply now ties with a review from ~4.5 days ago, at the default weights.
const w = RANKING_DEFAULTS.weights.server;
const tie = H * Math.log2(w.review.w / w.reply.w);
ok('a reply now ties a review from ~4.5 days ago', tie > 100 && tie < 112, `${(tie / 24).toFixed(2)} days`);
// And the Pro boost, which is the number the whole fairness argument rests on.
const proHours = factorAsHours(RANKING_DEFAULTS.proBoost, H);
ok('the Pro boost is worth about 23 hours of freshness', proHours > 22 && proHours < 24, `${proHours.toFixed(1)}h`);

/* --- shouldCount -------------------------------------------------------------------------------- */
const base = { writerId: 'u1', ownerId: 'owner', managerIds: [] };
const long = 'x'.repeat(60);
ok('a long review counts', shouldCount({ ...base, body: long, rating: 5 }) === true);
ok('a four-character review does not', shouldCount({ ...base, body: 'nice', rating: 5 }) === false);
ok('a short reply does not', shouldCount({ ...base, body: 'ok', rating: null }) === false);
ok('a real reply does', shouldCount({ ...base, body: 'fixed that, thanks for saying', rating: null }) === true);
ok('the owner earns nothing on their own listing', shouldCount({ ...base, writerId: 'owner', body: long, rating: null }) === false);
ok('a co-manager earns nothing either', shouldCount({ ...base, writerId: 'm1', managerIds: ['m1'], body: long, rating: null }) === false);
ok('a duplicate of their last comment earns nothing', shouldCount({ ...base, body: long, rating: 5, previousBody: long }) === false);
ok('case and spacing do not dodge the duplicate check', shouldCount({ ...base, body: ' ' + long.toUpperCase(), rating: 5, previousBody: long }) === false);

/* --- spacePromoted: the index arithmetic -------------------------------------------------------- */
const mk = (s) => [...s].map((ch, i) => ({ pro: ch === 'P', id: `${ch}${i}` }));
const show = (a) => a.map((x) => (x.pro ? 'P' : 'f')).join('');
const gapsOk = (a) => {
  let last = -99;
  for (let i = 0; i < a.length; i++) {
    if (!a[i].pro) continue;
    if (i - last < 3) return false;
    last = i;
  }
  return true;
};

for (const input of ['PPffffff', 'PPPffffff', 'ffPPff', 'PfPfPfff', 'ffffffff', 'PPPP', 'PfPffPff', 'P', '']) {
  const res = spacePromoted(mk(input));
  const kept = res.length === input.length;
  const sameSet = res.map((x) => x.id).sort().join() === mk(input).map((x) => x.id).sort().join();
  // Relative order within each group must survive.
  const proOrder = res.filter((x) => x.pro).map((x) => x.id).join();
  const proWanted = mk(input).filter((x) => x.pro).map((x) => x.id).join();
  const freeOrder = res.filter((x) => !x.pro).map((x) => x.id).join();
  const freeWanted = mk(input).filter((x) => !x.pro).map((x) => x.id).join();
  // With too few free cards to separate them, bunching is unavoidable and the rule must not loop forever.
  const enoughRoom = input.split('f').length - 1 >= (input.split('P').length - 1) * 2;
  ok(
    `spacePromoted ${input || '(empty)'} -> ${show(res)}`,
    kept && sameSet && proOrder === proWanted && freeOrder === freeWanted && (!enoughRoom || gapsOk(res)),
    `kept=${kept} set=${sameSet} proOrder=${proOrder === proWanted} freeOrder=${freeOrder === freeWanted} gaps=${gapsOk(res)}`,
  );
}

/* --- medianOf ------------------------------------------------------------------------------------ */
ok('medianOf of an empty list is 0', medianOf([]) === 0);
ok('medianOf is the middle for odd lengths', medianOf([5, 1, 3]) === 3);
ok('medianOf averages the two middles for even lengths', medianOf([1, 2, 3, 4]) === 2.5);

console.log(out.join('\n'));
const passed = out.filter((l) => l.startsWith('PASS')).length;
console.log(`\n${passed}/${out.length} passed`);
process.exit(passed === out.length ? 0 : 1);
