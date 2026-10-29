// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import clsx from 'clsx';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { BADGES, BADGE_ORDER, isBadge } from '@/lib/badges';
import { readPlatforms } from '@/lib/clients';
import { db } from '@/lib/db';
import { proListingIds, reviewOrder } from '@/lib/pro';
import { env } from '@/lib/env';
import { repoUrl } from '@/lib/github';
import { compact, timeAgo } from '@/lib/format';
import { PLATFORMS } from '@/lib/platforms';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { Avatar } from '@/components/Avatar';
import { BadgeMark, BadgeRow } from '@/components/Badge';
import { Dropdown } from '@/components/Dropdown';
import { NsfwMark } from '@/components/NsfwMark';
import { StatusBadge } from '@/components/StatusBadge';
import { PlatformIcon } from '@/components/clients/PlatformIcon';
import { BadgeControl } from '@/components/portal/BadgeControl';
import { ClientModButtons } from '@/components/portal/ModButtons';
import { PageHead } from '@/components/portal/PageHead';

export const metadata: Metadata = { title: 'Clients' };

const STATUSES = ['ALL', 'PENDING', 'PUBLIC', 'UNLISTED', 'DENIED', 'HIDDEN', 'REMOVED'] as const;
const PER_PAGE = 40;
const BADGE_FILTERS = [
  { value: '', label: 'Any badge' },
  { value: 'ANY', label: 'Has a badge' },
  { value: 'NONE', label: 'No badge' },
  ...BADGE_ORDER.map((k) => ({ value: k, label: BADGES[k].label })),
];
const SORT_OPTIONS = [
  { value: 'queue', label: 'Review queue' },
  { value: 'reports', label: 'Most reported' },
  { value: 'new', label: 'Newest' },
  { value: 'downloads', label: 'Most downloaded' },
];

type Props = { searchParams: Promise<{ q?: string; status?: string; sort?: string; badge?: string; page?: string }> };

/**
 * The client board's half of the portal.
 *
 * Reviewing a client isn't reviewing a description - it's deciding whether to point people at an executable.
 * So each row shows the whole chain at once: the repo, the version, and every download URL the listing hands
 * out, with the host of each one spelled out. A link going somewhere other than the repo is the single thing
 * most worth noticing, and it's visible without opening anything.
 */
