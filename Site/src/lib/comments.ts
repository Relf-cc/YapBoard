// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import {
  editSchema,
  isCommentKind,
  MAX_BODY,
  MIN_REPLY_BODY,
  MIN_REVIEW_BODY,
  postSchema,
  type PostInput,
  type Thread,
  type ThreadComment,
} from './comment-fields';
import { queueBotDm } from './bot-dms';
import { boardMean, refreshHotQuietly, shouldCount } from './engagement';
import { env } from './env';
import { proUsers } from './pro';
import { syncUserBadgesQuietly } from './profiles';
import { LISTING_KINDS, type ListingKind } from './pro-fields';
import { isRating } from './ratings';
import { isStaff, type SessionUser } from './session';
import { networkOf } from './votes';

/**
 * Reviews and replies, for all three boards.
 *
 * One table and one set of rules (see the `Comment` model), because a review and a reply to it need the
 * same moderation queue, the same report path, the same rate limits and the same badges - the difference
 * between them really is only which fields are set.
 *
 * ## What an owner can and cannot do
 *
 * This is the part worth getting right, because it is what decides whether the reviews are worth reading.
 *
 * - An owner **may always reply**, with an Owner badge on it, and their reply marks the whole thread as
 *   answered. That is the most valuable thing a listing page can show.
 * - An owner **may hide replies underneath their own comment**, which is moderating their conversation.
 * - An owner may **never** hide a review of their listing, edit one, or make one count for less. If they
 *   think it breaks the rules they report it, like anybody else, and staff decide.
 *
 * Money changes none of that either (src/lib/pro.ts): Pro buys reach, never silence. A board where a plan
 * can scrub criticism is worth less to a reader than no board at all, and reviews nobody trusts bring
 * nobody back.
 *
 * ## Hidden, never deleted
 *
 * The rule the rest of this schema keeps. A hidden row stops showing and stops counting, in the same
 * write, and stays on disk - so a wrong call is one click to undo rather than an apology.
 */

/* ------------------------------------------------------------------ settings */

export const commentsSchema = z.object({
  /** Off: the whole section disappears and the API refuses. Reading still works for staff in the portal. */
  enabled: z.boolean(),
  /** Off: replies only, no stars anywhere. The column stays, so turning it back on restores every rating. */
  ratings: z.boolean(),
  /** Hours since the writer's first YapBoard login. */
  minAccountAgeHours: z.number().int().min(0).max(720),
  /** Minutes between one person's comments on the same listing. */
  cooldownMinutes: z.number().int().min(0).max(1440),
  maxPerUserPerDay: z.number().int().min(1).max(200),
  /** Every account on one connection together, per day. */
  maxPerNetworkPerDay: z.number().int().min(1).max(500),
  /** Inside this, an edit is a typo and passes silently. Outside it, the row is marked as edited. */
  editGraceMinutes: z.number().int().min(0).max(1440),
});

export type CommentsConfig = z.infer<typeof commentsSchema>;

export const COMMENTS_DEFAULTS: CommentsConfig = {
  enabled: true,
  ratings: true,
  minAccountAgeHours: 24,
  cooldownMinutes: 2,
  maxPerUserPerDay: 30,
  maxPerNetworkPerDay: 60,
  editGraceMinutes: 15,
};

/** Saved settings over the defaults, per key, so one bad value can't take the section down. Once per request. */
export const getCommentsConfig = cache(async (): Promise<CommentsConfig> => {
  const row = await db.setting.findUnique({ where: { key: 'comments' } });
  let saved: Record<string, unknown> = {};
  try {
    saved = row ? JSON.parse(row.value) : {};
  } catch {}
  const out = { ...COMMENTS_DEFAULTS };
  for (const k of Object.keys(COMMENTS_DEFAULTS) as (keyof CommentsConfig)[]) {
    const v = commentsSchema.shape[k].safeParse(saved[k]);
    if (v.success) (out as Record<string, unknown>)[k] = v.data;
  }
  return out;
});

