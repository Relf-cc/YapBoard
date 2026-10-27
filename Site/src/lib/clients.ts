// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { sortBadges, type BadgeKind } from './badges';
import { db } from './db';
import { fetchLatestRelease, parseRepo, type ReleaseFailure } from './github';
import { LANGUAGES } from './languages';
import { classifyAsset, isNoise, isPlatform, PLATFORM_ORDER, type Platform } from './platforms';
import { MAX_MANUAL_FILES, MAX_SCREENSHOTS, isTheme, RESERVED_SLUGS, slugify } from './client-fields';
import { MAX_TAGS, normalizeTags } from './tags';
import type { SessionUser } from './session';
import { isStaff } from './session';

/** The form's own shape — themes, release sources, limits — lives in a module the browser can import too. */
export * from './client-fields';

/**
 * Client listings: the third board.
 *
 * A client is somebody's own build of Yapin' — a modified desktop app, shipped as its own executable. That
 * makes it unlike the other two boards in one way that drives most of this file: there is nothing on Yapin' to
 * check it against. A server has an invite and a member count; a bot has an account and a support server. A
 * client is a file on somebody else's release page, so ownership can't be proved the way it is for a bot, and
 * the file itself is something a visitor is about to run on their own machine.
 *
 * Two things follow from that:
 *
 * - Every listing is reviewed by staff before it goes up, the same queue bots use, and the lister has to accept
 *   the client terms and Yapin's terms before they can even submit (ClientListing.termsAgreedAt).
 * - Downloads are never proxied, mirrored or scanned here. YapBoard shows where a file lives and warns people
 *   plainly before sending them to it (components/clients/DownloadPanel.tsx).
 *
 * Downloads normally come from a GitHub repo's latest release, re-read from GitHub and never trusted from the
 * form. A lister whose client lives elsewhere can keep the links themselves instead (releaseSource MANUAL).
 */

/** Same as servers and bots, so "recently bumped" means the same thing across all three boards. */
export const CLIENT_BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** How long a synced release is good for before a page view quietly refreshes it in the background. */
export const RELEASE_TTL_MS = 30 * 60_000;

/* ---------------- slugs ---------------- */

/**
 * A slug nothing else is using. Names collide more here than elsewhere — half the clients on any board are
 * called some variation of the app they fork — so a taken one gets -2, -3 and so on rather than being refused.
 */
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'client';
  const safe = RESERVED_SLUGS.has(base) ? `${base}-client` : base;
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? safe : `${safe}-${n}`;
    if (!(await db.clientListing.findUnique({ where: { slug: candidate }, select: { slug: true } }))) return candidate;
  }
  return `${safe}-${Date.now().toString(36)}`;
}

/* ---------------- status ---------------- */

export const isClientViewable = (status: string) => status === 'PUBLIC' || status === 'UNLISTED';
export const isClientPending = (status: string) => status === 'PENDING';
export const isClientDenied = (status: string) => status === 'DENIED';

/** Where an approved listing goes: back to whatever the lister asked for. */
export const approvedClientStatus = (requestedUnlisted: boolean) => (requestedUnlisted ? 'UNLISTED' : 'PUBLIC');

/** Statuses a lister can still edit their way out of. HIDDEN and REMOVED are staff decisions that stay put. */
export const isClientOwnerEditable = (status: string) =>
  status === 'PUBLIC' || status === 'UNLISTED' || status === 'PENDING' || status === 'DENIED';

export function canManageClient(user: SessionUser | null, client: { ownerId: string }) {
  return !!user && !user.bannedAt && (user.id === client.ownerId || isStaff(user));
}

/* ---------------- the form ---------------- */

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/** A link. A bare "example.com" is read as https, anything else has to look like a URL. */
const httpsUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v))
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/\S+\.\S+/.test(v), message);

/** One download the lister keeps themselves. Managed rows never come through the form (lib/clients.ts sync). */
export const manualFileSchema = z.object({
  platform: z.string().refine(isPlatform, 'Pick a platform'),
  label: z.string().trim().min(2, 'Give it a name').max(120, 'Keep it under 120 characters'),
  url: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v))
    .refine((v) => /^https:\/\/\S+\.\S+/.test(v), 'Use a full https link'),
  kind: z
    .string()
    .trim()
    .max(16)
    .nullish()
    .transform((v) => (v || '').replace(/^\./, '').toLowerCase()),
});