export default async function PortalClients({ searchParams }: Props) {
  await requireStaffPage('/clients');
  const sp = await searchParams;
  const base = await portalBase();
  const q = (sp.q || '').trim().slice(0, 80);
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status! : 'ALL';
  const sort = sp.sort === 'new' ? 'new' : sp.sort === 'downloads' ? 'downloads' : sp.sort === 'reports' ? 'reports' : status === 'PENDING' ? 'queue' : 'reports';
  const badge = isBadge(sp.badge) || sp.badge === 'ANY' || sp.badge === 'NONE' ? sp.badge : '';
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const where: Prisma.ClientListingWhereInput = {
    ...(status !== 'ALL' ? { status } : {}),
    ...(badge === 'ANY' ? { badges: { some: {} } } : badge === 'NONE' ? { badges: { none: {} } } : badge ? { badges: { some: { kind: badge } } } : {}),
    ...(q ? { OR: [{ id: q }, { slug: { contains: q } }, { name: { contains: q } }, { repo: { contains: q } }, { ownerId: q }, { owner: { username: { contains: q } } }] } : {}),
  };
  const orderBy: Prisma.ClientListingOrderByWithRelationInput =
    sort === 'new' ? { createdAt: 'desc' } : sort === 'downloads' ? { downloads: 'desc' } : { reports: { _count: 'desc' } };

  /**
   * Priority review: Pro listings go to the front of the PENDING queue, oldest first within each group.
   * It can't be an `orderBy` - ProAssignment has no relation to the listing tables - so the ids are
   * ordered in memory and the page is fetched by id. Only ids are read, and a backlog is small.
   */
  let queueIds: string[] | null = null;
  if (sort === 'queue') {
    const all = await db.clientListing.findMany({ where, select: { id: true, createdAt: true } });
    queueIds = (await reviewOrder('client', all)).slice((page - 1) * PER_PAGE, page * PER_PAGE);
  }

  const [rows, total] = await Promise.all([
    db.clientListing.findMany({
      where: queueIds ? { id: { in: queueIds } } : where,
      orderBy,
      ...(queueIds ? {} : { skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
      select: {
        id: true,
        slug: true,
        name: true,
        iconUrl: true,
        status: true,
        badges: { select: { kind: true } },
        nsfw: true,
        platforms: true,
        repo: true,
        releaseSource: true,
        version: true,
        releaseError: true,
        releaseSyncedAt: true,
        downloads: true,
        termsAgreedAt: true,
        createdAt: true,
        owner: { select: { username: true } },
        files: { select: { id: true, label: true, url: true, platform: true, managed: true }, orderBy: { position: 'asc' } },
        _count: { select: { reports: { where: { status: 'OPEN' } } } },
      },
    }),
    db.clientListing.count({ where }),
  ]);

  // `id: { in: [...] }` comes back in whatever order the database likes, so the queue order is
  // reapplied here. Staff also see which rows are on Pro, so the ordering explains itself.
  const ordered = queueIds ? queueIds.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => !!r) : rows;
  const proIds = await proListingIds('client');

  const href = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, sort, badge, ...o })) if (v && v !== 'ALL') u.set(k, v);
    return `${base}/clients${u.size ? `?${u}` : ''}`;
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-6xl">
      <PageHead title="Clients" sub={`${total.toLocaleString()} listings`} />
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex w-fit gap-1 overflow-x-auto rounded-xl border border-line bg-raised p-1">
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s, page: undefined })} className={clsx('inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold', s === status ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2')}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action={`${base}/clients`}>
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <Dropdown name="badge" label="Badge" size="md" className="w-48" defaultValue={badge} options={BADGE_FILTERS} />
          <Dropdown name="sort" label="Sort" size="md" className="w-44" defaultValue={sort} options={SORT_OPTIONS} />
          <input name="q" defaultValue={q} placeholder="Name, slug, repo, lister" className="field h-10 w-60 text-sm" />
          <button className="btn btn-secondary">Search</button>
        </form>
      </div>

      <div className="mt-5 space-y-3">
        {ordered.map((c) => (
          <ClientRow key={c.id} c={c} base={base} pro={proIds.has(c.id)} />
        ))}
        {ordered.length === 0 && <p className="card px-5 py-14 text-center text-sm text-ink-3">No clients match.</p>}
      </div>

      {pages > 1 && (
        <div className="mt-5 flex justify-end gap-2">
          {page > 1 && (
            <Link className="btn btn-secondary btn-sm" href={href({ page: String(page - 1) })}>
              Previous
            </Link>
          )}
          {page < pages && (
            <Link className="btn btn-secondary btn-sm" href={href({ page: String(page + 1) })}>
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

type Row = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  status: string;
  badges: { kind: string }[];
  nsfw: boolean;
  platforms: string | null;
  repo: string | null;
  releaseSource: string;
  version: string | null;
  releaseError: string | null;
  releaseSyncedAt: Date | null;
  downloads: number;
  termsAgreedAt: Date | null;
  createdAt: Date;
  owner: { username: string };
  files: { id: number; label: string; url: string; platform: string; managed: boolean }[];
  _count: { reports: number };
};

function ClientRow({ c, base, pro }: { c: Row; base: string; pro: boolean }) {
  const platforms = readPlatforms(c.platforms);
  // The host each download really goes to. A client whose files aren't where its repo is deserves a second look.
  const hosts = [...new Set(c.files.map((f) => hostOf(f.url)))];
  const repoHost = c.repo ? 'github.com' : null;
  const offRepo = repoHost ? hosts.filter((h) => h !== repoHost && h !== 'objects.githubusercontent.com') : [];

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <Avatar src={c.iconUrl} name={c.name} id={c.id} size={44} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`${env.siteUrl}/clients/${c.slug}`} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">
                {c.name}
              </a>
              <BadgeRow kinds={c.badges.map((x) => x.kind)} seed={c.id} size={15} max={3} />
              {pro && <BadgeMark kind="PRO" size={15} seed={c.id} />}
              {c.nsfw && <NsfwMark />}
              <StatusBadge status={c.status} />
              {!c.termsAgreedAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn/10 px-2 text-[11px] font-semibold text-warn">no terms on file</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
              <span className="font-mono">/clients/{c.slug}</span>
              <span>@{c.owner.username}</span>
              <span className="inline-flex items-center gap-1">
                {platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} size={12} />
                ))}
                {platforms.map((p) => PLATFORMS[p].label).join(', ') || 'no platforms'}
              </span>
              <span className="tabular-nums">{compact(c.downloads)} downloads</span>
              <span>listed {timeAgo(c.createdAt)}</span>
              {c._count.reports > 0 && (
                <Link href={`${base}/reports?q=${c.id}`} className="font-semibold tabular-nums text-warn hover:underline">
                  {c._count.reports} open report{c._count.reports === 1 ? '' : 's'}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BadgeControl id={c.id} kind="client" badges={c.badges.map((x) => x.kind)} />
          <ClientModButtons clientId={c.id} status={c.status} />
        </div>
      </div>

      {/* The chain a reviewer is actually checking: repo → release → the files it hands out. */}
      <div className="mt-4 grid gap-3 border-t border-line pt-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-1.5 text-[12.5px]">
          <div className="text-ink-3">
            Source:{' '}
            {c.releaseSource === 'GITHUB' && c.repo ? (
              <a href={repoUrl(c.repo)} target="_blank" rel="noreferrer" className="font-mono text-ink-2 hover:text-accent">
                {c.repo} <ExternalLink size={10} className="inline" />
              </a>
            ) : (
              <span className="text-ink-2">links kept by the lister</span>
            )}
          </div>
          <div className="text-ink-3">
            Release: <span className="font-mono text-ink-2">{c.version || '-'}</span>
            {c.releaseSyncedAt ? <span className="text-ink-3"> · read {timeAgo(c.releaseSyncedAt)}</span> : null}
          </div>
          {c.releaseError && <div className="text-warn">Last sync failed: {c.releaseError}</div>}
          {offRepo.length > 0 && (
            <div className="flex items-start gap-1.5 text-warn">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>Downloads leave the repo: {offRepo.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {c.files.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">No download files. Press Sync, or ask the lister.</p>
          ) : (
            <ul className="space-y-1">
              {c.files.slice(0, 8).map((f) => (
                <li key={f.id} className="flex min-w-0 items-center gap-2 text-[12.5px]">
                  <span className="w-16 shrink-0 text-ink-3">{PLATFORMS[(f.platform as keyof typeof PLATFORMS) in PLATFORMS ? (f.platform as keyof typeof PLATFORMS) : 'other'].label}</span>
                  <a href={f.url} target="_blank" rel="noreferrer nofollow" className="truncate font-mono text-ink-2 hover:text-accent">
                    {f.label}
                  </a>
                  <span className="shrink-0 text-ink-3">{hostOf(f.url)}</span>
                  {!f.managed && <span className="shrink-0 rounded bg-surface-2 px-1.5 text-[10px] text-ink-3">manual</span>}
                </li>
              ))}
              {c.files.length > 8 && <li className="text-[12px] text-ink-3">+{c.files.length - 8} more</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'invalid url';
  }
}
