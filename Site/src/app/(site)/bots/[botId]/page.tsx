import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { ArrowUpRight, CalendarDays, ChevronsUp, EyeOff, Globe2, LifeBuoy, Link2, Pencil, Server, Terminal } from 'lucide-react';
import { botCardSelect, canManageBot, isBotViewable, toBotCard } from '@/lib/bots';
import { db } from '@/lib/db';
import { compact, timeAgo } from '@/lib/format';
import { countOnce } from '@/lib/http';
import { languageName } from '@/lib/languages';
import { getUser } from '@/lib/session';
import { Avatar } from '@/components/Avatar';
import { hasSupport } from '@/lib/badges';
import { BadgeNames, BadgeRow } from '@/components/Badge';
import { BotGrid } from '@/components/BotGrid';
import { CopyField } from '@/components/CopyField';
import { SupportBanner, SupportNoReport } from '@/components/SupportFlair';
import { NsfwMark } from '@/components/NsfwMark';
import { Reveal } from '@/components/Reveal';
import { TagChip } from '@/components/TagChip';
import { Description } from '@/components/view/Description';
import { ReportButton } from '@/components/view/ReportButton';
import { ShareButton } from '@/components/view/ShareButton';

type Props = { params: Promise<{ botId: string }> };

const load = (id: string) =>
  db.botListing.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      badges: { select: { kind: true } },
      owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      supportServer: { select: { id: true, name: true, iconUrl: true, status: true, memberCount: true } },
    },
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await load((await params).botId);
  if (!b || !isBotViewable(b.status)) return { title: 'Bot not found' };
  return {
    title: b.name,
    description: b.summary,
    openGraph: { title: b.name, description: b.summary, images: b.avatarUrl ? [b.avatarUrl] : undefined },
    robots: b.status === 'UNLISTED' ? { index: false } : undefined,
  };
}