export async function saveCommentsConfig(cfg: CommentsConfig) {
  const value = JSON.stringify(cfg);
  await db.setting.upsert({ where: { key: 'comments' }, create: { key: 'comments', value }, update: { value } });
}

/* ------------------------------------------------------------------ shapes */

/** The limits and shapes the browser needs too. One definition, re-exported, so the form and the route agree. */
export {
  MAX_BODY,
  MIN_REVIEW_BODY,
  MIN_REPLY_BODY,
  isCommentKind,
  postSchema,
  editSchema,
  type PostInput,
  type EditInput,
  type Thread,
  type ThreadComment,
  type ThreadWriter,
} from './comment-fields';

/** The column on Comment that points at this board's listing. */
export const idFieldFor = (kind: ListingKind) => (kind === 'server' ? 'serverId' : kind === 'bot' ? 'botId' : 'clientId') as 'serverId' | 'botId' | 'clientId';

/** Carries the one-review-per-listing rule into the unique index. Null for a reply - see the schema. */
const reviewKeyFor = (kind: ListingKind, listingId: string) => `${kind}:${listingId}`;

export type CommentResult = { ok: true; id: string } | { ok: false; error: string; status: number };

type ListingFacts = { ownerId: string; status: string; managerIds: string[] };

/** The three columns every check here needs, whichever board it is. */
async function listingFacts(kind: ListingKind, listingId: string): Promise<ListingFacts | null> {
  const select = { ownerId: true, status: true, managers: { select: { userId: true } } } as const;
  const row =
    kind === 'server'
      ? await db.server.findUnique({ where: { id: listingId }, select })
      : kind === 'bot'
        ? await db.botListing.findUnique({ where: { id: listingId }, select })
        : await db.clientListing.findUnique({ where: { id: listingId }, select });
  return row ? { ownerId: row.ownerId, status: row.status, managerIds: row.managers.map((m) => m.userId) } : null;
}

const DAY = 24 * 60 * 60_000;

/* ------------------------------------------------------------------ writing */

/**
 * Every check, then the row, then the counters and the score.
 *
 * The caller has already checked login, ban and origin (src/lib/http.ts). What is left is everything about
 * *this* comment on *this* listing.
 */
