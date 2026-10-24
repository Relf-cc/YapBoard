import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { countOnce } from '@/lib/http';
import { isViewable } from '@/lib/servers';

/** Counts the click, then sends people to the server's Yapin' invite. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await params;
  const s = await db.server.findUnique({ where: { id: serverId }, select: { inviteUrl: true, status: true } });
  if (!s || !isViewable(s.status)) return NextResponse.redirect(new URL('/servers', env.siteUrl));
  if (countOnce('join', serverId, req.headers)) await db.server.update({ where: { id: serverId }, data: { joins: { increment: 1 } } }).catch(() => {});
  return NextResponse.redirect(s.inviteUrl);
}
