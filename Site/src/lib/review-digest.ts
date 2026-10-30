// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { db } from './db';
import { boardMean } from './engagement';
import { idFieldFor } from './comments';
import type { ListingKind } from './pro-fields';
import { displayRating } from './ratings';

/**
 * The one line about reviews the bot needs, for a listing.
 *
 * It exists because of where the leverage is. The bump reminder already fires into the owner's channel
 * every two hours, and the reply to `/bump` already lands in front of whoever typed it - so the cheapest
 * way to get somebody from Yapin' onto a YapBoard page is one extra line on a message that was already
 * being sent. Nothing new has to be built or delivered or retried.
 *
 * "Since the last bump" rather than "since you last looked", because the last bump is a timestamp the bot
 * and the site already agree on, and because it makes the line self-limiting: once an owner has seen it,
 * bumping clears it.
 */
export type ReviewDigest = {
  reviewCount: number;
  /** The blended rating as it is printed, or null while there are too few reviews to print one. */
  rating: string | null;
  /** Visible reviews written since the listing was last bumped. */
  sinceBump: number;
  /** The newest visible review, to quote in the bump card. */
  latest: { rating: number | null; body: string; writer: string; answered: boolean } | null;
};

const EMPTY: ReviewDigest = { reviewCount: 0, rating: null, sinceBump: 0, latest: null };

export async function reviewDigest(kind: ListingKind, listingId: string, bumpedAt: Date | null): Promise<ReviewDigest> {
  const idField = idFieldFor(kind);
  const visible = { [idField]: listingId, hiddenAt: null, parentId: null, rating: { not: null } } as const;

  const [counts, sinceBump, latest, mean] = await Promise.all([
    db.comment.aggregate({ where: visible, _count: { _all: true }, _sum: { rating: true } }),
    bumpedAt ? db.comment.count({ where: { ...visible, createdAt: { gt: bumpedAt } } }) : 0,
    db.comment.findFirst({
      where: visible,
      orderBy: { createdAt: 'desc' },
      select: {
        rating: true,
        body: true,
        user: { select: { username: true, displayName: true } },
        // Whether the owner has already answered it, so the nudge can stop nagging about one they have.
        replies: { where: { hiddenAt: null }, select: { userId: true } },
        serverId: true,
        botId: true,
        clientId: true,
      },
    }),
    boardMean(),
  ]);

  if (!counts._count._all) return EMPTY;

  const owner = await ownerOf(kind, listingId);
  return {
    reviewCount: counts._count._all,
    rating: displayRating(counts._sum.rating ?? 0, counts._count._all, mean),
    sinceBump,
    latest: latest
      ? {
          rating: latest.rating,
          body: latest.body,
          writer: latest.user.displayName || latest.user.username,
          answered: !!owner && latest.replies.some((r) => r.userId === owner),
        }
      : null,
  };
}

async function ownerOf(kind: ListingKind, id: string): Promise<string | null> {
  const where = { id };
  const row =
    kind === 'server'
      ? await db.server.findUnique({ where, select: { ownerId: true } })
      : kind === 'bot'
        ? await db.botListing.findUnique({ where, select: { ownerId: true } })
        : await db.clientListing.findUnique({ where, select: { ownerId: true } });
  return row?.ownerId ?? null;
}
