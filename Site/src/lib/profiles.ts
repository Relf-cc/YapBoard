// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { z } from 'zod';
import { db } from './db';
import { sortBadges, type BadgeKind } from './badges';
import { proUsers } from './pro';
import { earnedBy, sortUserBadges, USER_BADGES, type UserBadgeKind } from './user-badges';

/**
 * A person's public page: what they run here, and what they have done.
 *
 * ## Why the counters are counted rather than kept
 *
 * Four `count()` calls, each on an index that already exists (`@@index([userId, createdAt])` on Bump,
 * BotBump, ClientBump and Vote). A `UserStats` row would save three queries on one page and buy a whole
 * class of bug in exchange - a counter nudged up in one place and not another is wrong forever and
 * unprovable. When a leaderboard eventually needs the roll-up, it should be written by the same call that
 * writes the comment, never by a second path that can drift from the first.
 *
 * ## Why it is worth having at all
 *
 * Every comment on the board becomes a link to one of these, and every one of these links back out to
 * listings. For a directory that is the cheapest internal linking there is. The other half is simpler:
 * somebody who has a page with their name on it comes back to look at it.
 */

export const profileSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(200, 'Keep it under 200 characters')
    .nullish()
    .transform((v) => v || null),
  link: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v))
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/\S+\.\S+/.test(v), 'Use a full https link, or leave it empty'),
  /** Their choice, and it hides the aggregate rather than the person - see the page itself. */
  profileHidden: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export type ProfileListing = {
  kind: 'server' | 'bot' | 'client';
  id: string;
  name: string;
  iconUrl: string | null;
  summary: string;
  href: string;
  badges: BadgeKind[];
  /** They co-manage it rather than own it, which the card says out loud. */
  helping: boolean;
  round: boolean;
  accent: string;
  reviewCount: number;
  ratingSum: number;
};

export type Profile = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  link: string | null;
  hidden: boolean;
  pro: boolean;
  joinedAt: Date;
  badges: UserBadgeKind[];
  counts: { bumps: number; votes: number; reviews: number; replies: number };
  listings: ProfileListing[];
};

const listingBadges = (rows: { kind: string }[]) => sortBadges(rows.map((b) => b.kind));

/**
 * Everything one profile draws, or null when there is nobody there.
 *
 * Hidden listings never appear, on anybody's profile, including their own - a profile is a public page and
 * what it shows has to be the same thing a stranger sees, or it quietly becomes a way to check whether
 * staff have hidden something.
 */
