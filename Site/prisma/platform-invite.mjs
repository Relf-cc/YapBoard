// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Writes an invite to the developer platform from the command line, for the first one - before there is any
 * staff account to write it in the portal (src/app/portal/platform). After that, use the portal.
 *
 *   node prisma/platform-invite.mjs --by 9876543210
 *   node prisma/platform-invite.mjs --by 9876543210 --for 1122334455 --scopes bump,listing --limit 3 --days 30
 *
 * --by is required: an invite records who granted it, and that has to be a real account (log in once first).
 * --for ties the code to one Yapin' user id. --scopes is what the member may hold; leave it off for none,
 * which they can be given later. Prints the code to hand over.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const SCOPES = ['bump', 'listing', 'search', 'bots'];
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const by = arg('by');
if (!by) {
  console.error('Pass --by <your Yapin’ user id>. Log in on the site once so the account exists.');
  process.exit(1);
}

const scopes = (arg('scopes', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const unknown = scopes.filter((s) => !SCOPES.includes(s));
if (unknown.length) {
  console.error(`Unknown scope(s): ${unknown.join(', ')}. Pick from ${SCOPES.join(', ')}.`);
  process.exit(1);
}

const appLimit = Number(arg('limit', '2'));
const days = Number(arg('days', '14'));
const db = new PrismaClient();

const inviter = await db.user.findUnique({ where: { id: by }, select: { username: true } });
if (!inviter) {
  console.error(`No account with id ${by}. Log in on the site first, then run this again.`);
  process.exit(1);
}

// Same shape as newInviteCode() in src/lib/platform.ts: YB-XXXX-XXXX, no letters that get misread.
const chars = Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]);
const code = `YB-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;

await db.platformInvite.create({
  data: {
    code,
    note: arg('note', null),
    forUserId: arg('for', null),
    appLimit: Number.isFinite(appLimit) ? Math.min(10, Math.max(1, appLimit)) : 2,
    scopes: JSON.stringify(SCOPES.filter((s) => scopes.includes(s))),
    expiresAt: days > 0 ? new Date(Date.now() + days * 864e5) : null,
    invitedById: by,
  },
});

console.log(`\n  ${code}\n`);
console.log(`Scopes: ${scopes.join(', ') || 'none'} · apps: ${appLimit} · ${days > 0 ? `expires in ${days} days` : 'no expiry'} · from @${inviter.username}`);
console.log('Redeem it at the platform (PLATFORM_URL), signed in with the account it’s for.');

await db.$disconnect();
