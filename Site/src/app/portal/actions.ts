'use server';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { announcementSchema, type AnnouncementInput } from '@/lib/announcements';
import { BADGES, isBadge } from '@/lib/badges';
import { broadcastSchema, queueBroadcast, type BroadcastInput } from '@/lib/broadcasts';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { getUser, isAdmin, isStaff } from '@/lib/session';
import { getVotingConfig, refreshAllRanks, refreshRank, refreshRanksForUser, saveVotingConfig, votingSchema, type VotingConfig } from '@/lib/votes';

type Result = { ok: true; message: string } | { ok: false; error: string };

async function staff() {
  const u = await getUser();
  if (!u || u.bannedAt || !isStaff(u)) throw new Error('Staff only');
  return u;
}

const note = z.string().trim().max(500).optional().transform((v) => v || null);

/** Staff can ban users; banning staff (or admins) is for admins only. STAFF_IDS count as admins even if the DB says otherwise. */
async function canBan(me: Awaited<ReturnType<typeof staff>>, userId: string): Promise<string | null> {
  if (userId === me.id) return 'You can’t ban yourself';
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return 'User not found';
  const role = env.staffIds.includes(userId) ? 'ADMIN' : target.role;
  if (role !== 'USER' && !isAdmin(me)) return 'Only admins can ban staff';
  return null;
}

function log(actorId: string, action: string, targetType: string, targetId: string, n: string | null) {
  return db.auditLog.create({ data: { actorId, action, targetType, targetId, note: n } });
}

const done = (message: string): Result => {
  revalidatePath('/portal', 'layout');
  return { ok: true, message };
};

/* ---------------- reports ---------------- */

const resolveSchema = z.object({
  reportId: z.string().min(1),
  outcome: z.enum(['dismiss', 'action']),
  serverAction: z.enum(['none', 'hide', 'remove']).default('none'),
  banOwner: z.boolean().default(false),
  closeRelated: z.boolean().default(false),
  note,
});

export async function resolveReport(input: z.input<typeof resolveSchema>): Promise<Result> {
  const me = await staff();
  const p = resolveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { reportId, outcome, serverAction, banOwner, closeRelated, note: n } = p.data;

  const report = await db.report.findUnique({
    where: { id: reportId },
    include: { server: { select: { id: true, ownerId: true } }, bot: { select: { id: true, ownerId: true } } },
  });
  if (!report) return { ok: false, error: 'Report not found' };
  if (report.status !== 'OPEN') return { ok: false, error: 'Already handled by someone else' };
  // One report, one listing — a server or a bot (src/lib/reports.ts).
  const target = report.server ?? report.bot;
  if (!target) return { ok: false, error: 'That listing is gone' };
  const onBot = !report.server;
  if (outcome === 'action' && banOwner) {
    const why = await canBan(me, target.ownerId);
    if (why) return { ok: false, error: why };
  }

  await db.$transaction(async (tx) => {
    const status = outcome === 'dismiss' ? 'DISMISSED' : 'ACTIONED';
    const where = closeRelated ? { ...(onBot ? { botId: target.id } : { serverId: target.id }), status: 'OPEN' } : { id: reportId };
    await tx.report.updateMany({ where, data: { status, resolution: n, handledById: me.id, handledAt: new Date() } });

    if (outcome === 'action' && serverAction !== 'none') {
      const data = { status: serverAction === 'hide' ? 'HIDDEN' : 'REMOVED', statusNote: n };
      if (onBot) await tx.botListing.update({ where: { id: target.id }, data });
      else await tx.server.update({ where: { id: target.id }, data });
      await tx.auditLog.create({ data: { actorId: me.id, action: `${onBot ? 'bot' : 'server'}.${serverAction}`, targetType: onBot ? 'bot' : 'server', targetId: target.id, note: n } });
    }
    if (outcome === 'action' && banOwner) {
      // A ban takes down everything they've listed, on both boards.
      await tx.user.update({ where: { id: target.ownerId }, data: { bannedAt: new Date(), banReason: n } });
      await tx.server.updateMany({ where: { ownerId: target.ownerId, status: { in: ['PUBLIC', 'UNLISTED'] } }, data: { status: 'HIDDEN', statusNote: 'Owner banned' } });
      await tx.botListing.updateMany({ where: { ownerId: target.ownerId, status: { in: ['PUBLIC', 'UNLISTED'] } }, data: { status: 'HIDDEN', statusNote: 'Owner banned' } });
      await tx.auditLog.create({ data: { actorId: me.id, action: 'user.ban', targetType: 'user', targetId: target.ownerId, note: n } });
    }
    await tx.auditLog.create({ data: { actorId: me.id, action: `report.${outcome}`, targetType: 'report', targetId: reportId, note: n } });
  });
  if (outcome === 'action' && banOwner) await refreshRanksForUser(target.ownerId);
  revalidatePath('/', 'layout');
  return done(outcome === 'dismiss' ? 'Report dismissed' : 'Report actioned');
}

