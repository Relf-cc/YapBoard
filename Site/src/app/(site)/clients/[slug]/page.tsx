// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { ArrowUpRight, CalendarDays, ChevronsUp, Download, EyeOff, GitBranch, Globe2, History, LifeBuoy, Link2, Pencil, Wrench } from 'lucide-react';
import {
  canManageClient,
  clientCardSelect,
  groupDownloads,
  isClientViewable,
  readPlatforms,
  readScreenshots,
  releaseIsStale,
  RELEASE_TTL_MS,
  syncClientRelease,
  toClientCard,
} from '@/lib/clients';
import { db } from '@/lib/db';
import { compact, timeAgo } from '@/lib/format';
import { repoUrl } from '@/lib/github';
import { countOnce, rateLimit } from '@/lib/http';
import { languageName } from '@/lib/languages';
import { PLATFORMS } from '@/lib/platforms';
import { getUser } from '@/lib/session';
import { hasSupport } from '@/lib/badges';
import { Avatar } from '@/components/Avatar';
import { BadgeNames, BadgeRow } from '@/components/Badge';
import { ClientGrid } from '@/components/ClientGrid';
import { Changelog } from '@/components/clients/Changelog';
import { DownloadPanel } from '@/components/clients/DownloadPanel';
import { PlatformIcon } from '@/components/clients/PlatformIcon';
import { ListingHero } from '@/components/ListingHero';
import { Screenshots } from '@/components/Screenshots';
import { NsfwMark } from '@/components/NsfwMark';
import { Reveal } from '@/components/Reveal';
import { SupportBanner, SupportNoReport } from '@/components/SupportFlair';
import { TagChip } from '@/components/TagChip';
import { Description } from '@/components/view/Description';
import { Reviews } from '@/components/comments/Reviews';
import { ReportButton } from '@/components/view/ReportButton';
import { ShareButton } from '@/components/view/ShareButton';

type Props = { params: Promise<{ slug: string }> };

const load = (slug: string) =>
  db.clientListing.findUnique({
    where: { slug },
    include: {
      tags: { include: { tag: true } },
      managers: { select: { userId: true } },
      badges: { select: { kind: true } },
      owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      files: { select: { id: true, platform: true, kind: true, arch: true, label: true, url: true, size: true, managed: true } },
    },
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).slug);
  if (!c || !isClientViewable(c.status)) return { title: 'Client not found' };
  return {
    title: c.name,
    description: c.summary,
    openGraph: { title: c.name, description: c.summary, images: c.bannerUrl ? [c.bannerUrl] : c.iconUrl ? [c.iconUrl] : undefined },
    robots: c.status === 'UNLISTED' ? { index: false } : undefined,
  };
}