export default async function ViewBot({ params }: Props) {
  const { botId } = await params;
  const [b, user] = await Promise.all([load(botId), getUser()]);
  const manager = !!b && canManageBot(user, b);
  // Hidden/removed listings 404 for everyone except their managers and staff.
  if (!b || (!isBotViewable(b.status) && !manager)) notFound();

  if (countOnce('view', `bot:${b.id}`, await headers())) db.botListing.update({ where: { id: b.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const tags = b.tags.map((t) => t.tag.name);
  const badges = b.badges.map((x) => x.kind);
  // The support listing says so in its own panel below, so the chip would only repeat it.
  const supportBadge = hasSupport(badges);
  const similar = tags.length
    ? (
        await db.botListing.findMany({
          where: { id: { not: b.id }, status: 'PUBLIC', nsfw: b.nsfw ? undefined : false, tags: { some: { tag: { name: { in: tags } } } } },
          select: botCardSelect,
          orderBy: { bumpedAt: { sort: 'desc', nulls: 'last' } },
          take: 24,
        })
      )
        .map(toBotCard)
        .map((c) => ({ c, shared: c.tags.filter((t) => tags.includes(t)).length }))
        .sort((x, y) => y.shared - x.shared)
        .slice(0, 3)
        .map((x) => x.c)
    : [];

  const owner = b.owner.displayName || b.owner.username;
  const support = b.supportServer && isBotViewable(b.supportServer.status) ? b.supportServer : null;

  return (
    <div style={{ '--listing-accent': b.accent } as CSSProperties}>
      {/* banner */}
      <div className="relative h-40 sm:h-56 overflow-hidden border-b border-line" style={{ background: `color-mix(in srgb, ${b.accent} 34%, var(--bg))` }}>
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, color-mix(in srgb, ${b.accent} 70%, transparent) 1px, transparent 0)`, backgroundSize: '18px 18px' }}
        />
        <div aria-hidden className="absolute -left-10 bottom-0 h-56 w-56 sm:h-72 sm:w-72 rounded-full blur-3xl opacity-50" style={{ background: `color-mix(in srgb, ${b.accent} 85%, transparent)` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-bg/10" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {b.status !== 'PUBLIC' && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            <EyeOff size={16} />
            {b.status === 'UNLISTED' && 'This bot is unlisted. Only people with the link can see it.'}
            {b.status === 'HIDDEN' && `Hidden by YapBoard staff${b.statusNote ? `: ${b.statusNote}` : '.'} Only you and staff can see this page.`}
            {b.status === 'REMOVED' && `Removed by YapBoard staff${b.statusNote ? `: ${b.statusNote}` : '.'}`}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <Reveal y={10}>
              <div className="-mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-5">
                <Avatar src={b.avatarUrl} name={b.name} id={b.id} size={112} round glow={b.accent} className="ring-[6px] ring-bg shadow-xl" />
                <div className="min-w-0 pb-1">
                  <h1 className="text-[32px] sm:text-[40px] font-extrabold leading-[1.05] break-words">
                    {b.name}
                    {badges.length > 0 && (
                      <>
                        {' '}
                        <BadgeRow kinds={badges} seed={b.id} size={30} max={4} className="-mt-1.5" />
                      </>
                    )}
                  </h1>
                  <BadgeNames kinds={supportBadge ? badges.filter((k) => k !== 'SUPPORT') : badges} seed={b.id} className="mt-2.5" />
                  {supportBadge && <SupportBanner seed={b.id} className="mt-3.5 max-w-xl" />}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Server size={15} />
                      <span className="text-ink-2 font-medium tabular-nums">{b.serverCount.toLocaleString()}</span> servers
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Terminal size={15} />
                      {b.prefix ? <code className="font-mono text-ink-2">{b.prefix}</code> : 'Slash commands'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Globe2 size={15} />
                      {languageName(b.language)}
                    </span>
                    {b.nsfw && <NsfwMark size="md" />}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <p className="mt-7 text-[19px] leading-relaxed text-ink">{b.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <TagChip key={t} name={t} href={`/bots?tag=${encodeURIComponent(t)}`} />
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                <a
                  href={`/add-bot/${b.id}`}
                  className="btn btn-primary btn-lg group min-w-40"
                  style={{ boxShadow: `0 10px 28px -10px color-mix(in srgb, ${b.accent} 75%, transparent), inset 0 1px 0 #ffffff40, 0 1px 2px #0006` }}
                >
                  Add to your server
                  <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                {b.website && (
                  <a href={b.website} target="_blank" rel="noreferrer nofollow" className="btn btn-secondary btn-lg">
                    <Link2 size={16} />
                    Website
                  </a>
                )}
                <ShareButton url={`/bots/${b.id}`} />
                {manager && (
                  <Link href={`/bots/${b.id}/manage`} className="btn btn-secondary btn-lg">
                    <Pencil size={16} />
                    Edit listing
                  </Link>
                )}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <section className="mt-12">
                <h2 className="text-lg font-bold mb-4">About</h2>
                <Description text={b.description} />
              </section>
            </Reveal>
          </div>

          {/* sidebar */}
          <aside className="lg:pt-8 space-y-4">
            <Reveal delay={0.08}>
              <div className="card relative overflow-hidden p-5">
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${b.accent} 85%, transparent), transparent)` }} />
                <dl className="grid grid-cols-2 gap-y-5 gap-x-4">
                  <Fact label="Servers" value={compact(b.serverCount)} icon={<Server size={14} style={{ color: b.accent }} />} />
                  <Fact label="Bumps" value={compact(b.bumpCount)} icon={<ChevronsUp size={14} style={{ color: b.accent }} />} />
                  <Fact label="Last bump" value={timeAgo(b.bumpedAt)} icon={<ChevronsUp size={14} style={{ color: b.accent }} />} />
                  <Fact label="Listed" value={b.createdAt.toLocaleDateString('en', { month: 'short', year: 'numeric' })} icon={<CalendarDays size={14} style={{ color: b.accent }} />} />
                </dl>
                <div className="mt-5 pt-5 border-t border-line flex items-center gap-3">
                  <Avatar src={b.owner.avatarUrl} name={owner} id={b.owner.id} size={34} round />
                  <div className="min-w-0 text-sm">
                    <div className="text-ink-3 text-xs">Listed by</div>
                    <div className="font-semibold truncate">{owner}</div>
                  </div>
                </div>
              </div>
            </Reveal>

            {support && (
              <Reveal delay={0.1}>
                <Link href={`/view/${support.id}`} className="card flex items-center gap-3.5 p-4 hover:border-line-strong transition-colors">
                  <Avatar src={support.iconUrl} name={support.name} id={support.id} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-ink-3">
                      <LifeBuoy size={12} /> Support server
                    </div>
                    <div className="mt-0.5 font-semibold truncate">{support.name}</div>
                    <div className="text-xs text-ink-3 tabular-nums">{compact(support.memberCount)} members</div>
                  </div>
                  <ArrowUpRight size={15} className="text-ink-3 shrink-0" />
                </Link>
              </Reveal>
            )}

            <Reveal delay={0.12}>
              <div className="card p-4">
                <p className="text-xs text-ink-3">Add it by ID</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
                  In Yapin’: <b className="text-ink-2">Server settings → Bots → Have a bot ID?</b>
                </p>
                <CopyField value={b.id} className="mt-3" />
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="flex items-center justify-end px-1 text-xs text-ink-3">
                {supportBadge ? <SupportNoReport /> : <ReportButton target={{ kind: 'bot', id: b.id, name: b.name }} loggedIn={!!user} />}
              </div>
            </Reveal>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-extrabold mb-6">Bots like this</h2>
            <BotGrid bots={similar} />
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
