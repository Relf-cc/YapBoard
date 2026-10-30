// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowUpRight, CalendarDays, ChevronsUp, EyeOff, Link2, MessageSquare, PenLine, Star } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { BadgeRow, ProMark } from '@/components/Badge';
import { Reveal } from '@/components/Reveal';
import { Stars } from '@/components/comments/Stars';
import { UserBadgeRow } from '@/components/UserBadges';
import { CommenterBadge } from '@/components/comments/CommenterBadge';
import { db } from '@/lib/db';
import { boardMean } from '@/lib/engagement';
import { compact } from '@/lib/format';
import { loadProfile, type ProfileListing } from '@/lib/profiles';
import { shownRating } from '@/lib/ratings';
import { getUser, isStaff } from '@/lib/session';

type Props = { params: Promise<{ userId: string }> };

/**
 * Somebody's public page.
 *
 * The URL is the user id, not the username, because ids are stable and usernames change - a profile link
 * in a two-year-old comment has to still work. `/@name` is handled here too: it looks the name up and
 * redirects to the id, so a link anybody can type gets you to the canonical one.
 */
async function resolve(param: string): Promise<string | { redirectTo: string } | null> {
  const raw = decodeURIComponent(param);
  if (!raw.startsWith('@')) return raw;
  const user = await db.user.findFirst({ where: { username: raw.slice(1) }, select: { id: true } });
  return user ? { redirectTo: `/profile/${user.id}` } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve((await params).userId);
  if (!found || typeof found !== 'string') return { title: 'Profile' };
  const p = await loadProfile(found);
  if (!p) return { title: 'Profile not found', robots: { index: false } };
  return {
    title: p.name,
    description: p.hidden ? undefined : p.bio || `${p.name} on YapBoard.`,
    // A private profile is still reachable by link; it just shouldn't be in anybody's search results.
    robots: p.hidden ? { index: false } : undefined,
  };
}

export default async function ProfilePage({ params }: Props) {
  const found = await resolve((await params).userId);
  if (!found) notFound();
  if (typeof found !== 'string') redirect(found.redirectTo);

  const me = await getUser();
  const p = await loadProfile(found, isStaff(me));
  if (!p) notFound();
  const mean = await boardMean();
  const mine = me?.id === p.id;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
      <Reveal y={10}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar src={p.avatarUrl} name={p.name} id={p.id} size={96} round className="ring-[5px] ring-bg" />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[28px] font-extrabold leading-tight sm:text-[34px]">
              <span className="break-words">{p.name}</span>
              {/* Owner supersedes the staff chips rather than stacking - see commenterBadges(). */}
              {p.siteOwner ? (
                <CommenterBadge kind="SITE_OWNER" />
              ) : p.role === 'ADMIN' ? (
                <CommenterBadge kind="ADMIN" />
              ) : p.role === 'STAFF' ? (
                <CommenterBadge kind="STAFF" />
              ) : null}
              {p.pro && <ProMark size={22} seed={p.id} />}
            </h1>
            <p className="mt-1 text-[14px] text-ink-3">@{p.username}</p>
            {p.bio && <p className="mt-3 max-w-xl whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{p.bio}</p>}
            {p.link && (
              <a href={p.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                <Link2 size={14} />
                {p.link.replace(/^https:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            <UserBadgeRow kinds={p.badges} className="mt-4" />
          </div>
          {mine && (
            <Link href="/dashboard#profile" className="btn btn-secondary btn-sm shrink-0">
              Edit profile
            </Link>
          )}
        </div>
      </Reveal>

      {p.hidden ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex items-center gap-2.5 rounded-xl border border-line bg-raised px-4 py-3.5 text-sm text-ink-3">
            <EyeOff size={16} className="shrink-0" />
            {/*
              Their choice, and what it hides is the aggregate - the counters and everything they run in one
              place. The listings still name their owner on their own pages, which was never private.
            */}
            {mine ? 'Your profile is private. Only you and YapBoard staff see what’s on it.' : 'This profile is private.'}
          </div>
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.05}>
            <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Bumps given" value={compact(p.counts.bumps)} icon={<ChevronsUp size={14} className="text-accent" />} />
              <Stat label="Votes cast" value={compact(p.counts.votes)} icon={<Star size={14} className="text-accent" />} />
              <Stat label="Reviews" value={compact(p.counts.reviews)} icon={<PenLine size={14} className="text-accent" />} />
              <Stat label="Replies" value={compact(p.counts.replies)} icon={<MessageSquare size={14} className="text-accent" />} />
            </dl>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3">
              <CalendarDays size={14} />
              On YapBoard since {p.joinedAt.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <section className="mt-12">
              <h2 className="mb-5 text-lg font-bold">
                {p.listings.length === 0 ? 'Nothing listed yet' : `${p.listings.length} listing${p.listings.length === 1 ? '' : 's'}`}
              </h2>
              {p.listings.length === 0 ? (
                <p className="text-[14px] text-ink-3">
                  {mine ? (
                    <>
                      Nothing of yours is listed publicly.{' '}
                      <Link href="/add" className="font-semibold text-accent hover:underline">
                        List a server
                      </Link>
                      .
                    </>
                  ) : (
                    'Nothing of theirs is listed publicly right now.'
                  )}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {p.listings.map((l) => (
                    <ListingRow key={`${l.kind}-${l.id}`} listing={l} boardMean={mean} />
                  ))}
                </div>
              )}
            </section>
          </Reveal>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card p-4">
      <dt className="flex items-center gap-1.5 text-xs text-ink-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

const KIND_LABEL = { server: 'Server', bot: 'Bot', client: 'Client' } as const;

function ListingRow({ listing: l, boardMean: mean }: { listing: ProfileListing; boardMean: number }) {
  const rating = shownRating(l.ratingSum, l.reviewCount, mean);
  return (
    <Link href={l.href} className="group card flex items-start gap-3.5 p-4 transition-colors hover:border-line-strong">
      <Avatar src={l.iconUrl} name={l.name} id={l.id} size={42} round={l.round} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-display text-[15px] font-bold">{l.name}</h3>
          <BadgeRow kinds={l.badges} seed={l.id} size={15} max={2} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-3">
          <span>{KIND_LABEL[l.kind]}</span>
          {/* Said out loud, because helping with somebody's listing is not the same as having listed it. */}
          {l.helping && <span className="text-accent">co-manager</span>}
          {rating !== null && (
            <span className="inline-flex items-center gap-1">
              <Stars value={rating} size={11} />
              {l.reviewCount}
            </span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{l.summary}</p>
      </div>
      <ArrowUpRight size={15} className="mt-1 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}
