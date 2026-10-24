/** Staff-granted checkmarks. Official outranks verified; a server has at most one. */
export const BADGES = {
  VERIFIED: { label: 'Verified', long: 'Verified by YapBoard staff', blurb: 'YapBoard staff checked this server is who it says it is.' },
  OFFICIAL: { label: 'Official', long: 'Official Yapin’ server', blurb: 'Run by the Yapin’ team.' },
} as const;

export type BadgeKind = keyof typeof BADGES;

export const isBadge = (v: unknown): v is BadgeKind => v === 'VERIFIED' || v === 'OFFICIAL';