/** Puts a handled report back in the queue. */
export async function reopenReport(reportId: string): Promise<Result> {
  const me = await staff();
  // Server actions can be called with anything, whatever the TypeScript type says.
  if (typeof reportId !== 'string' || !reportId) return { ok: false, error: 'Bad input' };
  if (!(await db.report.findUnique({ where: { id: reportId }, select: { id: true } }))) return { ok: false, error: 'Report not found' };
  await db.report.update({ where: { id: reportId }, data: { status: 'OPEN', resolution: null, handledById: null, handledAt: null } });
  await log(me.id, 'report.reopen', 'report', reportId, null);
  return done('Report reopened');
}

/* ---------------- servers ---------------- */

const serverSchema = z.object({ serverId: z.string().min(1), action: z.enum(['hide', 'remove', 'restore']), note });

export async function moderateServer(input: z.input<typeof serverSchema>): Promise<Result> {
  const me = await staff();
  const p = serverSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { serverId, action, note: n } = p.data;
  const status = action === 'hide' ? 'HIDDEN' : action === 'remove' ? 'REMOVED' : 'PUBLIC';
  await db.server.update({ where: { id: serverId }, data: { status, statusNote: action === 'restore' ? null : n } });
  await log(me.id, `server.${action}`, 'server', serverId, n);
  return done(action === 'restore' ? 'Server restored' : action === 'hide' ? 'Server hidden' : 'Server removed');
}

const badgeSchema = z.object({ serverId: z.string().min(1), badge: z.string().refine(isBadge, 'Unknown badge'), on: z.boolean() });

/** Add or take away one badge. A server can hold any number of them (src/lib/badges.ts). */
export async function toggleBadge(input: z.input<typeof badgeSchema>): Promise<Result> {
  const me = await staff();
  const p = badgeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { serverId, badge, on } = p.data;
  if (!(await db.server.findUnique({ where: { id: serverId }, select: { id: true } }))) return { ok: false, error: 'Server not found' };
  if (on) {
    await db.serverBadge.upsert({ where: { serverId_kind: { serverId, kind: badge } }, create: { serverId, kind: badge, grantedById: me.id }, update: {} });
  } else {
    await db.serverBadge.deleteMany({ where: { serverId, kind: badge } });
  }
  await log(me.id, on ? 'server.badge_add' : 'server.badge_remove', 'server', serverId, BADGES[badge].label);
  revalidatePath('/', 'layout');
  return done(on ? `${BADGES[badge].label} added` : `${BADGES[badge].label} removed`);
}

/** Takes every badge off a server at once. */
export async function clearBadges(serverId: string): Promise<Result> {
  const me = await staff();
  if (typeof serverId !== 'string' || !serverId) return { ok: false, error: 'Bad input' };
  const r = await db.serverBadge.deleteMany({ where: { serverId } });
  if (!r.count) return { ok: false, error: 'It has no badges' };
  await log(me.id, 'server.badges_clear', 'server', serverId, `${r.count} removed`);
  revalidatePath('/', 'layout');
  return done(r.count === 1 ? 'Badge removed' : `${r.count} badges removed`);
}

