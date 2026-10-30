// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Badges on a person: what they have done here, rather than what staff think of a listing.
 *
 * The cheapest incentive there is. They cost nothing to give, they show up next to every comment the
 * person writes and on a page with their own name on it, and - unlike a leaderboard - they reward doing a
 * thing rather than doing more of it than somebody else, so nobody has to lose for somebody to win.
 *
 * `badges.ts` is the listing equivalent and this deliberately does not share its scalloped seal: a seal on
 * a listing is a judgement YapBoard is making about that listing, and a person's badge is a fact about
 * them. Same idea, different voice.
 *
 * No 'server-only' - the profile and the thread both draw these. The earning lives in `user-badges-server`
 * paths of this file's companion functions in src/lib/profiles.ts.
 */

/** Which palette the chip uses. The component owns the actual classes. */
export type BadgeTone = 'gold' | 'orange' | 'blue' | 'green' | 'grey';

export type UserBadgeDef = {
  label: string;
  blurb: string;
  tone: BadgeTone;
  /** Looked up in the icon map in src/components/UserBadges.tsx. */
  icon: 'flag' | 'pen' | 'quote' | 'chevrons' | 'heart';
  /**
   * What earns it, as a count of the thing named in `counts`. Null means staff hand it out and nothing
   * else ever grants it.
   */
  earn: { counts: 'reviews' | 'bumps' | 'joined'; at: number } | null;
};

export const USER_BADGES = {
  OG: {
    label: 'OG',
    blurb: 'One of the first people on YapBoard.',
    tone: 'gold',
    icon: 'flag',
    earn: { counts: 'joined', at: 250 },
  },
  REVIEWER: {
    label: 'Reviewer',
    blurb: 'Has written ten reviews that still stand.',
    tone: 'blue',
    icon: 'pen',
    earn: { counts: 'reviews', at: 10 },
  },
  CRITIC: {
    label: 'Critic',
    blurb: 'Fifty reviews. A good chunk of what there is to read here.',
    tone: 'orange',
    icon: 'quote',
    earn: { counts: 'reviews', at: 50 },
  },
  BUMPER: {
    label: 'Bumper',
    blurb: 'Has bumped listings a hundred times.',
    tone: 'green',
    icon: 'chevrons',
    earn: { counts: 'bumps', at: 100 },
  },
  HELPER: {
    label: 'Helper',
    blurb: 'Consistently useful in the replies. Given by YapBoard staff.',
    tone: 'grey',
    icon: 'heart',
    earn: null,
  },
} as const satisfies Record<string, UserBadgeDef>;

export type UserBadgeKind = keyof typeof USER_BADGES;

/** Display order, most notable first - object keys keep their insertion order, so it is the order above. */
export const USER_BADGE_ORDER = Object.keys(USER_BADGES) as UserBadgeKind[];

export const isUserBadge = (v: unknown): v is UserBadgeKind => typeof v === 'string' && v in USER_BADGES;

/** Cleans a set from the database: drops anything unknown, dedupes, and puts them in display order. */
export const sortUserBadges = (kinds: readonly (string | null | undefined)[]): UserBadgeKind[] =>
  USER_BADGE_ORDER.filter((k) => kinds.includes(k));

/** The ones a count can earn, so the sync loop doesn't have to know which are staff-only. */
export const EARNABLE = USER_BADGE_ORDER.filter((k) => USER_BADGES[k].earn !== null);

/**
 * Which earned badges these counts deserve.
 *
 * `joined` is the person's position in the sign-up order, so "one of the first 250" is `joined <= 250`,
 * where every other count is a floor. Pure, so it can be unit-reasoned about and reused by a backfill.
 */
export function earnedBy(counts: { reviews: number; bumps: number; joined: number }): UserBadgeKind[] {
  return EARNABLE.filter((k) => {
    const earn = USER_BADGES[k].earn!;
    return earn.counts === 'joined' ? counts.joined <= earn.at : counts[earn.counts] >= earn.at;
  });
}