export type ManualFile = z.infer<typeof manualFileSchema>;

export const clientListingSchema = z.object({
  name: z.string().trim().min(2, 'Give it a name').max(60, 'Keep the name under 60 characters'),
  summary: z.string().trim().min(10, 'Give it at least 10 characters').max(140, 'Keep it under 140 characters'),
  description: z.string().trim().min(50, 'Tell people what it changes (50+ characters)').max(4000, 'Max 4000 characters'),
  iconUrl: httpsUrl('Use a full https link to an image, or leave it empty'),
  bannerUrl: httpsUrl('Use a full https link to an image, or leave it empty'),
  website: httpsUrl('Use a full https link, or leave it empty'),
  sourceUrl: httpsUrl('Use a full https link, or leave it empty'),
  framework: optional(40),
  supportServerId: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[A-Za-z0-9_-]+$/.test(v), 'That doesn’t look like a server ID'),
  language: z.string().refine((v) => v in LANGUAGES, 'Pick a language'),
  nsfw: z.boolean(),
  unlisted: z.boolean(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a colour'),
  theme: z.string().refine(isTheme, 'Pick a style'),
  screenshots: z
    .array(z.string().trim().max(500))
    .max(20)
    .transform((list) => list.map((s) => (s && !/^https?:\/\//.test(s) ? `https://${s}` : s)).filter(Boolean))
    .refine((list) => list.every((s) => /^https:\/\/\S+\.\S+/.test(s)), 'Screenshots need full https links')
    .refine((list) => list.length <= MAX_SCREENSHOTS, `Up to ${MAX_SCREENSHOTS} screenshots`),
  platforms: z
    .array(z.string())
    .max(PLATFORM_ORDER.length)
    .transform((list) => [...new Set(list.filter(isPlatform))])
    .refine((list) => list.length >= 1, 'Say what it runs on'),
  releaseSource: z.enum(['GITHUB', 'MANUAL']),
  /** Anything that names a GitHub repo: the URL, the clone URL or "owner/repo". Stored as "owner/repo". */
  repo: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => v || null),
  files: z.array(manualFileSchema).max(MAX_MANUAL_FILES, `Up to ${MAX_MANUAL_FILES} links`),
  tags: z
    .array(z.string().max(40))
    .max(10)
    .transform(normalizeTags)
    .refine((t) => t.length >= 1, 'Add at least one tag')
    .refine((t) => t.length <= MAX_TAGS, `Up to ${MAX_TAGS} tags`),
});

export type ClientListingInput = z.infer<typeof clientListingSchema>;

/**
 * The two rules the fields can't express on their own: a GitHub listing needs a repo we can actually read, and
 * a manual one needs at least one link, or its page would have nothing to download.
 */
export function checkReleaseSetup(input: ClientListingInput): { field: 'repo' | 'files'; message: string } | null {
  if (input.releaseSource === 'GITHUB') {
    if (!input.repo) return { field: 'repo', message: 'Paste the GitHub repository the releases come from' };
    if (!parseRepo(input.repo)) return { field: 'repo', message: 'That doesn’t look like a GitHub repository' };
    return null;
  }
  if (!input.files.length) return { field: 'files', message: 'Add at least one download link' };
  return null;
}

/** Replace a client's tags, creating missing ones. Tags are shared with the other two boards (the Tag table). */
export async function setClientTags(tx: Prisma.TransactionClient, clientId: string, tags: string[]) {
  await tx.clientTag.deleteMany({ where: { clientId } });
  for (const name of tags) {
    const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} });
    await tx.clientTag.create({ data: { clientId, tagId: tag.id } });
  }
}

/**
 * Replace the links the lister keeps. Rows synced from GitHub are left alone — those belong to the release.
 *
 * Matched to what's already there by URL rather than wiped and rebuilt, so renaming a button or reordering the
 * list doesn't reset its click count. The same rule the release sync follows.
 */