/* ---------------- users ---------------- */

const userSchema = z.object({ userId: z.string().min(1), action: z.enum(['ban', 'unban']), hideServers: z.boolean().default(true), note });

export async function moderateUser(input: z.input<typeof userSchema>): Promise<Result> {
  const me = await staff();
  const p = userSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { userId, action, hideServers, note: n } = p.data;
  const why = await canBan(me, userId);
  if (why) return { ok: false, error: why };

  if (action === 'ban') {
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { bannedAt: new Date(), banReason: n } }),
      ...(hideServers
        ? [
            db.server.updateMany({ where: { ownerId: userId, status: { in: ['PUBLIC', 'UNLISTED'] } }, data: { status: 'HIDDEN', statusNote: 'Owner banned' } }),
            db.botListing.updateMany({ where: { ownerId: userId, status: { in: ['PUBLIC', 'UNLISTED'] } }, data: { status: 'HIDDEN', statusNote: 'Owner banned' } }),
          ]
        : []),
    ]);
  } else {
    await db.user.update({ where: { id: userId }, data: { bannedAt: null, banReason: null } });
  }
  await log(me.id, `user.${action}`, 'user', userId, n);
  // Banned voters' votes don't count (and count again on unban).
  await refreshRanksForUser(userId);
  return done(action === 'ban' ? 'User banned' : 'User unbanned');
}

const roleSchema = z.object({ userId: z.string().min(1), role: z.enum(['USER', 'STAFF', 'ADMIN']) });

export async function setRole(input: z.input<typeof roleSchema>): Promise<Result> {
  const me = await staff();
  if (!isAdmin(me)) return { ok: false, error: 'Admins only' };
  const p = roleSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  if (p.data.userId === me.id) return { ok: false, error: 'You can’t change your own role' };
  await db.user.update({ where: { id: p.data.userId }, data: { role: p.data.role } });
  await log(me.id, `role.${p.data.role.toLowerCase()}`, 'user', p.data.userId, null);
  return done(`Role set to ${p.data.role.toLowerCase()}`);
}

/* ---------------- voting (lib/votes.ts) ---------------- */

const changes = (a: VotingConfig, b: VotingConfig) =>
  (Object.keys(b) as (keyof VotingConfig)[])
    .filter((k) => a[k] !== b[k])
    .map((k) => `${k} ${a[k]} → ${b[k]}`)
    .join(', ') || null;

/** Pause or resume all voting. Any staff member can, so abuse can be stopped without waiting for an admin. */
export async function setVotingEnabled(enabled: boolean): Promise<Result> {
  const me = await staff();
  if (typeof enabled !== 'boolean') return { ok: false, error: 'Bad input' };
  const next = { ...(await getVotingConfig()), enabled };
  await saveVotingConfig(next);
  await refreshAllRanks(next);
  await log(me.id, enabled ? 'voting.resume' : 'voting.pause', 'setting', 'voting', null);
  revalidatePath('/', 'layout');
  return done(enabled ? 'Voting is on' : 'Voting is paused, and votes no longer move servers');
}

/** The numbers and switches. Admins only. Every server's rank is worked out again with the new values. */
export async function saveVotingSettings(input: VotingConfig): Promise<Result> {
  const me = await staff();
  if (!isAdmin(me)) return { ok: false, error: 'Admins only' };
  const p = votingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Check the numbers: one is out of range' };
  const before = await getVotingConfig();
  await saveVotingConfig(p.data);
  await refreshAllRanks(p.data);
  await log(me.id, 'voting.settings', 'setting', 'voting', changes(before, p.data));
  revalidatePath('/', 'layout');
  return done('Voting settings saved');
}

