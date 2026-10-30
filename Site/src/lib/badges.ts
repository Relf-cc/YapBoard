// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Staff-granted badges. Every badge is the same scalloped, glistening seal (src/components/Badge.tsx) and
 * differs only by colour and icon, so adding one is a single entry here - nothing else needs to change.
 *
 * A server can hold several (the ServerBadge table). They're shown in the order they're listed below.
 */

/** Icon drawn in white inside the seal, on a 24x24 grid. `w` sets a stroke width; without it the path is filled. */
export type BadgeIcon = readonly { d: string; w?: number }[];

export type MarkDef = {
  /** Short name, for chips and the staff portal */
  label: string;
  /** Full name, used in tooltips and on the listing page */
  long: string;
  /** One line explaining what it means */
  blurb: string;
  from: string;
  to: string;
  glow: string;
  icon: BadgeIcon;
  /**
   * Extra sparkles, beyond the one every seal gets.
   *
   * Data rather than a component, so a mark that should catch the eye says so here and nothing else
   * changes - the same reason the colours live in this file. Used once, for the owner.
   */
  sparkle?: number;
};

/** Icons sit inside a circle of radius ~7 around (12, 12) so the seal's lobes never clip them. */
const CHECK: BadgeIcon = [{ d: 'M7.7 12.4l2.9 2.9 5.8-6.2', w: 2.3 }];
const RINGS: BadgeIcon = [
  { d: 'M12.9 12a3.15 3.15 0 1 1-6.3 0 3.15 3.15 0 1 1 6.3 0', w: 1.8 },
  { d: 'M17.4 12a3.15 3.15 0 1 1-6.3 0 3.15 3.15 0 1 1 6.3 0', w: 1.8 },
];
const FLAG: BadgeIcon = [{ d: 'M8.9 5.8V18.2', w: 2.1 }, { d: 'M10.1 6.6 17.3 9.3 10.1 12z' }];
const STAR: BadgeIcon = [{ d: 'M12 5.4 13.82 9.49 18.28 9.96 14.95 12.96 15.88 17.34 12 15.1 8.12 17.34 9.05 12.96 5.72 9.96 10.18 9.49z' }];
const FLAME: BadgeIcon = [{ d: 'M12 5.27c2.73 2.64 4.55 4.46 4.55 7.19a4.55 4.55 0 0 1-9.1 0c0-1.46.55-2.64 1.36-3.55.09 1.09.73 1.82 1.55 2.09-.55-2.46.09-4.19 1.64-5.73z' }];
const HEART: BadgeIcon = [{ d: 'M12 17.4C8.76 14.88 6.78 13.08 6.78 11.1a2.7 2.7 0 0 1 5.22-1.08 2.7 2.7 0 0 1 5.22 1.08c0 1.98-1.98 3.78-5.22 6.3z' }];
const HOURGLASS: BadgeIcon = [{ d: 'M8.6 7.4h6.8M8.6 16.6h6.8', w: 1.8 }, { d: 'M9.5 7.8h5L12 12l2.5 4.2h-5L12 12z' }];
const LIFEBUOY: BadgeIcon = [
  { d: 'M18.6 12a6.6 6.6 0 1 1-13.2 0 6.6 6.6 0 1 1 13.2 0', w: 1.9 },
  { d: 'M14.8 12a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 1 1 5.6 0', w: 1.9 },
  { d: 'M13.98 10.02 16.67 7.33M10.02 10.02 7.33 7.33M13.98 13.98 16.67 16.67M10.02 13.98 7.33 16.67', w: 1.9 },
];
const BOLT: BadgeIcon = [{ d: 'M12.81 5.34 8.31 12.81h2.7l-.72 5.85 4.5-7.47h-2.7z' }];
/** Three peaks and a band. Sits inside the lobes like the rest, so it never clips. */
const CROWN: BadgeIcon = [
  { d: 'M6.3 9.5 9.2 12.1 12 7.8 14.8 12.1 17.7 9.5 16.7 15.6 7.3 15.6z' },
  { d: 'M7.6 17.3h8.8', w: 1.5 },
];

