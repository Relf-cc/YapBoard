// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { markSeen } from '@/lib/announcements';
import { fail, json, rateLimit, requireUser } from '@/lib/http';

/** "I've closed this." Logged-out visitors keep the same thing in their own browser instead. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ announcementId: string }> }) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`seen:${g.user.id}`, 60, 60_000)) return fail('Slow down', 429);
  const { announcementId } = await params;
  // An announcement deleted between the page loading and the click isn't worth an error.
  await markSeen(announcementId, g.user.id).catch(() => {});
  return json({ ok: true });
}