const voteTarget = z.object({ kind: z.enum(['server', 'user']), id: z.string().min(1).max(100), note });

/** Revoke every counted vote for a server, or by a user. Nothing is deleted: restoreVotes undoes it. */
export async function revokeVotes(input: z.input<typeof voteTarget>): Promise<Result> {
  const me = await staff();
  const p = voteTarget.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { kind, id, note: n } = p.data;
  const r = await db.vote.updateMany({
    where: { ...(kind === 'server' ? { serverId: id } : { userId: id }), revokedAt: null },
    data: { revokedAt: new Date(), revokedFor: kind },
  });
  if (kind === 'server') await refreshRank(id);
  else await refreshRanksForUser(id);
  await log(me.id, `votes.revoke_${kind}`, kind, id, n ?? `${r.count} votes`);
  return done(`${r.count} vote${r.count === 1 ? '' : 's'} revoked`);
}

/** Puts back the votes that revokeVotes took away for this server (or user). */
export async function restoreVotes(input: z.input<typeof voteTarget>): Promise<Result> {
  const me = await staff();
  const p = voteTarget.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { kind, id } = p.data;
  const r = await db.vote.updateMany({
    where: { ...(kind === 'server' ? { serverId: id } : { userId: id }), revokedFor: kind },
    data: { revokedAt: null, revokedFor: null },
  });
  if (kind === 'server') await refreshRank(id);
  else await refreshRanksForUser(id);
  await log(me.id, `votes.restore_${kind}`, kind, id, `${r.count} votes`);
  return done(`${r.count} vote${r.count === 1 ? '' : 's'} restored`);
}

const serverVoting = z.object({ serverId: z.string().min(1).max(100), off: z.boolean(), note });

/** Turn voting off (or back on) for one server. While off its votes don't count and nobody can vote for it. */
export async function setServerVoting(input: z.input<typeof serverVoting>): Promise<Result> {
  const me = await staff();
  const p = serverVoting.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { serverId, off, note: n } = p.data;
  const r = await db.server.updateMany({ where: { id: serverId }, data: { votingOff: off } });
  if (!r.count) return { ok: false, error: 'Server not found' };
  await refreshRank(serverId);
  await log(me.id, off ? 'server.voting_off' : 'server.voting_on', 'server', serverId, n);
  return done(off ? 'Voting is off for this server' : 'Voting is back on for this server');
}

/* ---------------- bot listings (lib/bots.ts) ---------------- */

const botSchema = z.object({ botId: z.string().min(1), action: z.enum(['hide', 'remove', 'restore']), note });

export async function moderateBot(input: z.input<typeof botSchema>): Promise<Result> {
  const me = await staff();
  const p = botSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { botId, action, note: n } = p.data;
  const status = action === 'hide' ? 'HIDDEN' : action === 'remove' ? 'REMOVED' : 'PUBLIC';
  const r = await db.botListing.updateMany({ where: { id: botId }, data: { status, statusNote: action === 'restore' ? null : n } });
  if (!r.count) return { ok: false, error: 'Bot not found' };
  await log(me.id, `bot.${action}`, 'bot', botId, n);
  revalidatePath('/', 'layout');
  return done(action === 'restore' ? 'Bot restored' : action === 'hide' ? 'Bot hidden' : 'Bot removed');
}

const botBadgeSchema = z.object({ botId: z.string().min(1), badge: z.string().refine(isBadge, 'Unknown badge'), on: z.boolean() });

/** Add or take away one badge on a bot. The same badges servers get (src/lib/badges.ts). */
export async function toggleBotBadge(input: z.input<typeof botBadgeSchema>): Promise<Result> {
  const me = await staff();
  const p = botBadgeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { botId, badge, on } = p.data;
  if (!(await db.botListing.findUnique({ where: { id: botId }, select: { id: true } }))) return { ok: false, error: 'Bot not found' };
  if (on) {
    await db.botBadge.upsert({ where: { botId_kind: { botId, kind: badge } }, create: { botId, kind: badge, grantedById: me.id }, update: {} });
  } else {
    await db.botBadge.deleteMany({ where: { botId, kind: badge } });
  }
  await log(me.id, on ? 'bot.badge_add' : 'bot.badge_remove', 'bot', botId, BADGES[badge].label);
  revalidatePath('/', 'layout');
  return done(on ? `${BADGES[badge].label} added` : `${BADGES[badge].label} removed`);
}