export async function loadProfile(userId: string, viewerIsStaff = false): Promise<Profile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      bio: true,
      link: true,
      profileHidden: true,
      bannedAt: true,
      createdAt: true,
      userBadges: { select: { kind: true } },
    },
  });
  // A banned account's page is gone for the public. Staff keep it, because that is when they need it most.
  if (!user || (user.bannedAt && !viewerIsStaff)) return null;

  const hidden = user.profileHidden && !viewerIsStaff;
  const base: Profile = {
    id: user.id,
    username: user.username,
    name: user.displayName || user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    bio: hidden ? null : user.bio,
    link: hidden ? null : user.link,
    hidden,
    pro: false,
    joinedAt: user.createdAt,
    badges: hidden ? [] : sortUserBadges(user.userBadges.map((b) => b.kind)),
    counts: { bumps: 0, votes: 0, reviews: 0, replies: 0 },
    listings: [],
  };
  if (hidden) return base;

  const own = { ownerId: userId };
  const helping = { managers: { some: { userId } } };
  const live = { status: 'PUBLIC' };

  const [bumps, botBumps, clientBumps, votes, reviews, replies, pro, servers, bots, clients] = await Promise.all([
    db.bump.count({ where: { userId } }),
    db.botBump.count({ where: { userId } }),
    db.clientBump.count({ where: { userId } }),
    db.vote.count({ where: { userId, revokedAt: null } }),
    db.comment.count({ where: { userId, parentId: null, hiddenAt: null } }),
    db.comment.count({ where: { userId, parentId: { not: null }, hiddenAt: null } }),
    proUsers([userId]),
    db.server.findMany({
      where: { ...live, OR: [own, helping] },
      select: { id: true, name: true, iconUrl: true, summary: true, accent: true, ownerId: true, reviewCount: true, ratingSum: true, badges: { select: { kind: true } } },
      orderBy: { hotScore: 'desc' },
      take: 24,
    }),
    db.botListing.findMany({
      where: { ...live, OR: [own, helping] },
      select: { id: true, name: true, avatarUrl: true, summary: true, accent: true, ownerId: true, reviewCount: true, ratingSum: true, badges: { select: { kind: true } } },
      orderBy: { hotScore: 'desc' },
      take: 24,
    }),
    db.clientListing.findMany({
      where: { ...live, OR: [own, helping] },
      select: { id: true, slug: true, name: true, iconUrl: true, summary: true, accent: true, ownerId: true, reviewCount: true, ratingSum: true, badges: { select: { kind: true } } },
      orderBy: { hotScore: 'desc' },
      take: 24,
    }),
  ]);

  base.pro = pro.has(userId);
  base.counts = { bumps: bumps + botBumps + clientBumps, votes, reviews, replies };
  base.listings = [
    ...servers.map((s): ProfileListing => ({
      kind: 'server',
      id: s.id,
      name: s.name,
      iconUrl: s.iconUrl,
      summary: s.summary,
      href: `/view/${s.id}`,
      badges: listingBadges(s.badges),
      helping: s.ownerId !== userId,
      round: false,
      accent: s.accent,
      reviewCount: s.reviewCount,
      ratingSum: s.ratingSum,
    })),
    ...bots.map((b): ProfileListing => ({
      kind: 'bot',
      id: b.id,
      name: b.name,
      iconUrl: b.avatarUrl,
      summary: b.summary,
      href: `/bots/${b.id}`,
      badges: listingBadges(b.badges),
      helping: b.ownerId !== userId,
      round: true,
      accent: b.accent,
      reviewCount: b.reviewCount,
      ratingSum: b.ratingSum,
    })),
    ...clients.map((c): ProfileListing => ({
      kind: 'client',
      id: c.id,
      name: c.name,
      iconUrl: c.iconUrl,
      summary: c.summary,
      href: `/clients/${c.slug}`,
      badges: listingBadges(c.badges),
      helping: c.ownerId !== userId,
      round: false,
      accent: c.accent,
      reviewCount: c.reviewCount,
      ratingSum: c.ratingSum,
    })),
  ];

  return base;
}

/**
 * Grant whatever this person's counts have earned.
 *
 * Grant-only, on purpose. Hiding one of somebody's reviews drops the count that earned them a badge, and
 * taking the badge back over it would turn one moderation decision into two punishments - so a badge once
 * earned stays. Staff can still remove one from the portal, which is the case where removing it is a
 * decision somebody made rather than a side effect.
 *
 * Cheap enough to call after any comment or bump: two counts and, at most, an insert.
 */
export async function syncUserBadges(userId: string): Promise<UserBadgeKind[]> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return [];

  const [reviews, bumps, botBumps, clientBumps, ahead, held] = await Promise.all([
    db.comment.count({ where: { userId, parentId: null, hiddenAt: null } }),
    db.bump.count({ where: { userId } }),
    db.botBump.count({ where: { userId } }),
    db.clientBump.count({ where: { userId } }),
    db.user.count({ where: { createdAt: { lt: user.createdAt } } }),
    db.userBadge.findMany({ where: { userId }, select: { kind: true } }),
  ]);

  const earned = earnedBy({ reviews, bumps: bumps + botBumps + clientBumps, joined: ahead + 1 });
  const have = new Set(held.map((h) => h.kind));
  const missing = earned.filter((k) => !have.has(k));
  if (!missing.length) return [];

  // createMany would be one statement, but skipDuplicates is not on SQLite - and two people's badges never
  // race for the same row anyway, so an upsert each is both portable and plainly correct.
  for (const kind of missing) {
    await db.userBadge.upsert({ where: { userId_kind: { userId, kind } }, create: { userId, kind }, update: {} });
  }
  return missing;
}

/** Never throws into the caller: a badge is a nice surprise, not part of posting a comment. */
export const syncUserBadgesQuietly = (userId: string) => syncUserBadges(userId).catch(() => []);

/** The blurb a staff member reads in the portal when granting one by hand. */
export const userBadgeBlurb = (kind: UserBadgeKind) => USER_BADGES[kind].blurb;