export async function setManualFiles(tx: Prisma.TransactionClient, clientId: string, files: ManualFile[]) {
  const existing = await tx.clientDownload.findMany({ where: { clientId, managed: false }, select: { id: true, url: true } });
  const byUrl = new Map(existing.map((e) => [e.url, e.id]));
  const kept = new Set<number>();

  for (const [i, f] of files.entries()) {
    const data = { platform: f.platform, kind: f.kind || '', arch: '', label: f.label, url: f.url, managed: false, position: i };
    const id = byUrl.get(f.url);
    if (id !== undefined && !kept.has(id)) {
      await tx.clientDownload.update({ where: { id }, data });
      kept.add(id);
    } else {
      // A URL listed twice gets a second row rather than silently overwriting the first.
      const row = await tx.clientDownload.create({ data: { ...data, clientId } });
      kept.add(row.id);
    }
  }

  const gone = existing.filter((e) => !kept.has(e.id)).map((e) => e.id);
  if (gone.length) await tx.clientDownload.deleteMany({ where: { id: { in: gone } } });
}

/* ---------------- releases ---------------- */

export type SyncResult = { ok: true; version: string | null; files: number } | { ok: false; reason: ReleaseFailure };

/**
 * Read the repo's latest release and make the client's download list match it.
 *
 * Managed rows are matched to assets by URL rather than wiped and rebuilt, so a file that survives a release
 * keeps its click count. Checksums, signatures and GitHub's own source archives are skipped (lib/platforms.ts),
 * because nobody listing a client means for those to be download buttons.
 *
 * A failure is recorded on the listing and the old rows are kept: a GitHub outage shouldn't empty a client's
 * download section, and the links that were there a minute ago still work.
 */
export async function syncClientRelease(clientId: string): Promise<SyncResult> {
  const client = await db.clientListing.findUnique({ where: { id: clientId }, select: { repo: true, releaseSource: true } });
  if (!client) return { ok: false, reason: 'not_found' };
  if (client.releaseSource !== 'GITHUB' || !client.repo) return { ok: false, reason: 'bad_repo' };

  const res = await fetchLatestRelease(client.repo);
  if (!res.ok) {
    await db.clientListing.update({ where: { id: clientId }, data: { releaseSyncedAt: new Date(), releaseError: res.reason } }).catch(() => {});
    return { ok: false, reason: res.reason };
  }

  const r = res.release;
  const assets = r.assets.filter((a) => !isNoise(a.name));
  const seen = new Set<string>();
  const rows = assets
    .filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
    .map((a, i) => {
      const { platform, kind, arch } = classifyAsset(a.name);
      return { platform, kind, arch, label: a.name, url: a.url, size: a.size, position: i };
    });

  await db.$transaction(async (tx) => {
    const existing = await tx.clientDownload.findMany({ where: { clientId, managed: true }, select: { id: true, url: true } });
    const keep = new Map(existing.map((e) => [e.url, e.id]));
    const gone = existing.filter((e) => !rows.some((row) => row.url === e.url)).map((e) => e.id);
    if (gone.length) await tx.clientDownload.deleteMany({ where: { id: { in: gone } } });

    for (const row of rows) {
      const id = keep.get(row.url);
      // A re-classified file keeps its clicks; a brand new one starts at zero.
      if (id) await tx.clientDownload.update({ where: { id }, data: { ...row, managed: true } });
      else await tx.clientDownload.create({ data: { ...row, clientId, managed: true } });
    }

    await tx.clientListing.update({
      where: { id: clientId },
      data: {
        version: r.tag || null,
        releaseName: r.name,
        changelog: r.body || null,
        releaseUrl: r.url,
        releasedAt: r.publishedAt,
        releaseSyncedAt: new Date(),
        releaseError: null,
      },
    });
  });

  return { ok: true, version: r.tag || null, files: rows.length };
}

/** Older than the TTL, or never synced at all. Drives the quiet refresh when someone opens a client's page. */
export const releaseIsStale = (syncedAt: Date | null) => !syncedAt || Date.now() - syncedAt.getTime() > RELEASE_TTL_MS;

/* ---------------- downloads ---------------- */

export type DownloadRow = { id: number; platform: string; kind: string; arch: string; label: string; url: string; size: number | null; managed: boolean };

export type PlatformGroup = { platform: Platform; files: DownloadRow[] };

/**
 * Downloads grouped by platform, in a fixed order, so "Windows" always comes first and "Other" always last
 * however the release happened to be uploaded. Within a platform, the lister's own links come first: they put
 * them there on purpose, and a release's assets can be dozens of files long.
 */
