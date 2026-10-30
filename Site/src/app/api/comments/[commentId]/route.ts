// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { editComment, editSchema, hideComment, unhideComment } from '@/lib/comments';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';

type Ctx = { params: Promise<{ commentId: string }> };

/** Change what you wrote. The author only - not staff, not the listing's owner (src/lib/comments.ts). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { commentId } = await params;
  if (!rateLimit(`comment-edit:${g.user.id}`, 10, 60_000)) return fail('Slow down a little', 429);
  const parsed = editSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check what you’ve written', 422);

  const r = await editComment(commentId, g.user.id, parsed.data);
  return r.ok ? json({ id: r.id }) : fail(r.error, r.status);
}

const hideBody = z.object({ note: z.string().trim().max(500).nullish() }).nullish();

/**
 * Hide it. Nothing is deleted here or anywhere else in this codebase - the row stays, stops showing and
 * stops counting, and putting it back is one call (POST, below).
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { commentId } = await params;
  if (!rateLimit(`comment-hide:${g.user.id}`, 30, 60_000)) return fail('Slow down a little', 429);
  const parsed = hideBody.safeParse(await readJson(req));

  const r = await hideComment(commentId, g.user, parsed.success ? (parsed.data?.note ?? null) : null);
  return r.ok ? json({ id: r.id }) : fail(r.error, r.status);
}

/** Put one back. Staff always; the author only for something they hid themselves. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  const { commentId } = await params;
  const r = await unhideComment(commentId, g.user);
  return r.ok ? json({ id: r.id }) : fail(r.error, r.status);
}