export async function postComment(input: PostInput, userId: string, ip: string): Promise<CommentResult> {
  const cfg = await getCommentsConfig();
  if (!cfg.enabled) return { ok: false, status: 403, error: 'Comments are paused right now.' };

  const kind = input.kind as ListingKind;
  const [listing, user] = await Promise.all([
    listingFacts(kind, input.listingId),
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  if (!listing || listing.status !== 'PUBLIC') return { ok: false, status: 404, error: 'This listing isn’t taking comments.' };
  if (!user || Date.now() - user.createdAt.getTime() < cfg.minAccountAgeHours * 3_600_000) {
    return { ok: false, status: 403, error: `New accounts can post ${cfg.minAccountAgeHours} hours after their first login.` };
  }

  const idField = idFieldFor(kind);
  const isReply = !!input.parentId;

  // A reply has to hang off a visible, top-level comment on this same listing - one level deep, by design.
  let parentAuthorId: string | null = null;
  if (isReply) {
    const parent = await db.comment.findUnique({
      where: { id: input.parentId! },
      select: { id: true, userId: true, parentId: true, hiddenAt: true, serverId: true, botId: true, clientId: true },
    });
    if (!parent || parent.hiddenAt || parent[idField] !== input.listingId) return { ok: false, status: 404, error: 'That comment isn’t there any more.' };
    if (parent.parentId) return { ok: false, status: 400, error: 'Replies only go one level deep.' };
    parentAuthorId = parent.userId;
  }

  const own = userId === listing.ownerId || listing.managerIds.includes(userId);
  if (!isReply) {
    if (own) return { ok: false, status: 403, error: 'You can’t review a listing you run. Reply to a review instead.' };
    if (cfg.ratings && !isRating(input.rating)) return { ok: false, status: 400, error: 'Pick a rating from 1 to 5.' };
    if (input.body.trim().length < MIN_REVIEW_BODY) return { ok: false, status: 400, error: `Tell people a bit more (${MIN_REVIEW_BODY}+ characters).` };
  } else if (input.body.trim().length < MIN_REPLY_BODY) {
    return { ok: false, status: 400, error: 'Write something first.' };
  }

  const net = networkOf(ip);
  const now = Date.now();
  const [mine, network, recent, existing] = await Promise.all([
    db.comment.count({ where: { userId, createdAt: { gt: new Date(now - DAY) } } }),
    db.comment.count({ where: { ipHash: net, createdAt: { gt: new Date(now - DAY) } } }),
    cfg.cooldownMinutes
      ? db.comment.findFirst({
          where: { userId, [idField]: input.listingId, createdAt: { gt: new Date(now - cfg.cooldownMinutes * 60_000) } },
          select: { id: true },
        })
      : null,
    // The previous one on this listing, for the duplicate check in `shouldCount`.
    db.comment.findFirst({ where: { userId, [idField]: input.listingId }, orderBy: { createdAt: 'desc' }, select: { body: true } }),
  ]);
  if (mine >= cfg.maxPerUserPerDay) return { ok: false, status: 429, error: 'That’s a lot for one day. Try again tomorrow.' };
  if (network >= cfg.maxPerNetworkPerDay) return { ok: false, status: 429, error: 'Too much from your network today. Try again tomorrow.' };
  if (recent) return { ok: false, status: 429, error: 'Give it a moment before posting again.' };

  const counts = shouldCount({
    body: input.body,
    rating: isReply ? null : (input.rating ?? null),
    writerId: userId,
    ownerId: listing.ownerId,
    managerIds: listing.managerIds,
    previousBody: existing?.body,
  });

  let id: string;
  try {
    const created = await db.comment.create({
      data: {
        [idField]: input.listingId,
        userId,
        rating: isReply || !cfg.ratings ? null : (input.rating ?? null),
        body: input.body.trim(),
        parentId: input.parentId,
        // Null on a reply, which is what lets replies stay uncapped while reviews stay one-per-listing.
        reviewKey: isReply ? null : reviewKeyFor(kind, input.listingId),
        ipHash: net,
        counts,
      },
      select: { id: true },
    });
    id = created.id;
  } catch (e) {
    // The unique index is the real guard against a double click, not the check above it.
    if ((e as { code?: string }).code === 'P2002') return { ok: false, status: 409, error: 'You’ve already reviewed this. Edit your review instead.' };
    throw e;
  }

  await recount(kind, input.listingId);
  void refreshHotQuietly(kind, input.listingId);
  void syncUserBadgesQuietly(userId);
  // The owner is told there is something to answer; `parentAuthorId` is what tells a reply from a review.
  void notifyOwner(kind, input.listingId, listing.ownerId, userId, parentAuthorId);
  return { ok: true, id };
}

/**
 * Where a listing lives on the public site.
 *
 * A client is the odd one out: its id is a cuid and its page is keyed on `slug`, so this is the one board
 * where the path cannot be built from the id alone. Everything that links to a listing from outside a page
 * that already loaded it goes through here, rather than each caller remembering that.
 */
export async function listingPath(kind: ListingKind, listingId: string): Promise<string> {
  if (kind === 'server') return `/view/${listingId}`;
  if (kind === 'bot') return `/bots/${listingId}`;
  const row = await db.clientListing.findUnique({ where: { id: listingId }, select: { slug: true } });
  return `/clients/${row?.slug ?? listingId}`;
}

/**
 * Tell the owner somebody has written something under their listing.
 *
 * The highest-leverage thing in the whole plan, and it needed no new plumbing: `BotDm` already queues,
 * delivers and reports back, and the bot already polls it. A review reaches the owner where they already
 * are - in Yapin' - and the link brings them to a page on YapBoard they now have a reason to answer on.
 *
 * Never throws (`queueBotDm` swallows its own errors): the review is the record, and a nudge that couldn't
 * be sent must not fail the thing it was about. Nobody is DMed about their own writing, and a reply under
 * somebody else's review goes to that person rather than to the owner - it is their conversation.
 */
async function notifyOwner(kind: ListingKind, listingId: string, ownerId: string, writerId: string, parentAuthorId: string | null) {
  const to = parentAuthorId ?? ownerId;
  if (to === writerId) return;
  const path = await listingPath(kind, listingId);
  await queueBotDm({
    userId: to,
    kind: parentAuthorId ? 'comment.reply' : 'comment.review',
    title: parentAuthorId ? 'Someone replied to your review' : 'Your listing has a new review',
    body: parentAuthorId
      ? 'Somebody has replied to a review you wrote on YapBoard.'
      : 'Somebody has reviewed one of your listings on YapBoard. Replying is the best thing you can do with it - a review with the owner’s answer under it is worth far more to a reader than one without.',
    linkUrl: `${env.siteUrl}${path}#reviews`,
    linkLabel: parentAuthorId ? 'Read the reply' : 'Read it and reply',
  });
}

/** The author, changing their mind. Nobody else may ever edit what somebody wrote - not staff, not the owner. */
export async function editComment(commentId: string, userId: string, input: z.infer<typeof editSchema>): Promise<CommentResult> {
  const cfg = await getCommentsConfig();
  const row = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, rating: true, parentId: true, hiddenAt: true, createdAt: true, serverId: true, botId: true, clientId: true },
  });
  if (!row || row.hiddenAt) return { ok: false, status: 404, error: 'That comment isn’t there any more.' };
  if (row.userId !== userId) return { ok: false, status: 403, error: 'That isn’t yours to edit.' };

  const isReply = !!row.parentId;
  if (!isReply && input.body.trim().length < MIN_REVIEW_BODY) return { ok: false, status: 400, error: `Tell people a bit more (${MIN_REVIEW_BODY}+ characters).` };
  if (!isReply && cfg.ratings && !isRating(input.rating)) return { ok: false, status: 400, error: 'Pick a rating from 1 to 5.' };

  const { kind, listingId } = locate(row);
  const listing = await listingFacts(kind, listingId);
  if (!listing) return { ok: false, status: 404, error: 'That listing isn’t there any more.' };

  // A typo inside the grace window is not a revision, and marking it as one makes people wary of fixing typos.
  const fresh = Date.now() - row.createdAt.getTime() < cfg.editGraceMinutes * 60_000;
  await db.comment.update({
    where: { id: commentId },
    data: {
      body: input.body.trim(),
      rating: isReply ? null : (input.rating ?? row.rating),
      editedAt: fresh ? undefined : new Date(),
      // Re-judged, because the rules are about what the row says and it now says something else.
      counts: shouldCount({
        body: input.body,
        rating: isReply ? null : (input.rating ?? null),
        writerId: userId,
        ownerId: listing.ownerId,
        managerIds: listing.managerIds,
      }),
    },
  });

  await recount(kind, listingId);
  void refreshHotQuietly(kind, listingId);
  return { ok: true, id: commentId };
}

