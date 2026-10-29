// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Tops members and their apps up to every scope the platform currently has.
 *
 *   node prisma/platform-grant-scopes.mjs                  # shows what it would do
 *   node prisma/platform-grant-scopes.mjs --apply
 *   node prisma/platform-grant-scopes.mjs --apply --member dev-chris
 *   node prisma/platform-grant-scopes.mjs --apply --app cl… --scopes bump,search
 *
 * For when a new scope is added: existing members hold the scopes their invite granted, and existing apps
 * hold whatever their developer picked at the time, so neither picks up a scope added afterwards. This hands
 * out the lot.
 *
 * It writes both sides, because an app can only hold what its member's ceiling allows (src/lib/platform.ts):
 * granting an app a scope its member doesn't have would be undone the next time the member's scopes are saved
 * in the portal. Members first, then apps.
 *
 * Normally this is the portal's job for the ceiling and the developer's for their own apps — reach for this
 * when you've just added a scope and want everyone to have it without clicking through every row. Retired
 * apps are left alone. Safe to run twice.
 */
import { PrismaClient } from '@prisma/client';

/** Keep in step with SCOPE_ORDER in src/lib/platform-scopes.ts; a .mjs script can't import the TS. */
const SCOPES = ['bump', 'search', 'listing', 'bots'];

const flag = (name) => process.argv.includes(`--${name}`);
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};

const apply = flag('apply');
const onlyMember = arg('member');
const onlyApp = arg('app');
const wanted = (arg('scopes') || '').split(',').map((s) => s.trim()).filter(Boolean);
const unknown = wanted.filter((s) => !SCOPES.includes(s));
if (unknown.length) {
  console.error(`Unknown scope(s): ${unknown.join(', ')}. Pick from ${SCOPES.join(', ')}.`);
  process.exit(1);
}

const grant = wanted.length ? SCOPES.filter((s) => wanted.includes(s)) : SCOPES;
const db = new PrismaClient();

/** The stored string, read the way the app reads it: unknown values dropped, order from SCOPES. */
const read = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? SCOPES.filter((s) => parsed.includes(s)) : [];
  } catch {
    return [];
  }
};
const union = (have) => SCOPES.filter((s) => have.includes(s) || grant.includes(s));
const same = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);

const members = await db.platformMember.findMany({
  where: onlyMember ? { userId: onlyMember } : {},
  select: { userId: true, scopes: true, status: true, user: { select: { username: true } } },
  orderBy: { joinedAt: 'asc' },
});
const apps = await db.platformApp.findMany({
  where: { status: { not: 'REVOKED' }, ...(onlyApp ? { id: onlyApp } : {}), ...(onlyMember ? { ownerId: onlyMember } : {}) },
  select: { id: true, name: true, scopes: true, status: true, ownerId: true },
  orderBy: { createdAt: 'asc' },
});

console.log(`Granting: ${grant.join(', ')}\n`);

const memberWork = [];
for (const m of members) {
  const have = read(m.scopes);
  const next = union(have);
  const note = same(have, next) ? 'already has them' : `+ ${next.filter((s) => !have.includes(s)).join(', ')}`;
  console.log(`member @${m.user.username.padEnd(14)} ${m.status.padEnd(9)} [${have.join(', ') || 'none'}]  ${note}`);
  if (!same(have, next)) memberWork.push({ userId: m.userId, next });
}

const appWork = [];
for (const a of apps) {
  const have = read(a.scopes);
  const next = union(have);
  const note = same(have, next) ? 'already has them' : `+ ${next.filter((s) => !have.includes(s)).join(', ')}`;
  console.log(`app    ${a.name.padEnd(20)} ${a.status.padEnd(9)} [${have.join(', ') || 'none'}]  ${note}`);
  if (!same(have, next)) appWork.push({ id: a.id, next });
}

if (!apply) {
  console.log(`\n${memberWork.length} member(s) and ${appWork.length} app(s) to update. Re-run with --apply.`);
} else {
  for (const m of memberWork) await db.platformMember.update({ where: { userId: m.userId }, data: { scopes: JSON.stringify(m.next) } });
  for (const a of appWork) await db.platformApp.update({ where: { id: a.id }, data: { scopes: JSON.stringify(a.next) } });
  console.log(`\nUpdated ${memberWork.length} member(s) and ${appWork.length} app(s).`);
}

await db.$disconnect();
