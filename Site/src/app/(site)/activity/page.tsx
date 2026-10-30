// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { CornerDownRight, MessageSquare } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Reveal } from '@/components/Reveal';
import { Stars } from '@/components/comments/Stars';
import { getCommentsConfig, recentActivity } from '@/lib/comments';
import { timeAgo } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Activity',
  description: 'The newest reviews and replies across every board on YapBoard.',
};

/**
 * Everything people have written lately, across all three boards.
 *
 * One page that changes every time anybody writes anything, which earns its keep twice: it is a reason to
 * come back, and it is a stream of fresh, indexable content whose every row links out to a listing and to
 * a profile. For a directory, that is the cheapest internal linking there is.
 */
export default async function Activity() {
  const cfg = await getCommentsConfig();
  const rows = cfg.enabled ? await recentActivity(40) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Reveal y={10}>
        <h1 className="text-[32px] font-extrabold leading-tight sm:text-[38px]">Activity</h1>
        <p className="mt-2 text-[15px] text-ink-3">The newest reviews and replies, from every board.</p>
      </Reveal>

      {rows.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="mt-10 card px-6 py-16 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <MessageSquare size={24} />
            </div>
            <h2 className="mt-5 text-xl font-bold">{cfg.enabled ? 'Nothing written yet' : 'Reviews are paused'}</h2>
            <p className="mt-2 text-sm text-ink-3">
              {cfg.enabled ? (
                <>
                  Be the first.{' '}
                  <Link href="/servers" className="font-semibold text-accent hover:underline">
                    Find a server
                  </Link>{' '}
                  you are in and say what it is actually like.
                </>
              ) : (
                'YapBoard staff have turned reviews off for now. Nothing has been deleted.'
              )}
            </p>
          </div>
        </Reveal>
      ) : (
        <ul className="mt-10 space-y-3">
          {rows.map((r, i) => {
            const target = r.server
              ? { name: r.server.name, icon: r.server.iconUrl, href: `/view/${r.server.id}`, id: r.server.id, round: false, accent: r.server.accent }
              : r.bot
                ? { name: r.bot.name, icon: r.bot.avatarUrl, href: `/bots/${r.bot.id}`, id: r.bot.id, round: true, accent: r.bot.accent }
                : r.client
                  ? { name: r.client.name, icon: r.client.iconUrl, href: `/clients/${r.client.slug}`, id: r.client.slug, round: false, accent: r.client.accent }
                  : null;
            if (!target) return null;
            const writer = r.user.displayName || r.user.username;
            return (
              <li key={r.id}>
                <Reveal delay={Math.min(0.3, i * 0.02)} y={8}>
                  <article className="card p-4 transition-colors hover:border-line-strong">
                    <div className="flex items-center gap-2.5">
                      <Link href={`/profile/${r.user.id}`} className="shrink-0">
                        <Avatar src={r.user.avatarUrl} name={writer} id={r.user.id} size={26} round />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[13px]">
                        <Link href={`/profile/${r.user.id}`} className="font-semibold hover:text-accent">
                          {writer}
                        </Link>
                        <span className="inline-flex items-center gap-1 text-ink-3">
                          {r.parentId ? (
                            <>
                              <CornerDownRight size={12} /> replied on
                            </>
                          ) : (
                            'reviewed'
                          )}
                        </span>
                        <Link href={target.href} className="truncate font-semibold hover:text-accent" style={{ color: target.accent }}>
                          {target.name}
                        </Link>
                        {r.rating !== null && <Stars value={r.rating} size={12} className="ml-0.5" />}
                        <span className="text-ink-3">· {timeAgo(r.createdAt)}</span>
                      </div>
                      <Link href={target.href} className="shrink-0">
                        <Avatar src={target.icon} name={target.name} id={target.id} size={26} round={target.round} />
                      </Link>
                    </div>
                    <p className="mt-2.5 line-clamp-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{r.body}</p>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
