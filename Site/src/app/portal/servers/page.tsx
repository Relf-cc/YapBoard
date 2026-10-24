import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { portalBase } from '@/lib/portal';
import { compact, timeAgo } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHead } from '@/components/portal/PageHead';
import { Dropdown } from '@/components/Dropdown';
import { ServerModButtons } from '@/components/portal/ModButtons';
import { BadgeControl } from '@/components/portal/BadgeControl';
import { Badge } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';

export const metadata: Metadata = { title: 'Servers' };

const STATUSES = ['ALL', 'PUBLIC', 'UNLISTED', 'HIDDEN', 'REMOVED'] as const;
const PER_PAGE = 40;
const BADGE_FILTERS = [
  { value: '', label: 'Any checkmark' },
  { value: 'ANY', label: 'Has a checkmark' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'OFFICIAL', label: 'Official' },
];
const SORT_OPTIONS = [
  { value: 'reports', label: 'Most reported' },
  { value: 'new', label: 'Newest' },
  { value: 'members', label: 'Biggest' },
];

type Props = { searchParams: Promise<{ q?: string; status?: string; sort?: string; badge?: string; page?: string }> };

export default async function PortalServers({ searchParams }: Props) {
  const sp = await searchParams;
  const base = await portalBase();
  const q = (sp.q || '').trim().slice(0, 80);
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status! : 'ALL';
  const sort = sp.sort === 'new' ? 'new' : sp.sort === 'members' ? 'members' : 'reports';
  const badge = sp.badge === 'VERIFIED' || sp.badge === 'OFFICIAL' || sp.badge === 'ANY' ? sp.badge : '';
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const where: Prisma.ServerWhereInput = {
    ...(status !== 'ALL' ? { status } : {}),
    ...(badge === 'ANY' ? { badge: { not: null } } : badge ? { badge } : {}),
    ...(q ? { OR: [{ id: q }, { name: { contains: q } }, { ownerId: q }, { owner: { username: { contains: q } } }] } : {}),
  };
  const orderBy: Prisma.ServerOrderByWithRelationInput =
    sort === 'new' ? { createdAt: 'desc' } : sort === 'members' ? { memberCount: 'desc' } : { reports: { _count: 'desc' } };

  const [rows, total] = await Promise.all([
    db.server.findMany({
      where,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, name: true, iconUrl: true, status: true, badge: true, nsfw: true, memberCount: true, createdAt: true, bumpedAt: true,
        owner: { select: { username: true } },
        _count: { select: { reports: { where: { status: 'OPEN' } } } },
      },
    }),
    db.server.count({ where }),
  ]);
  const href = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, sort, badge, ...o })) if (v && v !== 'ALL') u.set(k, v);
    return `${base}/servers${u.size ? `?${u}` : ''}`;
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-6xl">
      <PageHead title="Servers" sub={`${total.toLocaleString()} listings`} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-raised p-1 w-fit overflow-x-auto">
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s, page: undefined })} className={clsx('h-8 px-3 rounded-lg text-sm font-semibold inline-flex items-center', s === status ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2')}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action={`${base}/servers`}>
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <Dropdown name="badge" label="Checkmark" size="md" className="w-48" defaultValue={badge} options={BADGE_FILTERS} />
          <Dropdown name="sort" label="Sort" size="md" className="w-40" defaultValue={sort} options={SORT_OPTIONS} />
          <input name="q" defaultValue={q} placeholder="Name, server ID, owner" className="field h-10 w-60 text-sm" />
          <button className="btn btn-secondary">Search</button>
        </form>
      </div>

      <div className="mt-5 card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3 border-b border-line">
              <th className="font-medium px-5 h-11">Server</th>
              <th className="font-medium px-3">Owner</th>
              <th className="font-medium px-3">Members</th>
              <th className="font-medium px-3">Open reports</th>
              <th className="font-medium px-3">Listed</th>
              <th className="font-medium px-3">Checkmark</th>
              <th className="font-medium px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-surface-2/60">
                <td className="px-5 py-3">
                  <a href={`${env.siteUrl}/view/${s.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 min-w-0 group">
                    <Avatar src={s.iconUrl} name={s.name} id={s.id} size={32} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold truncate max-w-[220px] group-hover:text-accent">{s.name}</span>
                        <Badge kind={s.badge} seed={s.id} size={15} />
                        {s.nsfw && <NsfwMark />}
                        <StatusBadge status={s.status} />
                      </span>
                      <span className="block font-mono text-[11px] text-ink-3">{s.id}</span>
                    </span>
                  </a>
                </td>
                <td className="px-3 py-3 text-ink-2">@{s.owner.username}</td>
                <td className="px-3 py-3 tabular-nums text-ink-2">{compact(s.memberCount)}</td>
                <td className="px-3 py-3">
                  {s._count.reports ? (
                    <Link href={`${base}/reports?q=${s.id}`} className="text-warn font-semibold tabular-nums hover:underline">
                      {s._count.reports}
                    </Link>
                  ) : (
                    <span className="text-ink-3">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-3 whitespace-nowrap">{timeAgo(s.createdAt)}</td>
                <td className="px-3 py-3">
                  <BadgeControl serverId={s.id} badge={s.badge} />
                </td>
                <td className="px-5 py-3 text-right">
                  <ServerModButtons serverId={s.id} status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">No servers match.</p>}
      </div>

      {pages > 1 && (
        <div className="mt-5 flex justify-end gap-2">
          {page > 1 && <Link className="btn btn-secondary btn-sm" href={href({ page: String(page - 1) })}>Previous</Link>}
          {page < pages && <Link className="btn btn-secondary btn-sm" href={href({ page: String(page + 1) })}>Next</Link>}
        </div>
      )}
    </div>
  );
}
