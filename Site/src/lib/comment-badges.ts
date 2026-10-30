// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Who is this, in relation to the thing they wrote under?
 *
 * Small chips beside a name in a thread - "Owner", "YapBoard Staff" - and deliberately not the scalloped
 * seals in src/lib/badges.ts. Those mark a *listing*; these mark a person's standing in one conversation,
 * they sit at 11px next to a username, and mixing the two vocabularies would make a reply from an owner
 * look like a staff endorsement of the listing.
 *
 * ## Why none of this is stored
 *
 * Every badge here is worked out at render time from rows the listing page already has. Storing the answer
 * on the Comment row would be faster by one join and wrong by however long it has been since the person was
 * promoted, demoted, banned, or sold the server - and a stale "YapBoard Staff" chip on somebody who no
 * longer is one is not a cache miss, it is a lie about who is speaking. So: no column, no backfill, nothing
 * to go stale.
 *
 * No 'server-only': the thread renders on the client, so this has to cross over. It touches no database.
 */

export type CommenterBadgeKind = 'ADMIN' | 'STAFF' | 'OWNER' | 'TEAM' | 'PRO' | 'AUTHOR';

export type CommenterBadgeDef = {
  label: string;
  /** The tooltip. Says what standing the chip actually represents, since "Team" alone is guessable but vague. */
  title: string;
  /** Tailwind classes for the chip. Tokens from globals.css, never raw hex. */
  className: string;
};

export const COMMENTER_BADGES = {
  ADMIN: {
    label: 'YapBoard Admin',
    title: 'A YapBoard administrator',
    className: 'border-transparent bg-[var(--support)] text-[#2a1403] font-bold',
  },
  STAFF: {
    label: 'YapBoard Staff',
    title: 'A member of the YapBoard team',
    className: 'border-[var(--support)]/50 bg-[var(--support)]/12 text-[var(--support)]',
  },
  OWNER: {
    label: 'Owner',
    title: 'Listed this, and runs it',
    className: 'border-transparent bg-accent text-on-accent font-bold',
  },
  TEAM: {
    label: 'Team',
    title: 'A co-manager of this listing',
    className: 'border-accent-soft bg-accent-soft text-accent',
  },
  PRO: {
    label: 'Pro',
    title: 'Has a YapBoard Pro plan',
    className: 'border-[#7a45f0]/45 bg-[#7a45f0]/12 text-[#b79bff]',
  },
  AUTHOR: {
    label: 'OP',
    title: 'Wrote the review this is under',
    className: 'border-line-strong bg-surface-2 text-ink-3',
  },
} as const satisfies Record<CommenterBadgeKind, CommenterBadgeDef>;

/** Display order, most important first - object keys keep their insertion order, so it is the order above. */
export const COMMENTER_BADGE_ORDER = Object.keys(COMMENTER_BADGES) as CommenterBadgeKind[];

/** What `commenterBadges` needs to know about the person who wrote it. */
export type Commenter = {
  id: string;
  role?: string | null;
  pro?: boolean;
  /**
   * Owns YapBoard itself. Worked out on the server (`isSiteOwner` in src/lib/env.ts) and passed through as
   * a plain boolean, so the owner's account id never reaches the browser just to draw a chip.
   */
  siteOwner?: boolean;
};

/** What it needs to know about the listing it was written under. */
export type CommentedListing = { ownerId: string; managers: { userId: string }[] };

/**
 * The chips for one comment, in display order.
 *
 * `parentAuthorId` is the writer of the review this sits under, which is how "OP" is found - and it is left
 * off for a top-level review, because every review is by definition its own author and the chip would be on
 * every one of them.
 *
 * Owner and Team are mutually exclusive, and Owner wins: an owner who is also in `managers` (which can
 * happen, harmlessly, if they added themselves) should read as the owner.
 */
export function commenterBadges(
  writer: Commenter,
  listing: CommentedListing,
  parentAuthorId?: string | null,
): CommenterBadgeKind[] {
  const out: CommenterBadgeKind[] = [];
  /*
    The owner gets no chip here at all - they get the sparkling seal instead (`OwnerMark` in
    src/components/Badge.tsx), drawn outside this row the way ProMark is on a listing page.

    They still suppress the staff chip, though, and that is the whole reason `siteOwner` is still read in
    here: the owner is necessarily an admin, and a seal followed by "YapBoard Admin" says one thing twice.
  */
  if (writer.siteOwner) {
    // nothing: the seal says it
  } else if (writer.role === 'ADMIN') out.push('ADMIN');
  else if (writer.role === 'STAFF') out.push('STAFF');

  if (writer.id === listing.ownerId) out.push('OWNER');
  else if (listing.managers.some((m) => m.userId === writer.id)) out.push('TEAM');

  if (writer.pro) out.push('PRO');
  if (parentAuthorId && writer.id === parentAuthorId) out.push('AUTHOR');

  return COMMENTER_BADGE_ORDER.filter((k) => out.includes(k));
}

/** True when this comment's thread has a reply from the owner or a co-manager - the "Owner replied" mark. */
export const answeredByTeam = (
  listing: CommentedListing,
  replies: readonly { userId: string }[],
): boolean => replies.some((r) => r.userId === listing.ownerId || listing.managers.some((m) => m.userId === r.userId));
