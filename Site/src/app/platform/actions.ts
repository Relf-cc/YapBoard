'use server';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { appSchema, mintKey, readScopes, writeScopes, type AppInput } from '@/lib/platform';
import { getUser } from '@/lib/session';
import { redeemInvite } from '@/lib/platform';

/**
 * Everything a developer can do on platform.yapboard.dev.
 *
 * Two rules hold throughout. An app can never hold a scope its member doesn't (staff decide the ceiling, the
 * developer picks from under it), and nothing here is destructive: an app is retired and a key revoked, both
 * of which stay in the list so a request arriving with one reads as "revoked" rather than "never existed".
 */

type Result<T = unknown> = ({ ok: true; message: string } & T) | { ok: false; error: string };

/** The logged-in member, or a thrown error - a server action can be called with anything, by anyone. */
async function member(write = true) {
  const user = await getUser();
  if (!user || user.bannedAt) throw new Error('Log in first');
  const m = await db.platformMember.findUnique({ where: { userId: user.id } });
  if (!m) throw new Error('You’re not in the developer program');
  if (write && m.status !== 'ACTIVE') throw new Error('Your developer account is suspended');
  return { user, m };
}

const done = (message: string) => {
  revalidatePath('/platform', 'layout');
  return { ok: true as const, message };
};

/** The app, if it's this member's and still in use. */
async function ownApp(appId: string, ownerId: string) {
  if (typeof appId !== 'string' || !appId) return null;
  const app = await db.platformApp.findUnique({ where: { id: appId }, select: { id: true, ownerId: true, status: true, name: true } });
  return app && app.ownerId === ownerId && app.status !== 'REVOKED' ? app : null;
}

/* ---------------- joining ---------------- */

/** Redeem an invite code. The only thing someone outside the program can do here. */
export async function redeem(code: string): Promise<Result> {
  const user = await getUser();
  if (!user || user.bannedAt) return { ok: false, error: 'Log in first' };
  if (typeof code !== 'string') return { ok: false, error: 'Bad input' };
  const r = await redeemInvite(code, user.id);
  if (!r.ok) return r;
  return done('Welcome to the program');
}

/* ---------------- apps ---------------- */

export async function createApp(input: AppInput): Promise<Result<{ appId?: string }>> {
  const { m } = await member();
  const p = appSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Bad input' };
  const { botId, name, summary, contactUrl, scopes } = p.data;

  const live = await db.platformApp.count({ where: { ownerId: m.userId, status: { not: 'REVOKED' } } });
  if (live >= m.appLimit) return { ok: false, error: `Your account is limited to ${m.appLimit} app${m.appLimit === 1 ? '' : 's'}. Ask staff to raise it.` };
  // One bot, one app, across the whole program: a bump has to trace back to exactly one of these rows.
  const taken = await db.platformApp.findUnique({ where: { botId }, select: { ownerId: true } });
  if (taken) return { ok: false, error: taken.ownerId === m.userId ? 'You’ve already registered that bot' : 'That bot is already registered by someone else' };

  const allowed = readScopes(m.scopes);
  const asked = scopes.filter((s) => (allowed as string[]).includes(s));
  const app = await db.platformApp.create({
    data: { botId, name, summary, contactUrl, scopes: writeScopes(asked), ownerId: m.userId },
    select: { id: true },
  });
  return { ...done('App registered'), appId: app.id };
}

const editSchema = appSchema.omit({ botId: true }).extend({ appId: z.string().min(1) });

export async function updateApp(input: z.input<typeof editSchema>): Promise<Result> {
  const { m } = await member();
  const p = editSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Bad input' };
  const { appId, name, summary, contactUrl, scopes } = p.data;
  if (!(await ownApp(appId, m.userId))) return { ok: false, error: 'App not found' };

  const allowed = readScopes(m.scopes) as string[];
  await db.platformApp.update({ where: { id: appId }, data: { name, summary, contactUrl, scopes: writeScopes(scopes.filter((s) => allowed.includes(s))) } });
  return done('Saved');
}

/**
 * Pause or restart an app. Pausing is the developer's own switch - keys stay, calls stop - so a broken
 * deployment can be stopped without throwing away the key it was built around.
 */
export async function setAppPaused(input: { appId: string; paused: boolean }): Promise<Result> {
  const { m } = await member();
  const { appId, paused } = input ?? {};
  const app = await ownApp(appId, m.userId);
  if (!app) return { ok: false, error: 'App not found' };
  // Staff suspensions are not the developer's to lift.
  if (app.status === 'SUSPENDED') return { ok: false, error: 'Staff suspended this app. Reply to the note on your overview.' };
  await db.platformApp.update({ where: { id: appId }, data: { status: paused ? 'PAUSED' : 'ACTIVE', statusNote: null } });
  return done(paused ? 'App paused' : 'App active again');
}

/** Retire an app for good: every key goes with it, and the bot ID is freed for a fresh registration. */
export async function retireApp(appId: string): Promise<Result> {
  const { m } = await member();
  const app = await ownApp(appId, m.userId);
  if (!app) return { ok: false, error: 'App not found' };
  await db.$transaction([
    db.platformKey.updateMany({ where: { appId, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.platformApp.update({ where: { id: appId }, data: { status: 'REVOKED', statusNote: 'Retired by the developer' } }),
  ]);
  return done(`${app.name} retired`);
}

/* ---------------- keys ---------------- */

const keySchema = z.object({ appId: z.string().min(1), label: z.string().trim().max(40).default('') });

/** A new key. The secret comes back exactly once - nothing stores it, so nothing can show it again. */
export async function createKey(input: z.input<typeof keySchema>): Promise<Result<{ secret?: string }>> {
  const { m } = await member();
  const p = keySchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const app = await ownApp(p.data.appId, m.userId);
  if (!app) return { ok: false, error: 'App not found' };
  // A handful is plenty, and it keeps the list readable; rotation revokes the old one anyway.
  const live = await db.platformKey.count({ where: { appId: app.id, revokedAt: null } });
  if (live >= 5) return { ok: false, error: 'Revoke a key before minting another (5 live is the limit)' };

  const key = await mintKey(app.id, p.data.label);
  return { ...done('Key created - copy it now'), secret: key.secret };
}

export async function revokeKey(input: { appId: string; keyId: string }): Promise<Result> {
  const { m } = await member();
  const { appId, keyId } = input ?? {};
  if (typeof keyId !== 'string' || !keyId) return { ok: false, error: 'Bad input' };
  if (!(await ownApp(appId, m.userId))) return { ok: false, error: 'App not found' };
  const r = await db.platformKey.updateMany({ where: { id: keyId, appId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) return { ok: false, error: 'That key is already revoked' };
  return done('Key revoked');
}
