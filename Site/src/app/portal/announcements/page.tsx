// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffPage } from '@/lib/portal';
import { AUDIENCES, KINDS, TONES, type Audience, type AnnouncementKind, type Tone } from '@/lib/announcements';
import { PageHead } from '@/components/portal/PageHead';
import { AnnouncementEditor, type EditorRow } from '@/components/portal/AnnouncementEditor';

export const metadata: Metadata = { title: 'Announcements' };

/** <input type="datetime-local"> wants local wall-clock time with no zone, not an ISO string. */
const forInput = (d: Date | null) => {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default async function AnnouncementsPage() {
  await requireStaffPage('/announcements');
  const rows = await db.announcement.findMany({
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    include: { author: { select: { username: true } }, _count: { select: { seen: true } } },
  });

  const editorRows: EditorRow[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as AnnouncementKind,
    title: r.title,
    body: r.body,
    linkUrl: r.linkUrl ?? '',
    linkLabel: r.linkLabel ?? '',
    tone: r.tone as Tone,
    audience: r.audience as Audience,
    newWithinHours: r.newWithinHours,
    dismissible: r.dismissible,
    active: r.active,
    startsAt: forInput(r.startsAt),
    endsAt: forInput(r.endsAt),
    author: r.author.username,
    seenBy: r._count.seen,
  }));

  return (
    <div className="max-w-5xl">
      <PageHead title="Announcements" sub="A bar across the top of the site, or a dialog people see once. Only one of each shows at a time — the newest live one wins." />
      <AnnouncementEditor rows={editorRows} labels={{ kinds: KINDS, audiences: AUDIENCES, tones: TONES }} />
    </div>
  );
}
