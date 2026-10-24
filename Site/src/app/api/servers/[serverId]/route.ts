import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, json, readJson, requireUser } from '@/lib/http';
import { canManageListing, listingSchema, setTags } from '@/lib/servers';
import { isStaff } from '@/lib/session';

type Ctx = { params: Promise<{ serverId: string }> };

async function loadManaged(req: NextRequest, ctx: Ctx) {
  const g = await requireUser(req);
  if (g.error) return { error: g.error };
  const { serverId } = await ctx.params;
  const server = await db.server.findUnique({ where: { id: serverId }, select: { id: true, ownerId: true, status: true } });
  if (!server) return { error: fail('Not found', 404) };
  if (!canManageListing(g.user, server)) return { error: fail('You can’t edit this listing', 403) };
  return { user: g.user, server };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const m = await loadManaged(req, ctx);
  if (m.error) return m.error;
  const parsed = listingSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail('Check the form', 422, { fields: z.flattenError(parsed.error).fieldErrors });
  const { tags, unlisted, ...data } = parsed.data;
  // Owners can flip public/unlisted; staff decisions (HIDDEN/REMOVED) stay put.
  const status = m.server.status === 'PUBLIC' || m.server.status === 'UNLISTED' ? (unlisted ? 'UNLISTED' : 'PUBLIC') : m.server.status;
  await db.$transaction(async (tx) => {
    await tx.server.update({ where: { id: m.server.id }, data: { ...data, status } });
    await setTags(tx, m.server.id, tags);
  });
  return json({ ok: true, status });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const m = await loadManaged(req, ctx);
  if (m.error) return m.error;
  // A staff-removed listing stays as a tombstone so it can't simply be re-added.
  if (m.server.status === 'REMOVED') return fail('This listing was removed by staff', 403);
  if (!isStaff(m.user)) {
    // Deleting and re-adding would otherwise undo a staff hide, and take the reports against it with it.
    if (m.server.status === 'HIDDEN') return fail('YapBoard staff hid this listing, so it can’t be deleted. Contact us if you think that’s a mistake.', 403);
    const open = await db.report.count({ where: { serverId: m.server.id, status: 'OPEN' } });
    if (open) return fail('This listing has a report waiting for YapBoard staff. You can delete it once they’ve looked at it.', 409);
  }
  await db.server.delete({ where: { id: m.server.id } });
  return json({ ok: true });
}
