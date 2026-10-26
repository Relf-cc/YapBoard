import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from './db';

/**
 * Global messages staff send through the bot (/portal/broadcasts).
 *
 * Where they go: the channel each server last used /bump in. The bot records it on every bump, so a broadcast
 * lands somewhere people already talk to YapBoard, not in the first channel it can shout into. Servers that
 * have never bumped get nothing, and anyone can opt out (Server.broadcastsOff).
 *
 * How they're sent: queuing a broadcast writes one BroadcastDelivery row per server, all PENDING. The bot polls
 * /api/internal/broadcasts, claims a batch, posts them and reports back. Nothing is pushed at the bot, so it can
 * be restarted, be offline for an hour, or run behind a home connection, and the queue just drains later.
 *
 * A claim that's never reported back (the bot died mid-batch) goes back in the queue after CLAIM_TTL_MS.
 */

/** How many deliveries the bot takes at once. Small enough that a crash loses little, big enough to be quick. */
export const BATCH = 25;
/** A claimed delivery nobody reported on is handed out again after this. */
export const CLAIM_TTL_MS = 5 * 60_000;

export const broadcastSchema = z.object({
  title: z.string().trim().min(3, 'Give it a title').max(120, 'Keep the title under 120 characters'),
  body: z.string().trim().min(10, 'Say a bit more').max(1500, 'Max 1500 characters'),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\//.test(v), 'Links in the bot message need the full https:// address')
    .nullable(),
  linkLabel: z.string().trim().max(40).transform((v) => v || null).nullable(),
});

export type BroadcastInput = z.input<typeof broadcastSchema>;

/** Servers a broadcast would reach: listed, opted in, and they've used /bump at least once. */
export const reachableWhere: Prisma.ServerWhereInput = {
  status: { in: ['PUBLIC', 'UNLISTED'] },
  broadcastsOff: false,
  bumpChannelId: { not: null },
};

export const countReachable = () => db.server.count({ where: reachableWhere });

/**
 * Writes one delivery per reachable server and sets the broadcast going. The channel is copied in now, so a
 * server that bumps somewhere else while the queue drains still gets it where it was when staff pressed send.
 */
export async function queueBroadcast(broadcastId: string): Promise<number> {
  const servers = await db.server.findMany({ where: reachableWhere, select: { id: true, bumpChannelId: true } });
  const rows = servers.flatMap((s) => (s.bumpChannelId ? [{ broadcastId, serverId: s.id, channelId: s.bumpChannelId }] : []));
  if (!rows.length) return 0;
  await db.$transaction([
    // createMany skips duplicates so pressing send twice can't post twice to one server.
    db.broadcastDelivery.createMany({ data: rows }),
    db.broadcast.update({ where: { id: broadcastId }, data: { status: 'SENDING', startedAt: new Date() } }),
  ]);
  return rows.length;
}

export type ClaimedDelivery = { id: number; serverId: string; channelId: string };

/**
 * The next batch for the bot. Claims the rows first so two bot instances (or a slow retry) can't both send them.
 * Returns the broadcast's text alongside, since the bot has nothing cached between polls.
 */
export async function claimBatch(): Promise<{ broadcast: { id: string; title: string; body: string; linkUrl: string | null; linkLabel: string | null }; deliveries: ClaimedDelivery[] } | null> {
  const stale = new Date(Date.now() - CLAIM_TTL_MS);
  // Oldest broadcast first, so one big send doesn't sit behind a newer small one forever.
  const broadcast = await db.broadcast.findFirst({
    where: { status: 'SENDING' },
    orderBy: { startedAt: 'asc' },
    select: { id: true, title: true, body: true, linkUrl: true, linkLabel: true },
  });
  if (!broadcast) return null;

  const waiting = await db.broadcastDelivery.findMany({
    where: { broadcastId: broadcast.id, OR: [{ status: 'PENDING' }, { status: 'CLAIMED', claimedAt: { lt: stale } }] },
    orderBy: { id: 'asc' },
    take: BATCH,
    select: { id: true, serverId: true, channelId: true },
  });
  if (!waiting.length) {
    await finishIfDone(broadcast.id);
    return null;
  }

  const ids = waiting.map((d) => d.id);
  await db.broadcastDelivery.updateMany({ where: { id: { in: ids } }, data: { status: 'CLAIMED', claimedAt: new Date() } });
  return { broadcast, deliveries: waiting };
}

export const resultSchema = z.object({
  broadcastId: z.string().min(1).max(64),
  results: z
    .array(
      z.object({
        id: z.number().int().positive(),
        ok: z.boolean(),
        error: z.string().max(300).nullish(),
      }),
    )
    .min(1)
    .max(BATCH),
});

/** What the bot reports back after a batch. Rows it doesn't mention stay claimed and are retried later. */
export async function recordResults(broadcastId: string, results: z.infer<typeof resultSchema>['results']) {
  const now = new Date();
  await db.$transaction(
    results.map((r) =>
      db.broadcastDelivery.updateMany({
        where: { id: r.id, broadcastId },
        data: r.ok ? { status: 'SENT', sentAt: now, error: null } : { status: 'FAILED', error: (r.error || 'unknown error').slice(0, 300), sentAt: now },
      }),
    ),
  );
  await finishIfDone(broadcastId);
}

/** Marks a broadcast done once nothing is left waiting. */
export async function finishIfDone(broadcastId: string) {
  const left = await db.broadcastDelivery.count({ where: { broadcastId, status: { in: ['PENDING', 'CLAIMED'] } } });
  if (left) return false;
  await db.broadcast.updateMany({ where: { id: broadcastId, status: 'SENDING' }, data: { status: 'SENT', finishedAt: new Date() } });
  return true;
}

export type BroadcastProgress = { total: number; sent: number; failed: number; waiting: number };

export async function progressOf(broadcastId: string): Promise<BroadcastProgress> {
  const rows = await db.broadcastDelivery.groupBy({ by: ['status'], where: { broadcastId }, _count: { _all: true } });
  const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const sent = n('SENT');
  const failed = n('FAILED');
  const waiting = n('PENDING') + n('CLAIMED');
  return { total: sent + failed + waiting, sent, failed, waiting };
}