export function groupDownloads(files: DownloadRow[]): PlatformGroup[] {
  const by = new Map<Platform, DownloadRow[]>();
  for (const f of files) {
    const p: Platform = isPlatform(f.platform) ? f.platform : 'other';
    const list = by.get(p);
    if (list) list.push(f);
    else by.set(p, [f]);
  }
  return PLATFORM_ORDER.filter((p) => by.has(p)).map((platform) => ({
    platform,
    files: by.get(platform)!.sort((a, b) => Number(a.managed) - Number(b.managed) || a.label.localeCompare(b.label)),
  }));
}

/* ---------------- cards ---------------- */

export const clientCardSelect = {
  id: true,
  slug: true,
  name: true,
  iconUrl: true,
  summary: true,
  version: true,
  downloads: true,
  bumpedAt: true,
  language: true,
  nsfw: true,
  accent: true,
  platforms: true,
  badges: { select: { kind: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.ClientListingSelect;

type ClientCardRow = Prisma.ClientListingGetPayload<{ select: typeof clientCardSelect }>;

export type ClientCard = Omit<ClientCardRow, 'tags' | 'bumpedAt' | 'badges' | 'platforms'> & {
  tags: string[];
  bumpedAt: string | null;
  badges: BadgeKind[];
  platforms: Platform[];
};

/** The platforms column is a JSON array of PLATFORM keys; anything unreadable just means "not stated". */
export function readPlatforms(raw: string | null): Platform[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return PLATFORM_ORDER.filter((p) => parsed.includes(p));
  } catch {
    return [];
  }
}

/** Screenshots are stored the same way, and read back the same way: anything odd shows nothing. */
export function readScreenshots(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && /^https:\/\/\S+$/.test(s)).slice(0, MAX_SCREENSHOTS);
  } catch {
    return [];
  }
}

export const toClientCard = (c: ClientCardRow): ClientCard => ({
  ...c,
  bumpedAt: c.bumpedAt ? c.bumpedAt.toISOString() : null,
  tags: c.tags.map((t) => t.tag.name),
  badges: sortBadges(c.badges.map((x) => x.kind)),
  platforms: readPlatforms(c.platforms),
});

/* ---------------- bumping ---------------- */

export type ClientBumpResult =
  | { ok: true; bumpCount: number; nextAt: string }
  | { ok: false; reason: 'not_found' | 'not_listed' | 'cooldown'; nextAt?: string };

/** Moves a client to the top of the bumped sort. Same 2 hour cooldown as the other boards, pressed on the site. */
export async function bumpClient(clientId: string, userId: string): Promise<ClientBumpResult> {
  const client = await db.clientListing.findUnique({ where: { id: clientId }, select: { status: true, bumpedAt: true } });
  if (!client) return { ok: false, reason: 'not_found' };
  if (client.status !== 'PUBLIC') return { ok: false, reason: 'not_listed' };
  const now = Date.now();
  if (client.bumpedAt && now - client.bumpedAt.getTime() < CLIENT_BUMP_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', nextAt: new Date(client.bumpedAt.getTime() + CLIENT_BUMP_COOLDOWN_MS).toISOString() };
  }
  const updated = await db.$transaction(async (tx) => {
    // Re-check inside the transaction so two bumps at once can't both land.
    const res = await tx.clientListing.updateMany({
      where: { id: clientId, OR: [{ bumpedAt: null }, { bumpedAt: { lt: new Date(now - CLIENT_BUMP_COOLDOWN_MS) } }] },
      data: { bumpedAt: new Date(now), bumpCount: { increment: 1 } },
    });
    if (!res.count) return null;
    await tx.clientBump.create({ data: { clientId, userId } });
    return tx.clientListing.findUnique({ where: { id: clientId }, select: { bumpCount: true } });
  });
  if (!updated) return { ok: false, reason: 'cooldown' };
  return { ok: true, bumpCount: updated.bumpCount, nextAt: new Date(now + CLIENT_BUMP_COOLDOWN_MS).toISOString() };
}

/* ---------------- browsing ---------------- */

