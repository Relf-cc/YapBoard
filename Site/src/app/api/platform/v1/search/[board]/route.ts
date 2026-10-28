// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { sortBadges } from '@/lib/badges';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, json } from '@/lib/http';
import { handle, searchLimit, type Endpoint } from '@/lib/platform';
import { readPlatforms } from '@/lib/clients';
import { normalizeTag } from '@/lib/tags';

type Ctx = { params: Promise<{ board: string }> };

const BOARDS = { servers: 'search.servers', bots: 'search.bots', clients: 'search.clients' } as const satisfies Record<string, Endpoint>;
type Board = keyof typeof BOARDS;
const isBoard = (b: string): b is Board => b in BOARDS;

/**
 * Search, one route per board: /search/servers, /search/bots, /search/clients.
 *
 * Public listings only, NSFW left out, and a small page: this is for answering "any art servers?" in a
 * channel, not for copying the board (see the platform terms). Everything it returns is already on a public
 * page, so a bot can post it without leaking anything.
 *
 * The three answers have the same shape — `{ total, items }`, each item carrying `id`, `name`, `summary`,
 * `tags`, `badges` and `url` — so one command can render whichever board it was pointed at. What differs is
 * the number each board is ranked by: members, servers, downloads.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { board } = await params;
  if (!isBoard(board)) return fail('Search /search/servers, /search/bots or /search/clients', 404);

  return handle(req, BOARDS[board], async () => {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim().slice(0, 80);
    const tag = normalizeTag(sp.get('tag') || '');
    const take = searchLimit(sp.get('limit'));
    if (!q && !tag) return fail('Send `q`, `tag`, or both', 422);

    // Same three conditions on every board: listed, safe, and matching either the name or the one-liner.
    const match = {
      status: 'PUBLIC',
      nsfw: false,
      ...(q ? { OR: [{ name: { contains: q } }, { summary: { contains: q } }] } : {}),
      ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    };
    const tags = { select: { tag: { select: { name: true } } } } as const;
    const badges = { select: { kind: true } } as const;
    const common = (row: { tags: { tag: { name: string } }[]; badges: { kind: string }[] }) => ({
      tags: row.tags.map((t) => t.tag.name),
      badges: sortBadges(row.badges.map((b) => b.kind)),
    });

    if (board === 'bots') {
      const where = match;
      const [rows, total] = await Promise.all([
        db.botListing.findMany({
          where,
          // Recently bumped first, then the biggest — the order /bots itself uses.
          orderBy: [{ bumpedAt: 'desc' }, { serverCount: 'desc' }],
          take,
          select: { id: true, name: true, summary: true, avatarUrl: true, prefix: true, serverCount: true, badges, tags },
        }),
        db.botListing.count({ where }),
      ]);
      return json({
        board,
        total,
        items: rows.map((b) => ({
          id: b.id,
          name: b.name,
          summary: b.summary,
          avatarUrl: b.avatarUrl,
          prefix: b.prefix,
          serverCount: b.serverCount,
          ...common(b),
          url: `${env.siteUrl}/bots/${b.id}`,
        })),
      });
    }

    if (board === 'clients') {
      const where = match;
      const [rows, total] = await Promise.all([
        db.clientListing.findMany({
          where,
          orderBy: [{ bumpedAt: 'desc' }, { downloads: 'desc' }],
          take,
          select: { id: true, slug: true, name: true, summary: true, iconUrl: true, platforms: true, version: true, downloads: true, badges, tags },
        }),
        db.clientListing.count({ where }),
      ]);
      return json({
        board,
        total,
        items: rows.map((c) => ({
          // A client has no Yapin' id of its own, so the slug is what a follow-up call uses.
          id: c.id,
          slug: c.slug,
          name: c.name,
          summary: c.summary,
          iconUrl: c.iconUrl,
          platforms: readPlatforms(c.platforms),
          version: c.version,
          downloads: c.downloads,
          ...common(c),
          url: `${env.siteUrl}/clients/${c.slug}`,
        })),
      });
    }

    const where = match;
    const [rows, total] = await Promise.all([
      db.server.findMany({
        where,
        // Recently bumped first: the same order the board itself uses, so a bot's answer matches the site's.
        orderBy: [{ rankedAt: 'desc' }, { memberCount: 'desc' }],
        take,
        select: { id: true, name: true, summary: true, iconUrl: true, memberCount: true, badges, tags },
      }),
      db.server.count({ where }),
    ]);
    return json({
      board,
      total,
      items: rows.map((s) => ({
        id: s.id,
        name: s.name,
        summary: s.summary,
        iconUrl: s.iconUrl,
        memberCount: s.memberCount,
        ...common(s),
        url: `${env.siteUrl}/view/${s.id}`,
      })),
    });
  });
}
