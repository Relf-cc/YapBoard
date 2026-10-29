// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { ArrowBigUp, ArrowUpRight, CalendarDays, ChevronsUp, EyeOff, Globe2, Pencil, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { getUser } from '@/lib/session';
import { countOnce } from '@/lib/http';
import { canManageListing, cardSelect, isViewable, markPro, readLinks, readScreenshots, toCard } from '@/lib/servers';
import { isPro, limitsFor } from '@/lib/pro';
import { compact, timeAgo } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { Avatar } from '@/components/Avatar';
import { hasSupport } from '@/lib/badges';
import { BadgeMark, BadgeNames, BadgeRow } from '@/components/Badge';
import { SupportBanner, SupportNoReport } from '@/components/SupportFlair';
import { NsfwMark } from '@/components/NsfwMark';
import { TagChip } from '@/components/TagChip';
import { ServerGrid } from '@/components/ServerGrid';
import { ListingHero } from '@/components/ListingHero';
import { Screenshots } from '@/components/Screenshots';
import { Reveal } from '@/components/Reveal';
import { ReportButton } from '@/components/view/ReportButton';
import { ShareButton } from '@/components/view/ShareButton';
import { Description } from '@/components/view/Description';
import { VoteButton } from '@/components/view/VoteButton';
import { getVotingConfig, nextVoteAt, recentVotes, VOTES_SHOWN_DAYS } from '@/lib/votes';

type Props = { params: Promise<{ serverId: string }> };

const load = (id: string) =>
  db.server.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, badges: { select: { kind: true } }, owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load((await params).serverId);
  if (!s || !isViewable(s.status)) return { title: 'Server not found' };
  return {
    title: s.name,
    description: s.summary,
    openGraph: { title: s.name, description: s.summary, images: s.iconUrl ? [s.iconUrl] : undefined },
    robots: s.status === 'UNLISTED' ? { index: false } : undefined,
  };
}

