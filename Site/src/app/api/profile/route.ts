// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { fail, json, rateLimit, readJson, requireUser } from '@/lib/http';
import { db } from '@/lib/db';
import { profileSchema } from '@/lib/profiles';

/** Your own bio, link and whether the page is public. Nobody can change anybody else's. */
export async function PATCH(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`profile:${g.user.id}`, 10, 60_000)) return fail('Slow down a little', 429);
  const parsed = profileSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check what you’ve written', 422);

  await db.user.update({ where: { id: g.user.id }, data: parsed.data });
  return json({ ok: true });
}
