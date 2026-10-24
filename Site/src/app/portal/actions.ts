'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getUser, isAdmin, isStaff } from '@/lib/session';

type Result = { ok: true; message: string } | { ok: false; error: string };

async function staff() {
  const u = await getUser();
  if (!u || u.bannedAt || !isStaff(u)) throw new Error('Staff only');
  return u;
}

const note = z.string().trim().max(500).optional().transform((v) => v || null);

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
  return done(outcome === 'dismiss' ? 'Report dismissed' : 'Report actioned');
}

/** Puts a handled report back in the queue. */
export async function reopenReport(reportId: string): Promise<Result> {
  const me = await staff();
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

/* ---------------- users ---------------- */

const userSchema = z.object({ userId: z.string().min(1), action: z.enum(['ban', 'unban']), hideServers: z.boolean().default(true), note });

export async function moderateUser(input: z.input<typeof userSchema>): Promise<Result> {
  const me = await staff();
  const p = userSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Bad input' };
  const { userId, action, hideServers, note: n } = p.data;
  if (userId === me.id) return { ok: false, error: 'You can’t ban yourself' };
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, error: 'User not found' };
  if (target.role !== 'USER' && !isAdmin(me)) return { ok: false, error: 'Only admins can ban staff' };

  if (action === 'ban') {
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { bannedAt: new Date(), banReason: n } }),
      ...(hideServers ? [db.server.updateMany({ where: { ownerId: userId, status: { in: ['PUBLIC', 'UNLISTED'] } }, data: { status: 'HIDDEN', statusNote: 'Owner banned' } })] : []),
    ]);
  } else {
    await db.user.update({ where: { id: userId }, data: { bannedAt: null, banReason: null } });
  }
  await log(me.id, `user.${action}`, 'user', userId, n);
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
