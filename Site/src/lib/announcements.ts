// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { z } from 'zod';
import { db } from './db';
import type { SessionUser } from './session';

/**
 * Site-wide notices, written by staff in the portal (/portal/announcements).
 *
 * Two kinds, and a page can show one of each:
 *   BANNER — a bar across the top of every page. Dismissible ones can be closed; the rest stay put.
 *   MODAL  — a dialog, shown once and then never again for that person.
 *
 * Who sees one is `audience`: everyone, only logged-in people, or only new ones (an account younger than
 * `newWithinHours`; a logged-out visitor has no account, so they count as new).
 *
 * "Already closed this" lives in AnnouncementSeen for logged-in people, so it follows them between browsers, and
 * in localStorage for everyone else. The server only filters by what it knows; the client hides the rest, which
 * is why an announcement is sent to the browser even when that visitor may have closed it already.
 */

export const TONES = {
  accent: 'YapBoard orange',
  info: 'Blue',
  warn: 'Amber',
  danger: 'Red',
} as const;
export type Tone = keyof typeof TONES;

export const AUDIENCES = {
  everyone: 'Everyone',
  users: 'Logged-in people',
  new: 'New people only',
} as const;
export type Audience = keyof typeof AUDIENCES;

export const KINDS = { BANNER: 'Top banner', MODAL: 'Dialog' } as const;
export type AnnouncementKind = keyof typeof KINDS;

export const announcementSchema = z.object({
  kind: z.enum(['BANNER', 'MODAL']),
  title: z.string().trim().min(3, 'Give it a title').max(120, 'Keep the title under 120 characters'),
  body: z.string().trim().min(3, 'Say something').max(1000, 'Max 1000 characters'),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .refine((v) => v === null || /^(https?:\/\/|\/)/.test(v), 'Use a full https link, or a path starting with /')
    .nullable(),
  linkLabel: z.string().trim().max(40).transform((v) => v || null).nullable(),
  tone: z.enum(Object.keys(TONES) as [Tone, ...Tone[]]),
  audience: z.enum(Object.keys(AUDIENCES) as [Audience, ...Audience[]]),
  newWithinHours: z.number().int().min(1).max(8760),
  dismissible: z.boolean(),
  startsAt: z.string().trim().nullable().transform((v) => (v ? new Date(v) : null)).refine((d) => !d || !Number.isNaN(d.getTime()), 'That start date is not a date'),
  endsAt: z.string().trim().nullable().transform((v) => (v ? new Date(v) : null)).refine((d) => !d || !Number.isNaN(d.getTime()), 'That end date is not a date'),
});

/** What a form sends: dates are still strings here; the schema turns them into Dates. */
export type AnnouncementInput = z.input<typeof announcementSchema>;

/** What the browser gets. No author, no counts: it's public. */
export type LiveAnnouncement = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  tone: Tone;
  dismissible: boolean;
};

const MS_PER_HOUR = 3_600_000;

/** The live announcements for this visitor, with "new people only" ones resolved against their account age. */
export async function announcementsFor(user: SessionUser | null): Promise<LiveAnnouncement[]> {
  const now = new Date();
  const rows = await db.announcement.findMany({
    where: {
      active: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      ...(user ? { seen: { none: { userId: user.id } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      linkUrl: true,
      linkLabel: true,
      tone: true,
      dismissible: true,
      audience: true,
      newWithinHours: true,
    },
  });
  if (!rows.length) return [];

  // Only look the account up when something actually asks how old it is.
  const needsAge = user && rows.some((r) => r.audience === 'new');
  const account = needsAge ? await db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }) : null;
  const ageHours = account ? (Date.now() - account.createdAt.getTime()) / MS_PER_HOUR : Infinity;

  const matches = (r: (typeof rows)[number]) => {
    if (r.audience === 'everyone') return true;
    if (r.audience === 'users') return !!user;
    // "new": a visitor with no account has nothing to go on, so they count as new.
    return !user || ageHours < r.newWithinHours;
  };

  const out: LiveAnnouncement[] = [];
  for (const kind of ['BANNER', 'MODAL'] as const) {
    const hit = rows.find((r) => r.kind === kind && matches(r));
    // A modal is always closeable; only banners can be permanent.
    if (hit) out.push({ id: hit.id, kind, title: hit.title, body: hit.body, linkUrl: hit.linkUrl, linkLabel: hit.linkLabel, tone: hit.tone as Tone, dismissible: kind === 'MODAL' ? true : hit.dismissible });
  }
  return out;
}

/** Remembers that this person closed it, so it doesn't come back on their other devices. */
export async function markSeen(announcementId: string, userId: string) {
  await db.announcementSeen.upsert({
    where: { announcementId_userId: { announcementId, userId } },
    create: { announcementId, userId },
    update: {},
  });
}