/** Takes every badge off a bot at once. */
export async function clearBotBadges(botId: string): Promise<Result> {
  const me = await staff();
  if (typeof botId !== 'string' || !botId) return { ok: false, error: 'Bad input' };
  const r = await db.botBadge.deleteMany({ where: { botId } });
  if (!r.count) return { ok: false, error: 'It has no badges' };
  await log(me.id, 'bot.badges_clear', 'bot', botId, `${r.count} removed`);
  revalidatePath('/', 'layout');
  return done(r.count === 1 ? 'Badge removed' : `${r.count} badges removed`);
}

/** Nothing reports a bot's server count automatically yet, so staff keep it honest. */
export async function setBotServerCount(input: { botId: string; count: number }): Promise<Result> {
  const me = await staff();
  const p = z.object({ botId: z.string().min(1), count: z.number().int().min(0).max(100_000_000) }).safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const r = await db.botListing.updateMany({ where: { id: p.data.botId }, data: { serverCount: p.data.count } });
  if (!r.count) return { ok: false, error: 'Bot not found' };
  await log(me.id, 'bot.server_count', 'bot', p.data.botId, String(p.data.count));
  revalidatePath('/', 'layout');
  return done('Server count updated');
}

/* ---------------- announcements (lib/announcements.ts) ---------------- */

/** The first thing wrong with a form, for the one-line message the portal shows. */
function firstProblem(e: z.ZodError): string {
  for (const msgs of Object.values(z.flattenError(e).fieldErrors)) {
    const first = (msgs as string[] | undefined)?.[0];
    if (first) return first;
  }
  return 'Check the form';
}

export async function saveAnnouncement(input: AnnouncementInput & { id?: string }): Promise<Result & { id?: string }> {
  const me = await staff();
  const p = announcementSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstProblem(p.error) };
  const d = p.data;
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) return { ok: false, error: 'The end has to come after the start' };
  const id = typeof input.id === 'string' && input.id ? input.id : null;

  if (id) {
    if (!(await db.announcement.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, error: 'Announcement not found' };
    await db.announcement.update({ where: { id }, data: d });
    await log(me.id, 'announcement.edit', 'announcement', id, d.title);
    revalidatePath('/', 'layout');
    return { ...done('Announcement saved'), id };
  }
  const row = await db.announcement.create({ data: { ...d, authorId: me.id } });
  await log(me.id, 'announcement.create', 'announcement', row.id, d.title);
  revalidatePath('/', 'layout');
  return { ...done('Announcement created'), id: row.id };
}

/**
 * Turn one on or off. Turning it on also forgets who has already closed it, so an edited notice reaches
 * everyone again: staff rewrite and re-publish far more often than they leave one running untouched.
 */