export type HideAs = 'author' | 'owner' | 'staff';

/**
 * Who may hide what.
 *
 * The owner branch is the careful one. An owner may hide a reply **under their own comment** and nothing
 * else: that is moderating the conversation they started. A review of their listing is not theirs to
 * remove at any price, and nor is a reply under somebody else's review - both of those go through a report
 * and a staff decision, with an audit trail, like every other removal on this board.
 */
export function hidePower(user: SessionUser | null, comment: { userId: string; parentId: string | null }, parent: { userId: string } | null, listing: ListingFacts): HideAs | null {
  if (!user || user.bannedAt) return null;
  if (isStaff(user)) return 'staff';
  if (comment.userId === user.id) return 'author';
  const runsIt = user.id === listing.ownerId || listing.managerIds.includes(user.id);
  if (runsIt && comment.parentId && parent && parent.userId === user.id) return 'owner';
  return null;
}

export async function hideComment(commentId: string, user: SessionUser, note?: string | null): Promise<CommentResult> {
  const row = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, parentId: true, hiddenAt: true, serverId: true, botId: true, clientId: true, parent: { select: { userId: true } } },
  });
  if (!row) return { ok: false, status: 404, error: 'That comment isn’t there any more.' };
  if (row.hiddenAt) return { ok: true, id: commentId };

  const { kind, listingId } = locate(row);
  const listing = await listingFacts(kind, listingId);
  if (!listing) return { ok: false, status: 404, error: 'That listing isn’t there any more.' };

  const as = hidePower(user, row, row.parent, listing);
  if (!as) return { ok: false, status: 403, error: 'That isn’t yours to hide. Report it instead and staff will look.' };

  await db.comment.update({ where: { id: commentId }, data: { hiddenAt: new Date(), hiddenById: user.id, hiddenAs: as, hiddenNote: note?.trim() || null } });
  await recount(kind, listingId);
  void refreshHotQuietly(kind, listingId);
  return { ok: true, id: commentId };
}