export const CLIENT_SORTS = { bumped: 'Recently bumped', downloads: 'Most downloaded', new: 'Newest', updated: 'Recently updated', name: 'A to Z' } as const;
export type ClientSort = keyof typeof CLIENT_SORTS;

export const CLIENTS_PAGE_SIZE = 24;

export type ClientSearchParams = { q: string; tags: string[]; sort: ClientSort; platform: Platform | ''; nsfw: boolean; verified: boolean; page: number };

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseClientSearch(raw: Record<string, string | string[] | undefined>): ClientSearchParams {
  const sort = firstOf(raw.sort) as ClientSort;
  const platform = firstOf(raw.platform);
  const tagParam = ([] as string[]).concat(raw.tag ?? []);
  return {
    q: firstOf(raw.q).trim().slice(0, 100),
    tags: [...new Set(tagParam.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 5),
    sort: sort in CLIENT_SORTS ? sort : 'bumped',
    platform: isPlatform(platform) ? platform : '',
    nsfw: firstOf(raw.nsfw) === '1',
    verified: firstOf(raw.verified) === '1',
    page: Math.min(200, Math.max(1, parseInt(firstOf(raw.page), 10) || 1)),
  };
}

export function clientSearchHref(p: Partial<ClientSearchParams>) {
  const u = new URLSearchParams();
  if (p.q) u.set('q', p.q);
  for (const t of p.tags ?? []) u.append('tag', t);
  if (p.sort && p.sort !== 'bumped') u.set('sort', p.sort);
  if (p.platform) u.set('platform', p.platform);
  if (p.nsfw) u.set('nsfw', '1');
  if (p.verified) u.set('verified', '1');
  if (p.page && p.page > 1) u.set('page', String(p.page));
  const s = u.toString();
  return s ? `/clients?${s}` : '/clients';
}

const clientOrderBy: Record<ClientSort, Prisma.ClientListingOrderByWithRelationInput[]> = {
  bumped: [{ bumpedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  downloads: [{ downloads: 'desc' }, { bumpedAt: { sort: 'desc', nulls: 'last' } }],
  new: [{ createdAt: 'desc' }],
  updated: [{ releasedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  name: [{ name: 'asc' }],
};

export async function searchClients(p: ClientSearchParams) {
  const and: Prisma.ClientListingWhereInput[] = [{ status: 'PUBLIC' }];
  if (!p.nsfw) and.push({ nsfw: false });
  if (p.verified) and.push({ badges: { some: { kind: { in: ['OFFICIAL', 'VERIFIED'] } } } });
  // The platforms column is a JSON array in a string, so a substring match is the filter SQLite can do. The
  // keys are distinct words, so "linux" can't match anything else in there.
  if (p.platform) and.push({ platforms: { contains: `"${p.platform}"` } });
  for (const t of p.tags) and.push({ tags: { some: { tag: { name: t } } } });
  if (p.q) {
    and.push({
      OR: [
        { name: { contains: p.q } },
        { summary: { contains: p.q } },
        { description: { contains: p.q } },
        { tags: { some: { tag: { name: { contains: p.q.toLowerCase() } } } } },
      ],
    });
  }
  const where: Prisma.ClientListingWhereInput = { AND: and };

  const total = await db.clientListing.count({ where });
  const pages = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));
  const page = Math.min(p.page, pages);
  const rows = await db.clientListing.findMany({
    where,
    select: clientCardSelect,
    orderBy: clientOrderBy[p.sort],
    skip: (page - 1) * CLIENTS_PAGE_SIZE,
    take: CLIENTS_PAGE_SIZE,
  });

  // Tags common among the results, to narrow it down further.
  const grouped = await db.clientTag.groupBy({
    by: ['tagId'],
    where: { client: where, tag: { name: { notIn: p.tags } } },
    _count: { tagId: true },
    orderBy: { _count: { tagId: 'desc' } },
    take: 12,
  });
  const tagRows = await db.tag.findMany({ where: { id: { in: grouped.map((g) => g.tagId) } }, select: { id: true, name: true } });
  const nameById = new Map(tagRows.map((t) => [t.id, t.name]));

  return {
    items: rows.map(toClientCard),
    total,
    pages,
    page,
    facets: grouped.map((g) => ({ name: nameById.get(g.tagId) ?? '', count: g._count.tagId })).filter((f) => f.name),
  };
}