export default async function ViewClient({ params }: Props) {
  const { slug } = await params;
  const [c, user] = await Promise.all([load(slug), getUser()]);
  const manager = !!c && canManageClient(user, c);
  // Hidden/removed listings 404 for everyone except their managers and staff.
  if (!c || (!isClientViewable(c.status) && !manager)) notFound();

  const h = await headers();
  if (countOnce('view', `client:${c.id}`, h)) db.clientListing.update({ where: { id: c.id }, data: { views: { increment: 1 } } }).catch(() => {});

  /**
   * Releases refresh themselves. A page view with a stale release kicks off a sync and doesn't wait for it, so
   * nobody sits through a GitHub round trip; the new version is there on the next view. The limit is one sync
   * per client per TTL across every visitor, not per visitor - a popular client being opened a hundred times
   * an hour must not become a hundred calls to GitHub. A failure is recorded, not retried in a loop.
   */
  if (c.releaseSource === 'GITHUB' && c.repo && releaseIsStale(c.releaseSyncedAt) && rateLimit(`client:autosync:${c.id}`, 1, RELEASE_TTL_MS)) {
    void syncClientRelease(c.id).catch(() => {});
  }

  const tags = c.tags.map((t) => t.tag.name);
  const badges = c.badges.map((x) => x.kind);
  const supportBadge = hasSupport(badges);
  const platforms = readPlatforms(c.platforms);
  const screenshots = readScreenshots(c.screenshots);
  const groups = groupDownloads(c.files);

  const support = c.supportServerId ? await db.server.findUnique({ where: { id: c.supportServerId }, select: { id: true, name: true, iconUrl: true, status: true, memberCount: true } }) : null;
  const supportServer = support && isClientViewable(support.status) ? support : null;

  const similar = tags.length
    ? (
        await db.clientListing.findMany({
          where: { id: { not: c.id }, status: 'PUBLIC', nsfw: c.nsfw ? undefined : false, tags: { some: { tag: { name: { in: tags } } } } },
          select: clientCardSelect,
          orderBy: { bumpedAt: { sort: 'desc', nulls: 'last' } },
          take: 24,
        })
      )
        .map(toClientCard)
        .map((card) => ({ card, shared: card.tags.filter((t) => tags.includes(t)).length }))
        .sort((x, y) => y.shared - x.shared)
        .slice(0, 3)
        .map((x) => x.card)
    : [];

  const owner = c.owner.displayName || c.owner.username;
  const source = c.repo ? repoUrl(c.repo) : c.sourceUrl;

  return (
    <div style={{ '--listing-accent': c.accent } as CSSProperties}>
      <ListingHero accent={c.accent} theme={c.theme} bannerUrl={c.bannerUrl} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {c.status !== 'PUBLIC' && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            <EyeOff size={16} />
            {c.status === 'PENDING' && 'Waiting for a YapBoard staff review. Only you and staff can see this page until it’s approved.'}
            {c.status === 'DENIED' && `Staff asked for changes${c.statusNote ? `: ${c.statusNote}` : '.'} Edit the listing and save to send it back for review.`}
            {c.status === 'UNLISTED' && 'This client is unlisted. Only people with the link can see it.'}
            {c.status === 'HIDDEN' && `Hidden by YapBoard staff${c.statusNote ? `: ${c.statusNote}` : '.'} Only you and staff can see this page.`}
            {c.status === 'REMOVED' && `Removed by YapBoard staff${c.statusNote ? `: ${c.statusNote}` : '.'}`}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <Reveal y={10}>
              <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end">
                <Avatar src={c.iconUrl} name={c.name} id={c.id} size={112} glow={c.accent} className="shadow-xl ring-[6px] ring-bg" />
                <div className="min-w-0 pb-1">
                  <h1 className="break-words text-[32px] font-extrabold leading-[1.05] sm:text-[40px]">
                    {c.name}
                    {badges.length > 0 && (
                      <>
                        {' '}
                        <BadgeRow kinds={badges} seed={c.id} size={30} max={4} className="-mt-1.5" />
                      </>
                    )}
                  </h1>
                  <BadgeNames kinds={supportBadge ? badges.filter((k) => k !== 'SUPPORT') : badges} seed={c.id} className="mt-2.5" />
                  {supportBadge && <SupportBanner seed={c.id} className="mt-3.5 max-w-xl" />}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Download size={15} />
                      <span className="font-medium tabular-nums text-ink-2">{c.downloads.toLocaleString()}</span> downloads
                    </span>
                    {platforms.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        {platforms.slice(0, 4).map((p) => (
                          <PlatformIcon key={p} platform={p} size={14} />
                        ))}
                        <span className="text-ink-2">{platforms.map((p) => PLATFORMS[p].label).join(', ')}</span>
                      </span>
                    )}
                    {c.framework && (
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench size={15} />
                        {c.framework}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Globe2 size={15} />
                      {languageName(c.language)}
                    </span>
                    {c.nsfw && <NsfwMark size="md" />}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <p className="mt-7 text-[19px] leading-relaxed text-ink">{c.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <TagChip key={t} name={t} href={`/clients?tag=${encodeURIComponent(t)}`} />
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                <a
                  href="#download"
                  className="btn btn-primary btn-lg group min-w-40"
                  style={{ boxShadow: `0 10px 28px -10px color-mix(in srgb, ${c.accent} 75%, transparent), inset 0 1px 0 #ffffff40, 0 1px 2px #0006` }}
                >
                  <Download size={18} className="transition-transform group-hover:translate-y-0.5" />
                  Download{c.version ? ` ${c.version}` : ''}
                </a>
                {source && (
                  <a href={source} target="_blank" rel="noreferrer nofollow" className="btn btn-secondary btn-lg">
                    <GitBranch size={16} />
                    Source
                  </a>
                )}
                {c.website && (
                  <a href={c.website} target="_blank" rel="noreferrer nofollow" className="btn btn-secondary btn-lg">
                    <Link2 size={16} />
                    Website
                  </a>
                )}
                <ShareButton url={`/clients/${c.slug}`} />
                {manager && (
                  <Link href={`/clients/${c.slug}/manage`} className="btn btn-secondary btn-lg">
                    <Pencil size={16} />
                    Edit listing
                  </Link>
                )}
              </div>
            </Reveal>

            {screenshots.length > 0 && (
              <Reveal delay={0.08}>
                <section className="mt-12">
                  <h2 className="mb-4 text-lg font-bold">Screenshots</h2>
                  <Screenshots urls={screenshots} name={c.name} accent={c.accent} />
                </section>
              </Reveal>
            )}

            <Reveal delay={0.1}>
              <section className="mt-12">
                <h2 className="mb-4 text-lg font-bold">About</h2>
                <Description text={c.description} />
              </section>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="mt-12">
                <DownloadPanel
                  clientId={c.id}
                  clientName={c.name}
                  accent={c.accent}
                  version={c.version}
                  releaseUrl={c.releaseUrl}
                  groups={groups}
                  claimed={platforms}
                />
              </div>
            </Reveal>

            {c.changelog && (
              <Reveal delay={0.14}>
                <section className="mt-12">
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <History size={17} className="text-accent" />
                      What’s new{c.version ? ` in ${c.version}` : ''}
                    </h2>
                    {c.releasedAt && <span className="text-xs text-ink-3">Released {timeAgo(c.releasedAt)}</span>}
                  </div>
                  {c.releaseName && <p className="mb-3 font-display text-[17px] font-bold">{c.releaseName}</p>}
                  <div className="card p-6">
                    <Changelog text={c.changelog} />
                  </div>
                  {c.releaseUrl && (
                    <a href={c.releaseUrl} target="_blank" rel="noreferrer nofollow" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                      Every release <ArrowUpRight size={14} />
                    </a>
                  )}
                </section>
              </Reveal>
            )}

            <Reveal delay={0.16}>
              <Reviews kind="client" listing={c} accent={c.accent} />
            </Reveal>
          </div>

          {/* sidebar */}
          <aside className="space-y-4 lg:pt-8">
            <Reveal delay={0.08}>
              <div className="card relative overflow-hidden p-5">
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${c.accent} 85%, transparent), transparent)` }} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <Fact label="Downloads" value={compact(c.downloads)} icon={<Download size={14} style={{ color: c.accent }} />} />
                  <Fact label="Version" value={c.version || '-'} icon={<GitBranch size={14} style={{ color: c.accent }} />} />
                  <Fact label="Released" value={c.releasedAt ? timeAgo(c.releasedAt) : '-'} icon={<History size={14} style={{ color: c.accent }} />} />
                  <Fact label="Listed" value={c.createdAt.toLocaleDateString('en', { month: 'short', year: 'numeric' })} icon={<CalendarDays size={14} style={{ color: c.accent }} />} />
                </dl>
                <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
                  <Avatar src={c.owner.avatarUrl} name={owner} id={c.owner.id} size={34} round />
                  <div className="min-w-0 text-sm">
                    <div className="text-xs text-ink-3">Listed by</div>
                    <div className="truncate font-semibold">{owner}</div>
                  </div>
                </div>
              </div>
            </Reveal>

            {c.repo && (
              <Reveal delay={0.09}>
                <a href={repoUrl(c.repo)} target="_blank" rel="noreferrer nofollow" className="card flex items-center gap-3.5 p-4 transition-colors hover:border-line-strong">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
                    <GitBranch size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-ink-3">Source and releases</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-semibold">{c.repo}</div>
                  </div>
                  <ArrowUpRight size={15} className="shrink-0 text-ink-3" />
                </a>
              </Reveal>
            )}

            {supportServer && (
              <Reveal delay={0.1}>
                <Link href={`/view/${supportServer.id}`} className="card flex items-center gap-3.5 p-4 transition-colors hover:border-line-strong">
                  <Avatar src={supportServer.iconUrl} name={supportServer.name} id={supportServer.id} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-ink-3">
                      <LifeBuoy size={12} /> Support server
                    </div>
                    <div className="mt-0.5 truncate font-semibold">{supportServer.name}</div>
                    <div className="text-xs tabular-nums text-ink-3">{compact(supportServer.memberCount)} members</div>
                  </div>
                  <ArrowUpRight size={15} className="shrink-0 text-ink-3" />
                </Link>
              </Reveal>
            )}

            <Reveal delay={0.12}>
              <div className="card p-4">
                <p className="text-xs font-semibold text-ink">Not an official Yapin’ app</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                  {c.name} is built by {owner}, not by Yapin’ or YapBoard. Running a modified client is at your own risk, and
                  Yapin’ decides what’s allowed on Yapin’.
                </p>
                <Link href="/clients/terms#safety" className="mt-2.5 inline-block text-[13px] font-medium text-accent hover:underline">
                  Read the safety notes
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="flex items-center justify-end px-1 text-xs text-ink-3">
                {supportBadge ? <SupportNoReport /> : <ReportButton target={{ kind: 'client', id: c.id, name: c.name }} loggedIn={!!user} />}
              </div>
            </Reveal>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-6 text-2xl font-extrabold">Clients like this</h2>
            <ClientGrid clients={similar} />
          </section>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-ink-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate font-display text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