export async function setAnnouncementActive(input: { id: string; active: boolean }): Promise<Result> {
  const me = await staff();
  const p = z.object({ id: z.string().min(1), active: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const row = await db.announcement.findUnique({ where: { id: p.data.id }, select: { title: true } });
  if (!row) return { ok: false, error: 'Announcement not found' };
  await db.announcement.update({ where: { id: p.data.id }, data: { active: p.data.active } });
  if (p.data.active) await db.announcementSeen.deleteMany({ where: { announcementId: p.data.id } });
  await log(me.id, p.data.active ? 'announcement.publish' : 'announcement.unpublish', 'announcement', p.data.id, row.title);
  revalidatePath('/', 'layout');
  return done(p.data.active ? 'It’s live' : 'Taken down');
}

export async function deleteAnnouncement(id: string): Promise<Result> {
  const me = await staff();
  if (typeof id !== 'string' || !id) return { ok: false, error: 'Bad input' };
  const row = await db.announcement.findUnique({ where: { id }, select: { title: true } });
  if (!row) return { ok: false, error: 'Announcement not found' };
  await db.announcement.delete({ where: { id } });
  await log(me.id, 'announcement.delete', 'announcement', id, row.title);
  revalidatePath('/', 'layout');
  return done('Announcement deleted');
}

/* ---------------- bot broadcasts (lib/broadcasts.ts) ---------------- */

export async function saveBroadcast(input: BroadcastInput & { id?: string }): Promise<Result & { id?: string }> {
  const me = await staff();
  const p = broadcastSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstProblem(p.error) };
  const id = typeof input.id === 'string' && input.id ? input.id : null;

  if (id) {
    const row = await db.broadcast.findUnique({ where: { id }, select: { status: true } });
    if (!row) return { ok: false, error: 'Broadcast not found' };
    // Once it's going out, the text people have already received can't be rewritten.
    if (row.status !== 'DRAFT') return { ok: false, error: 'This one has already been sent' };
    await db.broadcast.update({ where: { id }, data: p.data });
    return { ...done('Draft saved'), id };
  }
  const row = await db.broadcast.create({ data: { ...p.data, authorId: me.id } });
  await log(me.id, 'broadcast.draft', 'broadcast', row.id, p.data.title);
  return { ...done('Draft saved'), id: row.id };
}

/** Admins only: this goes out to every server that has used the bot, and can't be taken back. */
export async function sendBroadcast(id: string): Promise<Result> {
  const me = await staff();
  if (!isAdmin(me)) return { ok: false, error: 'Only admins can send a broadcast' };
  if (typeof id !== 'string' || !id) return { ok: false, error: 'Bad input' };
  const row = await db.broadcast.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!row) return { ok: false, error: 'Broadcast not found' };
  if (row.status !== 'DRAFT') return { ok: false, error: 'This one has already been sent' };
  const n = await queueBroadcast(id);
  if (!n) return { ok: false, error: 'No server has used the bot yet, so there’s nobody to send to' };
  await log(me.id, 'broadcast.send', 'broadcast', id, `${row.title} → ${n} servers`);
  return done(`Queued for ${n} server${n === 1 ? '' : 's'}. The bot posts them over the next few minutes.`);
}

/** Stops a broadcast that's still going out. Servers it already reached keep their message. */
export async function cancelBroadcast(id: string): Promise<Result> {
  const me = await staff();
  if (typeof id !== 'string' || !id) return { ok: false, error: 'Bad input' };
  const row = await db.broadcast.findUnique({ where: { id }, select: { status: true } });
  if (!row) return { ok: false, error: 'Broadcast not found' };
  if (row.status === 'SENT' || row.status === 'CANCELLED') return { ok: false, error: 'Nothing left to stop' };
  const left = await db.broadcastDelivery.deleteMany({ where: { broadcastId: id, status: { in: ['PENDING', 'CLAIMED'] } } });
  await db.broadcast.update({ where: { id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
  await log(me.id, 'broadcast.cancel', 'broadcast', id, `${left.count} not sent`);
  return done(`Stopped. ${left.count} server${left.count === 1 ? '' : 's'} won’t get it.`);
}

export async function deleteBroadcast(id: string): Promise<Result> {
  const me = await staff();
  if (typeof id !== 'string' || !id) return { ok: false, error: 'Bad input' };
  const row = await db.broadcast.findUnique({ where: { id }, select: { status: true } });
  if (!row) return { ok: false, error: 'Broadcast not found' };
  if (row.status === 'SENDING') return { ok: false, error: 'Stop it first' };
  await db.broadcast.delete({ where: { id } });
  await log(me.id, 'broadcast.delete', 'broadcast', id, null);
  return done('Broadcast deleted');
}
