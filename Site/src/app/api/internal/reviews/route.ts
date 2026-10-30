// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { getCommentsConfig } from '@/lib/comments';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { boardMean } from '@/lib/engagement';
import { fail, isInternal, json } from '@/lib/http';
import { displayRating } from '@/lib/ratings';

/**
 * The top few reviews of one server, for the bot's /reviews command.
 *
 * Reading in chat, writing on the site - which is the right split rather than a limitation. A star picker
 * does not fit in a chat message, and a review worth reading is longer than one somebody taps out into a
 * channel. So this hands over enough to be worth reading, and a link for the rest.
 *
 * Owner-answered reviews come first, for the same reason they do on the page: "the owner replied" is the
 * most useful thing a stranger can learn about a server before joining it.
 */
export async function GET(req: NextRequest) {
  if (!isInternal(req)) return fail('Unauthorized', 401);
  const serverId = new URL(req.url).searchParams.get('serverId') || '';
  if (!serverId) return fail('Bad request', 422);

  const cfg = await getCommentsConfig();
  const server = await db.server.findUnique({
    where: { id: serverId },
    select: { name: true, iconUrl: true, accent: true, status: true, ownerId: true, reviewCount: true, ratingSum: true },
  });
  if (!server) return json({ listed: false, addUrl: `${env.siteUrl}/add?server=${serverId}` });

  const url = `${env.siteUrl}/view/${serverId}`;
  if (!cfg.enabled) return json({ listed: true, name: server.name, paused: true, url });

  const [rows, mean] = await Promise.all([
    db.comment.findMany({
      where: { serverId, hiddenAt: null, parentId: null, rating: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        rating: true,
        body: true,
        createdAt: true,
        user: { select: { username: true, displayName: true } },
        replies: { where: { hiddenAt: null }, select: { userId: true, body: true } },
      },
    }),
    boardMean(),
  ]);

  const reviews = rows
    .map((r) => ({
      rating: r.rating,
      body: r.body,
      writer: r.user.displayName || r.user.username,
      at: r.createdAt.toISOString(),
      ownerReply: r.replies.find((x) => x.userId === server.ownerId)?.body ?? null,
    }))
    .sort((a, b) => Number(!!b.ownerReply) - Number(!!a.ownerReply))
    .slice(0, 3);

  return json({
    listed: true,
    name: server.name,
    iconUrl: server.iconUrl,
    accent: server.accent,
    reviewCount: server.reviewCount,
    rating: displayRating(server.ratingSum, server.reviewCount, mean),
    reviews,
    url,
  });
}
