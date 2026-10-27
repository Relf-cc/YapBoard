// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { timeAgo } from '@/lib/format';
import { reasonLabel, reportTarget } from '@/lib/reports';
import { Avatar } from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { StatusBadge } from '@/components/StatusBadge';
import { ReportActions } from '@/components/portal/ReportActions';

export const metadata: Metadata = { title: 'Report' };

const owner = { select: { id: true, username: true, displayName: true, avatarUrl: true, bannedAt: true, createdAt: true, _count: { select: { servers: true, bots: true } } } };

export default async function ReportDetail({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  await requireStaffPage(`/reports/${encodeURIComponent(reportId)}`);
  const base = await portalBase();
  const r = await db.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, username: true, createdAt: true, _count: { select: { reports: true } } } },
      handledBy: { select: { username: true } },
      server: { include: { owner, tags: { include: { tag: true } }, badges: { select: { kind: true } } } },
      bot: { include: { owner, tags: { include: { tag: true } }, badges: { select: { kind: true } } } },
    },
  });
  if (!r) notFound();
  const target = reportTarget(r);
  const listing = r.server ?? r.bot;
  if (!target || !listing) notFound();

  const related = await db.report.findMany({
    where: { ...(target.kind === 'bot' ? { botId: target.id } : { serverId: target.id }), id: { not: r.id } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { reporter: { select: { username: true } } },
  });

  const lister = listing.owner;
  const listings = lister._count.servers + lister._count.bots;

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
              <span className="text-xs text-ink-3">against a {target.kind}</span>
              <span className="text-xs text-ink-3">·</span>
              <span className="text-xs text-ink-3">{r.createdAt.toLocaleString('en-GB')}</span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold">{reasonLabel(r.kind, r.reason)}</h1>
            <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-2 rounded-xl bg-raised border border-line p-4">{r.details}</p>
            <div className="mt-4 text-sm text-ink-3">
              From{' '}
              <Link href={`${base}/users?q=${r.reporter?.id ?? ''}`} className="text-ink-2 font-semibold hover:text-accent">
                @{r.reporter?.username ?? 'deleted'}
              </Link>
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
              <Avatar src={target.iconUrl} name={target.name} id={target.id} size={56} round={target.round} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold">{target.name}</h2>
                  <BadgeRow kinds={listing.badges.map((b) => b.kind)} seed={target.id} size={19} max={3} />
                  <StatusBadge status={target.status} />
                  {listing.nsfw && <NsfwMark />}
                </div>
                <p className="mt-0.5 font-mono text-xs text-ink-3">{target.id}</p>
              </div>
              <a href={`${env.siteUrl}${target.path}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                Public page <ArrowUpRight size={14} />
              </a>
            </div>
            <p className="mt-5 text-ink">{listing.summary}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-2 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">{listing.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {listing.tags.map((t) => (
                <span key={t.tagId} className="chip">
                  #{t.tag.name}
                </span>
              ))}
            </div>
            <dl className="mt-5 pt-5 border-t border-line grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {r.server ? (
                <>
                  <Info label="Invite">
                    <span className="font-mono text-xs break-all">{r.server.inviteUrl.replace(/^https:\/\//, '')}</span>
                  </Info>
                  <Info label="Members">{r.server.memberCount.toLocaleString()}</Info>
                </>
              ) : (
                r.bot && (
                  <>
                    <Info label="Add link">
                      <span className="font-mono text-xs break-all">{r.bot.inviteUrl ? r.bot.inviteUrl.replace(/^https:\/\//, '') : 'by ID only'}</span>
                    </Info>
                    <Info label="Servers">{r.bot.serverCount.toLocaleString()}</Info>
                  </>
                )
              )}
              <Info label="Listed">{timeAgo(listing.createdAt)}</Info>
              <Info label="Last bump">{timeAgo(listing.bumpedAt)}</Info>
            </dl>
            <div className="mt-5 pt-5 border-t border-line flex items-center gap-3">
              <Avatar src={lister.avatarUrl} name={lister.username} id={lister.id} size={34} round />
              <div className="text-sm min-w-0 flex-1">
                <div className="font-semibold">
                  @{lister.username} {lister.bannedAt && <span className="ml-1 text-xs text-danger font-semibold">banned</span>}
                </div>
                <div className="text-xs text-ink-3">
                  Lister · joined {lister.createdAt.toLocaleDateString('en-GB')} · {listings} listing{listings === 1 ? '' : 's'}
                </div>
              </div>
              <Link href={`${base}/users?q=${lister.id}`} className="btn btn-ghost btn-sm">
                User
              </Link>
            </div>
          </section>

          {related.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="px-6 h-12 flex items-center font-bold border-b border-line">Other reports on this {target.kind}</h2>
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
            targetKind={target.kind}
            targetId={target.id}
            targetStatus={target.status}
            ownerBanned={!!lister.bannedAt}
            openRelated={related.filter((x) => x.status === 'OPEN').length}
            resolution={r.resolution}
            handledBy={r.handledBy?.username ?? null}
            handledAt={r.handledAt?.toISOString() ?? null}
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
