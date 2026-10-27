// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { NextResponse, type NextRequest } from 'next/server';
import { isClientViewable } from '@/lib/clients';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { countOnce } from '@/lib/http';

/**
 * Counts a download, then hands the visitor over to wherever the file actually lives.
 *
 * YapBoard never serves or mirrors a client's files. This is a counter and a redirect, nothing more: the
 * Trust & Safety dialog has already told the visitor they're leaving for somebody else's download, and the
 * address bar lands on that somebody. The URL is re-checked here rather than trusted from the row, so even a
 * bad write can't turn this into an open redirect to anything but https.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string; fileId: string }> }) {
  const { clientId, fileId } = await params;
  const back = (slug?: string) => NextResponse.redirect(new URL(slug ? `/clients/${encodeURIComponent(slug)}` : '/clients', env.siteUrl));

  const id = Number(fileId);
  if (!Number.isSafeInteger(id) || id <= 0) return back();

  const file = await db.clientDownload.findUnique({
    where: { id },
    select: { url: true, clientId: true, client: { select: { slug: true, status: true } } },
  });
  // A listing nobody can see has no page to go back to, so those land on the board instead of a 404.
  const viewable = !!file && isClientViewable(file.client.status);
  if (!file || file.clientId !== clientId || !viewable) return back(viewable ? file?.client.slug : undefined);
  if (!/^https:\/\/\S+$/.test(file.url)) return back(file.client.slug);

  // One person refreshing can't pump the counter: the same rule views and joins use.
  if (countOnce('join', `client-file:${id}`, req.headers)) {
    await db
      .$transaction([
        db.clientDownload.update({ where: { id }, data: { clicks: { increment: 1 } } }),
        db.clientListing.update({ where: { id: clientId }, data: { downloads: { increment: 1 } } }),
      ])
      .catch(() => {});
  }
  return NextResponse.redirect(file.url);
}