export default async function ViewServer({ params }: Props) {
  const { serverId } = await params;
  const [s, user] = await Promise.all([load(serverId), getUser()]);
  const manager = !!s && canManageListing(user, s);
  // Hidden/removed listings 404 for everyone except their managers and staff.
  if (!s || (!isViewable(s.status) && !manager)) notFound();

  if (countOnce('view', s.id, await headers())) db.server.update({ where: { id: s.id }, data: { views: { increment: 1 } } }).catch(() => {});

  // Voting shows only while it's on, for this server too, and only on public listings.
  const voting = await getVotingConfig();
  const canVote = voting.enabled && !s.votingOff && s.status === 'PUBLIC';
  const [votes, votedUntil] = canVote ? await Promise.all([recentVotes(s.id), user ? nextVoteAt(s.id, user.id, voting) : null]) : [0, null];

  // What this page may draw. A lapsed plan keeps the rows and stops drawing them (src/lib/pro.ts).
  const pro = await isPro('server', s.id, s.ownerId);
  const limits = limitsFor('server', pro);
  const screenshots = readScreenshots(s.screenshots, limits.screenshots);
  const links = readLinks(s.links, limits.links);

  const tags = s.tags.map((t) => t.tag.name);
  const badges = s.badges.map((b) => b.kind);
  // The support listing says so in its own panel below, so the chip would only repeat it.
  const supportBadge = hasSupport(badges);
  // Pro marks are filled in after the pick, so the lookup only covers the three cards that get drawn.
  const similar = tags.length
    ? await markPro(
        (
          await db.server.findMany({
            where: { id: { not: s.id }, status: 'PUBLIC', nsfw: s.nsfw ? undefined : false, tags: { some: { tag: { name: { in: tags } } } } },
            select: cardSelect,
            orderBy: { rankedAt: { sort: 'desc', nulls: 'last' } },
            take: 24,
          })
        )
          .map(toCard)
          .map((c) => ({ c, shared: c.tags.filter((t) => tags.includes(t)).length }))
          .sort((a, b) => b.shared - a.shared)
          .slice(0, 3)
          .map((x) => x.c),
      )
    : [];

  const owner = s.owner.displayName || s.owner.username;

  return (
    <div style={{ '--listing-accent': s.accent } as CSSProperties}>
      <ListingHero accent={s.accent} theme={limits.themes ? s.theme : 'DEFAULT'} bannerUrl={s.bannerUrl} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {s.status !== 'PUBLIC' && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            <EyeOff size={16} />
            {s.status === 'UNLISTED' && 'This server is unlisted. Only people with the link can see it.'}
            {s.status === 'HIDDEN' && `Hidden by YapBoard staff${s.statusNote ? `: ${s.statusNote}` : '.'} Only you and staff can see this page.`}
            {s.status === 'REMOVED' && `Removed by YapBoard staff${s.statusNote ? `: ${s.statusNote}` : '.'}`}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <Reveal y={10}>
              <div className="-mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-5">
                <Avatar src={s.iconUrl} name={s.name} id={s.id} size={112} glow={s.accent} className="ring-[6px] ring-bg shadow-xl" />
                <div className="min-w-0 pb-1">
                  <h1 className="text-[32px] sm:text-[40px] font-extrabold leading-[1.05] break-words">
                    {s.name}
                    {badges.length > 0 && (
                      <>
                        {' '}
                        <BadgeRow kinds={badges} seed={s.id} size={30} max={4} className="-mt-1.5" />
                      </>
                    )}
                    {/* Bought, not granted, so it sits outside BadgeRow and never counts towards its `max`. */}
                    {pro && (
                      <>
                        {' '}
                        <BadgeMark kind="PRO" size={30} seed={s.id} className="-mt-1.5" />
                      </>
                    )}
                  </h1>
                  <BadgeNames kinds={supportBadge ? badges.filter((k) => k !== 'SUPPORT') : badges} seed={s.id} className="mt-2.5" />
                  {supportBadge && <SupportBanner seed={s.id} className="mt-3.5 max-w-xl" />}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={15} />
                      <span className="text-ink-2 font-medium tabular-nums">{s.memberCount.toLocaleString()}</span> members
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Globe2 size={15} />
                      {languageName(s.language)}
                    </span>
                    {s.nsfw && <NsfwMark size="md" />}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <p className="mt-7 text-[19px] leading-relaxed text-ink">{s.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <TagChip key={t} name={t} />
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                <a
                  href={`/join/${s.id}`}
                  className="btn btn-primary btn-lg group min-w-40"
                  style={{ boxShadow: `0 10px 28px -10px color-mix(in srgb, ${s.accent} 75%, transparent), inset 0 1px 0 #ffffff40, 0 1px 2px #0006` }}
                >
                  Join server
                  <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                {canVote && (
                  <VoteButton
                    serverId={s.id}
                    accent={s.accent}
                    votes={votes}
                    blocked={!user ? 'login' : user.id === s.ownerId ? 'own' : null}
                    nextAt={votedUntil ? votedUntil.toISOString() : null}
                  />
                )}
                {links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn btn-secondary btn-lg group">
                    {l.label}
                    <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                ))}
                <ShareButton url={`/view/${s.id}`} />
                {manager && (
                  <Link href={`/manage/${s.id}`} className="btn btn-secondary btn-lg">
                    <Pencil size={16} />
                    Edit listing
                  </Link>
                )}
              </div>
            </Reveal>

            {screenshots.length > 0 && (
              <Reveal delay={0.1}>
                <section className="mt-12">
                  <h2 className="text-lg font-bold mb-4">Screenshots</h2>
                  <Screenshots urls={screenshots} name={s.name} accent={s.accent} />
                </section>
              </Reveal>
            )}

            <Reveal delay={0.1}>
              <section className="mt-12">
                <h2 className="text-lg font-bold mb-4">About</h2>
                <Description text={s.description} />
              </section>
            </Reveal>
          </div>

          {/* sidebar */}
          <aside className="lg:pt-8 space-y-4">
            <Reveal delay={0.08}>
              <div className="card relative overflow-hidden p-5">
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${s.accent} 85%, transparent), transparent)` }} />
                <dl className="grid grid-cols-2 gap-y-5 gap-x-4">
                  <Fact label="Members" value={compact(s.memberCount)} icon={<Users size={14} style={{ color: s.accent }} />} />
                  <Fact label="Bumps" value={compact(s.bumpCount)} icon={<ChevronsUp size={14} style={{ color: s.accent }} />} />
                  <Fact label="Last bump" value={timeAgo(s.bumpedAt)} icon={<ChevronsUp size={14} style={{ color: s.accent }} />} />
                  {canVote ? (
                    <Fact label={`Votes (${VOTES_SHOWN_DAYS} days)`} value={compact(votes)} icon={<ArrowBigUp size={14} style={{ color: s.accent }} />} />
                  ) : (
                    <Fact label="Listed" value={s.createdAt.toLocaleDateString('en', { month: 'short', year: 'numeric' })} icon={<CalendarDays size={14} style={{ color: s.accent }} />} />
                  )}
                </dl>
                <div className="mt-5 pt-5 border-t border-line flex items-center gap-3">
                  <Avatar src={s.owner.avatarUrl} name={owner} id={s.owner.id} size={34} round />
                  <div className="min-w-0 text-sm">
                    <div className="text-ink-3 text-xs">Listed by</div>
                    <div className="font-semibold truncate">{owner}</div>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="flex items-center justify-between px-1 text-xs text-ink-3">
                <span className="font-mono">ID {s.id}</span>
                {supportBadge ? <SupportNoReport /> : <ReportButton target={{ kind: 'server', id: s.id, name: s.name }} loggedIn={!!user} />}
              </div>
            </Reveal>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-extrabold mb-6">If you like this, try</h2>
            <ServerGrid servers={similar} />
          </section>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-ink-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
