import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { timeAgo } from '@/lib/format';
import { reasonLabel } from '@/lib/reports';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { StatusBadge } from '@/components/StatusBadge';
import { ReportActions } from '@/components/portal/ReportActions';

export const metadata: Metadata = { title: 'Report' };

export default async function ReportDetail({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  await requireStaffPage(`/reports/${encodeURIComponent(reportId)}`);
  const base = await portalBase();
  const r = await db.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, username: true, createdAt: true, _count: { select: { reports: true } } } },
      handledBy: { select: { username: true } },
      server: {
        include: {
          owner: { select: { id: true, username: true, displayName: true, avatarUrl: true, bannedAt: true, createdAt: true, _count: { select: { servers: true } } } },
          tags: { include: { tag: true } },
        },
      },
    },
  });
  if (!r) notFound();
  const s = r.server;
  const related = await db.report.findMany({
    where: { serverId: s.id, id: { not: r.id } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { reporter: { select: { username: true } } },
  });

  return (
    <div className="max-w-6xl">
      <Link href={`${base}/reports?kind=${r.kind}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-5">
        <ArrowLeft size={15} /> {r.kind === 'ABUSE' ? 'Abuse reports' : 'Removal requests'}
      </Link>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6 min-w-0">
          {/* the report */}
          <section className="card p-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={r.status} />
              <span className="text-xs text-ink-3">{r.kind === 'ABUSE' ? 'Abuse report' : 'Removal request'}</span>
              <span className="text-xs text-ink-3">·</span>
              <span className="text-xs text-ink-3">{r.createdAt.toLocaleString('en-GB')}</span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold">{reasonLabel(r.kind, r.reason)}</h1>
            <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-2 rounded-xl bg-raised border border-line p-4">{r.details}</p>
            <div className="mt-4 text-sm text-ink-3">
              From <Link href={`${base}/users?q=${r.reporter?.id ?? ''}`} className="text-ink-2 font-semibold hover:text-accent">@{r.reporter?.username ?? 'deleted'}</Link>
              {r.reporter && (
                <>
                  {' '}
                  · account since {r.reporter.createdAt.toLocaleDateString('en-GB')} · {r.reporter._count.reports} report{r.reporter._count.reports === 1 ? '' : 's'} sent
                </>
              )}
            </div>
          </section>

          {/* the listing */}
          <section className="card p-6">
            <div className="flex items-start gap-4">
              <Avatar src={s.iconUrl} name={s.name} id={s.id} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold">{s.name}</h2>
                  <Badge kind={s.badge} seed={s.id} size={19} />
                  <StatusBadge status={s.status} />
                  {s.nsfw && <NsfwMark />}
                </div>
                <p className="mt-0.5 font-mono text-xs text-ink-3">{s.id}</p>
              </div>
              <a href={`${env.siteUrl}/view/${s.id}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                Public page <ArrowUpRight size={14} />
              </a>
            </div>
            <p className="mt-5 text-ink">{s.summary}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-2 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">{s.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {s.tags.map((t) => (
                <span key={t.tagId} className="chip">
                  #{t.tag.name}
                </span>
              ))}
            </div>
            <dl className="mt-5 pt-5 border-t border-line grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <Info label="Invite">
                <span className="font-mono text-xs break-all">{s.inviteUrl.replace(/^https:\/\//, '')}</span>
              </Info>
              <Info label="Members">{s.memberCount.toLocaleString()}</Info>
              <Info label="Listed">{timeAgo(s.createdAt)}</Info>
              <Info label="Last bump">{timeAgo(s.bumpedAt)}</Info>
            </dl>
            <div className="mt-5 pt-5 border-t border-line flex items-center gap-3">
              <Avatar src={s.owner.avatarUrl} name={s.owner.username} id={s.owner.id} size={34} round />
              <div className="text-sm min-w-0 flex-1">
                <div className="font-semibold">
                  @{s.owner.username} {s.owner.bannedAt && <span className="ml-1 text-xs text-danger font-semibold">banned</span>}
                </div>
                <div className="text-xs text-ink-3">
                  Lister · joined {s.owner.createdAt.toLocaleDateString('en-GB')} · {s.owner._count.servers} listing{s.owner._count.servers === 1 ? '' : 's'}
                </div>
              </div>
              <Link href={`${base}/users?q=${s.owner.id}`} className="btn btn-ghost btn-sm">
                User
              </Link>
            </div>
          </section>

          {related.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="px-6 h-12 flex items-center font-bold border-b border-line">Other reports on this server</h2>
              <ul className="divide-y divide-line">
                {related.map((o) => (
                  <li key={o.id}>
                    <Link href={`${base}/reports/${o.id}?kind=${o.kind}`} className="flex items-center gap-3 px-6 py-3 text-sm hover:bg-surface-2">
                      <StatusBadge status={o.status} />
                      <span className="flex-1 truncate text-ink-2">{reasonLabel(o.kind, o.reason)}</span>
                      <span className="text-ink-3">@{o.reporter?.username ?? 'deleted'}</span>
                      <span className="w-16 text-right text-xs text-ink-3">{timeAgo(o.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          <ReportActions
            reportId={r.id}
            kind={r.kind}
            status={r.status}
            serverStatus={s.status}
            ownerBanned={!!s.owner.bannedAt}
            openRelated={related.filter((x) => x.status === 'OPEN').length}
            resolution={r.resolution}
            handledBy={r.handledBy?.username ?? null}
            handledAt={r.handledAt?.toISOString() ?? null}
            serverId={s.id}
          />
        </aside>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-ink-2">{children}</dd>
    </div>
  );
}