/** Putting one back. Staff always; the author only for something they hid themselves. */
export async function unhideComment(commentId: string, user: SessionUser): Promise<CommentResult> {
  const row = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, hiddenAt: true, hiddenAs: true, serverId: true, botId: true, clientId: true },
  });
  if (!row) return { ok: false, status: 404, error: 'That comment isn’t there any more.' };
  if (!row.hiddenAt) return { ok: true, id: commentId };
  const mineAndMine = row.userId === user.id && row.hiddenAs === 'author';
  if (!isStaff(user) && !mineAndMine) return { ok: false, status: 403, error: 'Only YapBoard staff can put that back.' };

  const { kind, listingId } = locate(row);
  await db.comment.update({ where: { id: commentId }, data: { hiddenAt: null, hiddenById: null, hiddenAs: null, hiddenNote: null } });
  await recount(kind, listingId);
  void refreshHotQuietly(kind, listingId);
  return { ok: true, id: commentId };
}

/** Which board and which listing a row belongs to, from the three nullable columns. */
export function locate(row: { serverId?: string | null; botId?: string | null; clientId?: string | null }): { kind: ListingKind; listingId: string } {
  if (row.serverId) return { kind: 'server', listingId: row.serverId };
  if (row.botId) return { kind: 'bot', listingId: row.botId };
  if (row.clientId) return { kind: 'client', listingId: row.clientId };
  // Every side cascades on delete, so this is the moment between a delete and a refresh.
  throw new Error('comment points at no listing');
}

/**
 * The listing's three counters, worked out again from the rows.
 *
 * Always recomputed, never incremented. An increment and a decrement that disagree by one is a rating that
 * is wrong forever and unprovable; this costs three counts and cannot drift. Only rows that still show are
 * counted, so hiding one takes it off the page and out of the average in the same write.
 */
export async function recount(kind: ListingKind, listingId: string, tx: Prisma.TransactionClient = db) {
  const idField = idFieldFor(kind);
  const visible = { [idField]: listingId, hiddenAt: null };
  const [reviews, comments] = await Promise.all([
    tx.comment.aggregate({ where: { ...visible, parentId: null, rating: { not: null } }, _count: { _all: true }, _sum: { rating: true } }),
    tx.comment.count({ where: visible }),
  ]);
  const data = { reviewCount: reviews._count._all, ratingSum: reviews._sum.rating ?? 0, commentCount: comments };
  if (kind === 'server') await tx.server.update({ where: { id: listingId }, data });
  else if (kind === 'bot') await tx.botListing.update({ where: { id: listingId }, data });
  else await tx.clientListing.update({ where: { id: listingId }, data });
}

/* ------------------------------------------------------------------ reading */