export const BADGES = {
  OFFICIAL: {
    label: 'Official',
    long: 'Official Yapin’ server',
    blurb: 'Run by the Yapin’ team.',
    from: '#3fe39e',
    to: '#0d9e62',
    glow: '#1fc47f',
    icon: CHECK,
  },
  SUPPORT: {
    label: 'Support',
    long: 'Official YapBoard support server',
    blurb: 'The YapBoard team’s own server - help, bug reports and updates.',
    // A hotter, purer orange than the board's coral accent, so it reads as YapBoard's own without matching Featured.
    from: '#ffab4d',
    to: '#f06400',
    glow: '#ff8c1a',
    icon: LIFEBUOY,
  },
  VERIFIED: {
    label: 'Verified',
    long: 'Verified by YapBoard staff',
    blurb: 'YapBoard staff checked this server is who it says it is.',
    from: '#5cbcff',
    to: '#1683ea',
    glow: '#2b9bff',
    icon: CHECK,
  },
  PARTNER: {
    label: 'Partner',
    long: 'YapBoard partner',
    blurb: 'Works with YapBoard on events and cross-promotion.',
    from: '#ff8ad8',
    to: '#d62fa0',
    glow: '#f255bd',
    icon: RINGS,
  },
  FOUNDER: {
    label: 'Founder',
    long: 'Founding server',
    blurb: 'One of the first 25 servers listed on YapBoard.',
    from: '#ffd977',
    to: '#e0a019',
    glow: '#f2bb3c',
    icon: FLAG,
  },
  FEATURED: {
    label: 'Featured',
    long: 'Featured by YapBoard',
    blurb: 'Hand-picked by staff as somewhere worth a look.',
    from: '#ff9d74',
    to: '#f2561f',
    glow: '#ff7a45',
    icon: STAR,
  },
  FAVOURITE: {
    label: 'Favourite',
    long: 'Community favourite',
    blurb: 'One of the most-voted servers on the board.',
    from: '#6ef0dd',
    to: '#0fab9c',
    glow: '#22cbba',
    icon: HEART,
  },
  TRENDING: {
    label: 'Trending',
    long: 'Trending on YapBoard',
    blurb: 'Picking up votes and members fast right now.',
    from: '#ff8f8f',
    to: '#d61f3c',
    glow: '#ff4d63',
    icon: FLAME,
  },
  VETERAN: {
    label: 'Veteran',
    long: 'Veteran server',
    blurb: 'Listed on YapBoard for over a year.',
    from: '#dde7f5',
    to: '#7a8ca8',
    glow: '#a8b8cc',
    icon: HOURGLASS,
  },
} as const satisfies Record<string, MarkDef>;

export type BadgeKind = keyof typeof BADGES;

/** Display order, most important first. Object keys keep their insertion order, so it's the order above. */
export const BADGE_ORDER = Object.keys(BADGES) as BadgeKind[];

export const isBadge = (v: unknown): v is BadgeKind => typeof v === 'string' && v in BADGES;

/** Cleans a set of badge keys from the database: drops anything unknown, dedupes, and puts them in display order. */
export const sortBadges = (kinds: readonly (string | null | undefined)[]): BadgeKind[] => BADGE_ORDER.filter((k) => kinds.includes(k));

/** The one badge that stands for a server in tight spots (search suggestions, sorting). */
export const topBadge = (kinds: readonly (string | null | undefined)[]): BadgeKind | null => BADGE_ORDER.find((k) => kinds.includes(k)) ?? null;

/**
 * The support badge is the one badge that changes the listing around it: cards and listing pages holding it get
 * a lit orange frame and a slow beam (`.support-card` and friends in src/app/globals.css).
 */
export const hasSupport = (kinds: readonly (string | null | undefined)[]): boolean => kinds.includes('SUPPORT');

/** YapBoard Pro. Bought, not granted, so it isn't a badge - but it's drawn as the same seal. */
export const PRO_MARK: MarkDef = {
  label: 'Pro',
  long: 'YapBoard Pro',
  blurb: 'This listing is on a YapBoard Pro plan.',
  from: '#c39bff',
  to: '#7a45f0',
  glow: '#9a6bff',
  icon: BOLT,
};

/**
 * YapBoard's owner. Not a badge either - there is exactly one, it is not granted and cannot be, so it
 * lives beside PRO rather than in BADGES (which the portal can hand out).
 *
 * Gold, but a brighter and more polished gold than FOUNDER's, because the two would otherwise read as the
 * same award at a glance. The extra sparkles are the point: this is the one mark on the board that should
 * catch your eye.
 */
export const OWNER_MARK: MarkDef = {
  label: 'Owner',
  long: 'YapBoard Owner',
  blurb: 'Built and runs YapBoard.',
  from: '#fff0b8',
  to: '#ef9c0b',
  glow: '#ffc53d',
  icon: CROWN,
  sparkle: 3,
};

/** Everything Badge.tsx knows how to draw: the grantable badges, plus the two that are not. */
export type MarkKind = BadgeKind | 'PRO' | 'OWNER';

/**
 * Annotated rather than inferred, because BADGES is `as const` and its members therefore have literal
 * types that do not carry the optional fields of MarkDef - so an inferred union would make `sparkle`
 * invisible on nine of the eleven marks and fail to compile where it is read.
 */
export const MARKS: Record<MarkKind, MarkDef> = { ...BADGES, PRO: PRO_MARK, OWNER: OWNER_MARK };
