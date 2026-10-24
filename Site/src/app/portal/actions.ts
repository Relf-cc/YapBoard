'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
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

  const report = await db.report.findUnique({ where: { id: reportId }, include: { server: { select: { id: true, ownerId: true, status: true } } } });
  if (!report) return { ok: false, error: 'Report not found' };
  if (report.status !== 'OPEN') return { ok: false, error: 'Already handled by someone else' };
  if (outcome === 'action' && banOwner) {
    const why = await canBan(me, report.server.ownerId);
    if (why) return { ok: false, error: why };
  }

  await db.$transaction(async (tx) => {
    const status = outcome === 'dismiss' ? 'DISMISSED' : 'ACTIONED';
    const where = closeRelated ? { serverId: report.serverId, status: 'OPEN' } : { id: reportId };
    await tx.report.updateMany({ where, data: { status, resolution: n, handledById: me.id, handledAt: new Date() } });

    if (outcome === 'action' && serverAction !== 'none') {
      await tx.server.update({ where: { id: report.serverId }, data: { status: serverAction === 'hide' ? 'HIDDEN' : 'REMOVED', statusNote: n } });
      await tx.auditLog.create({ data: { actorId: me.id, action: `server.${serverAction}`, targetType: 'server', targetId: report.serverId, note: n } });
    }
    if (outcome === 'action' && banOwner) {
      await tx.user.update({ where: { id: report.server.ownerId }, data: { bannedAt: new Date(), banReason: n } });
      await tx.server.updateMany({ where: { ownerId: report.server.ownerId, status: { in: ['PUBLIC', 'UNLISTED'] } }, data: { status: 'HIDDEN', statusNote: 'Owner banned' } });
      await tx.auditLog.create({ data: { actorId: me.id, action: 'user.ban', targetType: 'user', targetId: report.server.ownerId, note: n } });
    }
    await tx.auditLog.create({ data: { actorId: me.id, action: `report.${outcome}`, targetType: 'report', targetId: reportId, note: n } });
  });
  if (outcome === 'action' && banOwner) await refreshRanksForUser(report.server.ownerId);
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

const badgeSchema = z.object({ serverId: z.string().min(1), badge: z.enum(['VERIFIED', 'OFFICIAL', 'NONE']) });

/** Blue check (verified) or green check (official Yapin' server). One at a time. */
export async function setBadge(input: z.input<typeof badgeSchema>): Promise<Result> {
  const me = await staff();
  const p = badgeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { serverId, badge } = p.data;
  const none = badge === 'NONE';
  await db.server.update({ where: { id: serverId }, data: { badge: none ? null : badge, badgedAt: none ? null : new Date() } });
  await log(me.id, none ? 'server.unbadge' : badge === 'OFFICIAL' ? 'server.officiate' : 'server.verify', 'server', serverId, null);
  revalidatePath('/', 'layout');
  return done(none ? 'Checkmark removed' : badge === 'OFFICIAL' ? 'Marked official' : 'Verified');
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
      ...(hideServers ? [db.server.updateMany({ where: { ownerId: userId, status: { in: ['PUBLIC', 'UNLISTED'] } }, data: { status: 'HIDDEN', statusNote: 'Owner banned' } })] : []),
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
