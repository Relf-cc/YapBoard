'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import Link from 'next/link';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { ArrowUpRight, ChevronsUp, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { BadgeRow } from './Badge';
import { SupportFlair } from './SupportFlair';
import { NsfwMark } from './NsfwMark';
import { Tooltip } from './Tooltip';
import { compact, timeAgo } from '@/lib/format';
import { languageName } from '@/lib/languages';
import { hasSupport } from '@/lib/badges';
import type { ServerCard as Card } from '@/lib/servers';

export function ServerCard({ server, activeTags = [] }: { server: Card; activeTags?: string[] }) {
  const support = hasSupport(server.badges);
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={clsx('group relative flex w-full flex-col card p-5 overflow-hidden transition-colors', support ? 'support-card' : 'hover:border-line-strong')}
    >
      {support && <SupportFlair seed={server.id} />}
      <span
        aria-hidden
        className="absolute left-0 top-5 h-10 w-[3px] rounded-r-full origin-center scale-y-0 group-hover:scale-y-100 transition-transform duration-300 ease-out-soft"
        style={{ background: server.accent }}
      />
      <div className="relative flex items-start gap-3.5">
        <Avatar src={server.iconUrl} name={server.name} id={server.id} size={52} className="transition-transform duration-300 ease-out-soft group-hover:-rotate-3" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-display text-[16.5px] font-bold leading-tight">
            <Link href={`/view/${server.id}`} className="truncate after:absolute after:inset-0 after:content-['']">
              {server.name}
            </Link>
            <BadgeRow kinds={server.badges} seed={server.id} size={17} max={3} />
            {server.nsfw && <NsfwMark />}
          </h3>
          <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Users size={13} strokeWidth={2.2} />
              <span className="tabular-nums text-ink-2 font-medium">{compact(server.memberCount)}</span>
            </span>
            <span className="truncate">{languageName(server.language)}</span>
            {server.bumpedAt && (
              <Tooltip className="relative z-10 ml-auto shrink-0" content={`Last bumped ${new Date(server.bumpedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}>
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <ChevronsUp size={13} className="text-accent" />
                  {timeAgo(server.bumpedAt)}
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <p className="relative mt-3.5 text-[14px] leading-relaxed text-ink-2 line-clamp-2 min-h-[2lh]">{server.summary}</p>

      <div className="relative z-10 mt-4 flex flex-wrap gap-1.5">
        {server.tags.slice(0, 4).map((t) => (
          <Link key={t} href={`/servers?tag=${encodeURIComponent(t)}`} className={`chip ${activeTags.includes(t) ? 'chip-active' : ''}`}>
            <span className="text-ink-3">#</span>
            {t}
          </Link>
        ))}
      </div>

      <div className="relative z-10 mt-auto pt-5 flex items-center gap-2">
        <Link href={`/view/${server.id}`} className="btn btn-secondary btn-sm flex-1">
          View
        </Link>
        <a href={`/join/${server.id}`} className="btn btn-primary btn-sm flex-1 group/join">
          Join
          <ArrowUpRight size={15} className="transition-transform duration-200 group-hover/join:translate-x-0.5 group-hover/join:-translate-y-0.5" />
        </a>
      </div>
    </motion.article>
  );
}
