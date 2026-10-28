// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import clsx from 'clsx';
import { BADGES, BADGE_ORDER, isBadge } from '@/lib/badges';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { compact, timeAgo } from '@/lib/format';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { Avatar } from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import { Dropdown } from '@/components/Dropdown';
import { NsfwMark } from '@/components/NsfwMark';
import { StatusBadge } from '@/components/StatusBadge';
import { BadgeControl } from '@/components/portal/BadgeControl';
import { BotModButtons } from '@/components/portal/ModButtons';
import { PageHead } from '@/components/portal/PageHead';

export const metadata: Metadata = { title: 'Bots' };

const STATUSES = ['ALL', 'PENDING', 'PUBLIC', 'UNLISTED', 'DENIED', 'HIDDEN', 'REMOVED'] as const;
const PER_PAGE = 40;
const BADGE_FILTERS = [
  { value: '', label: 'Any badge' },
  { value: 'ANY', label: 'Has a badge' },
  { value: 'NONE', label: 'No badge' },
  ...BADGE_ORDER.map((k) => ({ value: k, label: BADGES[k].label })),
];
const SORT_OPTIONS = [
  { value: 'reports', label: 'Most reported' },
  { value: 'new', label: 'Newest' },
  { value: 'servers', label: 'Most servers' },
];

type Props = { searchParams: Promise<{ q?: string; status?: string; sort?: string; badge?: string; page?: string }> };

export default async function PortalBots({ searchParams }: Props) {
  await requireStaffPage('/bots');
  const sp = await searchParams;
  const base = await portalBase();
  const q = (sp.q || '').trim().slice(0, 80);
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status! : 'ALL';
  const sort = sp.sort === 'new' ? 'new' : sp.sort === 'servers' ? 'servers' : 'reports';
  const badge = isBadge(sp.badge) || sp.badge === 'ANY' || sp.badge === 'NONE' ? sp.badge : '';
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const where: Prisma.BotListingWhereInput = {
    ...(status !== 'ALL' ? { status } : {}),
    ...(badge === 'ANY' ? { badges: { some: {} } } : badge === 'NONE' ? { badges: { none: {} } } : badge ? { badges: { some: { kind: badge } } } : {}),
    ...(q ? { OR: [{ id: q }, { name: { contains: q } }, { ownerId: q }, { owner: { username: { contains: q } } }] } : {}),
  };
  const orderBy: Prisma.BotListingOrderByWithRelationInput =
    sort === 'new' ? { createdAt: 'desc' } : sort === 'servers' ? { serverCount: 'desc' } : { reports: { _count: 'desc' } };

  const [rows, total] = await Promise.all([
    db.botListing.findMany({
      where,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        status: true,
        badges: { select: { kind: true } },
        nsfw: true,
        serverCount: true,
        createdAt: true,
        owner: { select: { username: true } },
        supportServer: { select: { id: true, name: true } },
        _count: { select: { reports: { where: { status: 'OPEN' } } } },
      },
    }),
    db.botListing.count({ where }),
  ]);

  const href = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, sort, badge, ...o })) if (v && v !== 'ALL') u.set(k, v);
    return `${base}/bots${u.size ? `?${u}` : ''}`;
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-6xl">
      <PageHead title="Bots" sub={`${total.toLocaleString()} listings`} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex w-fit gap-1 overflow-x-auto rounded-xl border border-line bg-raised p-1">
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s, page: undefined })} className={clsx('inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold', s === status ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2')}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action={`${base}/bots`}>
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <Dropdown name="badge" label="Badge" size="md" className="w-48" defaultValue={badge} options={BADGE_FILTERS} />
          <Dropdown name="sort" label="Sort" size="md" className="w-40" defaultValue={sort} options={SORT_OPTIONS} />
          <input name="q" defaultValue={q} placeholder="Name, bot ID, lister" className="field h-10 w-60 text-sm" />
          <button className="btn btn-secondary">Search</button>
        </form>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="h-11 px-5 font-medium">Bot</th>
              <th className="px-3 font-medium">Listed by</th>
              <th className="px-3 font-medium">Support</th>
              <th className="px-3 font-medium">Servers</th>
              <th className="px-3 font-medium">Open reports</th>
              <th className="px-3 font-medium">Listed</th>
              <th className="px-3 font-medium">Badges</th>
              <th className="px-5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-surface-2/60">
                <td className="px-5 py-3">
                  <a href={`${env.siteUrl}/bots/${b.id}`} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-3">
                    <Avatar src={b.avatarUrl} name={b.name} id={b.id} size={32} round />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="max-w-[200px] truncate font-semibold group-hover:text-accent">{b.name}</span>
                        <BadgeRow kinds={b.badges.map((x) => x.kind)} seed={b.id} size={15} max={3} />
                        {b.nsfw && <NsfwMark />}
                        <StatusBadge status={b.status} />
                      </span>
                      <span className="block font-mono text-[11px] text-ink-3">{b.id}</span>
                    </span>
                  </a>
                </td>
                <td className="px-3 py-3 text-ink-2">@{b.owner.username}</td>
                <td className="px-3 py-3 text-ink-3">
                  {b.supportServer ? (
                    <Link href={`${base}/servers?q=${b.supportServer.id}`} className="max-w-[140px] truncate hover:text-accent">
                      {b.supportServer.name}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-3 tabular-nums text-ink-2">{compact(b.serverCount)}</td>
                <td className="px-3 py-3">
                  {b._count.reports ? (
                    <Link href={`${base}/reports?q=${b.id}`} className="font-semibold tabular-nums text-warn hover:underline">
                      {b._count.reports}
                    </Link>
                  ) : (
                    <span className="text-ink-3">0</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-ink-3">{timeAgo(b.createdAt)}</td>
                <td className="px-3 py-3">
                  <BadgeControl id={b.id} kind="bot" badges={b.badges.map((x) => x.kind)} />
                </td>
                <td className="px-5 py-3 text-right">
                  <BotModButtons botId={b.id} status={b.status} serverCount={b.serverCount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">No bots match.</p>}
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
