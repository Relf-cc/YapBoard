// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { z } from 'zod';
import { BETA_DM_STAFF_ONLY, IS_BETA } from './beta';
import { db } from './db';
import { env } from './env';

/** How many DMs the bot takes per poll. Small: these trickle in, unlike a broadcast. */
export const BATCH = 20;
/** A claimed DM nobody reported on is handed out again after this. Same rule as broadcasts. */
export const CLAIM_TTL_MS = 5 * 60_000;
/** Tries stop after this long. A review decision nobody could be told about isn't worth chasing for days. */
export const GIVE_UP_MS = 24 * 60 * 60_000;

type Queued = { userId: string; kind: string; title: string; body: string; linkUrl?: string | null; linkLabel?: string | null };

/**
 * Ask the bot to DM someone. Never throws: the dashboard and the listing's own page are the real record of a
 * review decision, so failing to queue a nudge must not fail the decision itself.
 */
export async function queueBotDm(dm: Queued): Promise<void> {
  try {
    await db.botDm.create({
      data: {
        userId: dm.userId,
        kind: dm.kind,
        title: dm.title.slice(0, 120),
        body: dm.body.slice(0, 1500),
        linkUrl: dm.linkUrl || null,
        linkLabel: dm.linkLabel?.slice(0, 40) || null,
      },
    });
  } catch (e) {
    console.error('[bot-dms] could not queue a DM:', e instanceof Error ? e.message : e);
  }
}

export type ClaimedDm = { id: number; userId: string; title: string; body: string; linkUrl: string | null; linkLabel: string | null };

/** The next batch for the bot. Oldest first, including claims that were never reported on. */
export async function claimDmBatch(): Promise<ClaimedDm[]> {
  const now = Date.now();
  const stale = new Date(now - CLAIM_TTL_MS);

  // Anything still undelivered a day later is written off, so the queue can't grow forever.
  await db.botDm.updateMany({
    where: { status: { in: ['PENDING', 'CLAIMED'] }, createdAt: { lt: new Date(now - GIVE_UP_MS) } },
    data: { status: 'FAILED', error: 'gave up: undeliverable for 24h' },
  });

  /**
   * On beta, nothing goes to anybody but staff.
   *
   * The recipients here are real Yapin' accounts, copied from the real board along with everything else,
   * and the beta bot has a token of its own - so without this, a review somebody writes on a snapshot
   * turns into a message to a stranger about a page they cannot see. Held rather than dropped: the row
   * stays PENDING, so the portal still shows what *would* have been sent, and the whole path is still
   * testable by a staff member reviewing their own listing.
   */
  if (IS_BETA && BETA_DM_STAFF_ONLY && !env.staffIds.length) return [];

  const waiting = await db.botDm.findMany({
    where: {
      OR: [{ status: 'PENDING' }, { status: 'CLAIMED', claimedAt: { lt: stale } }],
      ...(IS_BETA && BETA_DM_STAFF_ONLY ? { userId: { in: env.staffIds } } : {}),
    },
    orderBy: { id: 'asc' },
    take: BATCH,
    select: { id: true, userId: true, title: true, body: true, linkUrl: true, linkLabel: true },
  });
  if (!waiting.length) return [];

  await db.botDm.updateMany({ where: { id: { in: waiting.map((d) => d.id) } }, data: { status: 'CLAIMED', claimedAt: new Date() } });
  return waiting;
}

export const dmResultSchema = z.object({
  results: z
    .array(z.object({ id: z.number().int().positive(), ok: z.boolean(), error: z.string().max(300).nullish() }))
    .min(1)
    .max(BATCH),
});

/** What the bot reports back. Rows it doesn't mention stay claimed and are handed out again later. */
export async function recordDmResults(results: z.infer<typeof dmResultSchema>['results']): Promise<void> {
  const now = new Date();
  await db.$transaction(
    results.map((r) =>
      db.botDm.updateMany({
        where: { id: r.id },
        data: r.ok ? { status: 'SENT', sentAt: now, error: null } : { status: 'FAILED', error: (r.error || 'unknown error').slice(0, 300), sentAt: now },
      }),
    ),
  );
}