const writerSelect = { id: true, username: true, displayName: true, avatarUrl: true, role: true } as const;

const threadSelect = {
  id: true,
  rating: true,
  body: true,
  parentId: true,
  editedAt: true,
  hiddenAt: true,
  hiddenAs: true,
  createdAt: true,
  userId: true,
  user: { select: writerSelect },
} satisfies Prisma.CommentSelect;

/**
 * Everything the section under a listing draws, in four queries whatever the thread holds.
 *
 * Hidden rows are filtered here rather than in the query, because staff and the person who wrote one still
 * see them (greyed, labelled) - serving the page without them and then asking again for staff would be two
 * code paths that disagree about what exists.
 */
export async function loadThread(
  kind: ListingKind,
  listing: { id: string; reviewCount: number; ratingSum: number; commentCount: number },
  reader: SessionUser | null,
): Promise<Thread> {
  const idField = idFieldFor(kind);
  const [rows, mean] = await Promise.all([
    db.comment.findMany({ where: { [idField]: listing.id }, select: threadSelect, orderBy: { createdAt: 'asc' } }),
    boardMean(),
  ]);

  const pro = await proUsers(rows.map((r) => r.userId));
  const staff = isStaff(reader);
  const canSee = (r: (typeof rows)[number]) => !r.hiddenAt || staff || r.userId === reader?.id;

  const toComment = (r: (typeof rows)[number], replies: ThreadComment[], answered: boolean): ThreadComment => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    edited: !!r.editedAt,
    createdAt: r.createdAt.toISOString(),
    writer: {
      id: r.user.id,
      name: r.user.displayName || r.user.username,
      username: r.user.username,
      avatarUrl: r.user.avatarUrl,
      role: r.user.role,
      pro: pro.has(r.user.id),
    },
    hidden: r.hiddenAt ? { as: r.hiddenAs } : null,
    replies,
    answered,
  });

  const tops = rows.filter((r) => !r.parentId);
  const repliesByParent = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.parentId) continue;
    const list = repliesByParent.get(r.parentId) ?? [];
    list.push(r);
    repliesByParent.set(r.parentId, list);
  }

  const facts = await listingFacts(kind, listing.id);
  const runsIt = (id: string) => !!facts && (id === facts.ownerId || facts.managerIds.includes(id));

  // Newest first, but a thread an owner has answered floats up: it is the most useful thing on the page.
  const reviews = tops
    .map((r) => {
      const kids = (repliesByParent.get(r.id) ?? []).filter(canSee);
      const answered = (repliesByParent.get(r.id) ?? []).some((k) => !k.hiddenAt && runsIt(k.userId));
      return { row: r, comment: toComment(r, kids.map((k) => toComment(k, [], false)), answered) };
    })
    .filter((x) => canSee(x.row))
    .sort((a, b) => Number(b.comment.answered) - Number(a.comment.answered) || b.row.createdAt.getTime() - a.row.createdAt.getTime())
    .map((x) => x.comment);

  const own = reader ? tops.find((r) => r.userId === reader.id && !r.hiddenAt) : null;
  return {
    reviews,
    mine: own ? { id: own.id, rating: own.rating, body: own.body } : null,
    reviewCount: listing.reviewCount,
    ratingSum: listing.ratingSum,
    commentCount: listing.commentCount,
    boardMean: mean,
  };
}

/** The newest visible reviews across every board, for /activity and for the bot's weekly broadcast. */
export async function recentActivity(limit = 30) {
  return db.comment.findMany({
    where: {
      hiddenAt: null,
      OR: [{ server: { status: 'PUBLIC' } }, { bot: { status: 'PUBLIC' } }, { client: { status: 'PUBLIC' } }],
    },
    select: {
      ...threadSelect,
      server: { select: { id: true, name: true, iconUrl: true, accent: true } },
      bot: { select: { id: true, name: true, avatarUrl: true, accent: true } },
      client: { select: { slug: true, name: true, iconUrl: true, accent: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
