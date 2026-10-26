import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { timeAgo } from '@/lib/format';
import { ABUSE_REASONS, REMOVAL_REASONS, reasonLabel, reportTarget } from '@/lib/reports';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHead } from '@/components/portal/PageHead';
import { Dropdown } from '@/components/Dropdown';

export const metadata: Metadata = { title: 'Reports' };

const STATUSES = ['OPEN', 'ACTIONED', 'DISMISSED'] as const;
const PER_PAGE = 30;

type Props = { searchParams: Promise<{ kind?: string; status?: string; reason?: string; q?: string; page?: string }> };

export default async function Reports({ searchParams }: Props) {
  await requireStaffPage('/reports');
  const sp = await searchParams;
  const base = await portalBase();
  const kind = sp.kind === 'REMOVAL' ? 'REMOVAL' : 'ABUSE';
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status! : 'OPEN';
  const reasons = kind === 'ABUSE' ? ABUSE_REASONS : REMOVAL_REASONS;
  const reason = sp.reason && sp.reason in reasons ? sp.reason : undefined;
  const q = (sp.q || '').trim().slice(0, 80);
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const where: Prisma.ReportWhereInput = {
    kind,
    status,
    reason,
    ...(q
      ? { OR: [{ serverId: q }, { botId: q }, { server: { name: { contains: q } } }, { bot: { name: { contains: q } } }, { details: { contains: q } }] }
      : {}),
  };
  const [rows, total, counts] = await Promise.all([
    db.report.findMany({
      where,
      // Open queue: oldest first so nothing rots. Handled: newest first.
      orderBy: { createdAt: status === 'OPEN' ? 'asc' : 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        server: { select: { id: true, name: true, iconUrl: true, status: true, _count: { select: { reports: { where: { status: 'OPEN' } } } } } },
        bot: { select: { id: true, name: true, avatarUrl: true, status: true, _count: { select: { reports: { where: { status: 'OPEN' } } } } } },
        reporter: { select: { username: true } },
        handledBy: { select: { username: true } },
      },
    }),
    db.report.count({ where }),
    db.report.groupBy({ by: ['status'], where: { kind }, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const href = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { kind, status, reason, q, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `${base}/reports?${u}`;
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-6xl">
      <PageHead title={kind === 'ABUSE' ? 'Abuse reports' : 'Removal requests'} sub={kind === 'ABUSE' ? 'Listings people flagged for breaking the guidelines.' : 'Owners and members asking for a listing to come down.'} />

      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex gap-1 rounded-xl border border-line bg-raised p-1 w-fit">
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s, page: undefined })} className={clsx('h-8 px-3.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors', s === status ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2')}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
              <span className="text-xs tabular-nums text-ink-3">{countOf(s)}</span>
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action={`${base}/reports`}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="status" value={status} />
          <Dropdown
            name="reason"
            label="Reason"
            size="md"
            className="w-48"
            defaultValue={reason ?? ''}
            options={[{ value: '', label: 'Any reason' }, ...Object.entries(reasons).map(([value, label]) => ({ value, label }))]}
          />
          <input name="q" defaultValue={q} placeholder="Name, listing ID or text" className="field h-10 w-56 text-sm" />
          <button className="btn btn-secondary">Filter</button>
        </form>
      </div>

      <div className="mt-5 card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3 border-b border-line">
              <th className="font-medium px-5 h-11">Listing</th>
              <th className="font-medium px-3">Reason</th>
              <th className="font-medium px-3">From</th>
              <th className="font-medium px-3">{status === 'OPEN' ? 'Waiting' : 'Handled'}</th>
              <th className="font-medium px-5 text-right">Listing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const t = reportTarget(r);
              const openOnTarget = (r.server ?? r.bot)?._count.reports ?? 0;
              return (
              <tr key={r.id} className="group hover:bg-surface-2 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`${base}/reports/${r.id}?kind=${kind}`} className="flex items-center gap-3 min-w-0">
                    <Avatar src={t?.iconUrl ?? null} name={t?.name ?? '?'} id={t?.id ?? r.id} size={32} round={t?.round} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-semibold group-hover:text-accent transition-colors">{t?.name ?? 'Deleted listing'}</span>
                        {t?.kind === 'bot' && <span className="shrink-0 rounded-full border border-line-strong px-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">bot</span>}
                      </span>
                      {openOnTarget > 1 && <span className="text-xs text-warn">{openOnTarget} open reports</span>}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-ink-2">
                  <div>{reasonLabel(r.kind, r.reason)}</div>
                  <div className="text-xs text-ink-3 truncate max-w-xs">{r.details}</div>
                </td>
                <td className="px-3 py-3 text-ink-3">@{r.reporter?.username ?? 'deleted'}</td>
                <td className="px-3 py-3 text-ink-3 tabular-nums whitespace-nowrap">
                  {status === 'OPEN' ? timeAgo(r.createdAt) : `${timeAgo(r.handledAt)} · @${r.handledBy?.username ?? '?'}`}
                </td>
                <td className="px-5 py-3 text-right">{t && <StatusBadge status={t.status} />}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">Nothing here.</p>}
      </div>

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm text-ink-3">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
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
        </div>
      )}
    </div>
  );
}
