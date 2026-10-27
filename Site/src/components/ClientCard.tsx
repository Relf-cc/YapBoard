'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import Link from 'next/link';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { ChevronsUp, Download, Tag } from 'lucide-react';
import { Avatar } from './Avatar';
import { BadgeRow } from './Badge';
import { SupportFlair } from './SupportFlair';
import { NsfwMark } from './NsfwMark';
import { Tooltip } from './Tooltip';
import { PlatformRow } from './clients/PlatformIcon';
import { compact, timeAgo } from '@/lib/format';
import { hasSupport } from '@/lib/badges';
import type { ClientCard as Card } from '@/lib/clients';

/** The third card: downloads instead of members, the version instead of a prefix, and what it runs on. */
export function ClientCard({ client, activeTags = [] }: { client: Card; activeTags?: string[] }) {
  const support = hasSupport(client.badges);
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={clsx('group relative flex w-full flex-col card p-5 overflow-hidden transition-colors', support ? 'support-card' : 'hover:border-line-strong')}
    >
      {support && <SupportFlair seed={client.id} />}
      <span
        aria-hidden
        className="absolute left-0 top-5 h-10 w-[3px] rounded-r-full origin-center scale-y-0 group-hover:scale-y-100 transition-transform duration-300 ease-out-soft"
        style={{ background: client.accent }}
      />
      <div className="relative flex items-start gap-3.5">
        <Avatar src={client.iconUrl} name={client.name} id={client.id} size={52} className="transition-transform duration-300 ease-out-soft group-hover:-rotate-3" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-display text-[16.5px] font-bold leading-tight">
            <Link href={`/clients/${client.slug}`} className="truncate after:absolute after:inset-0 after:content-['']">
              {client.name}
            </Link>
            <BadgeRow kinds={client.badges} seed={client.id} size={17} max={3} />
            {client.nsfw && <NsfwMark />}
          </h3>
          <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Download size={13} strokeWidth={2.2} />
              <span className="tabular-nums text-ink-2 font-medium">{compact(client.downloads)}</span>
            </span>
            {client.version && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Tag size={13} strokeWidth={2.2} />
                <code className="truncate font-mono text-ink-2">{client.version}</code>
              </span>
            )}
            <PlatformRow platforms={client.platforms} className="text-ink-3" />
            {client.bumpedAt && (
              <Tooltip className="relative z-10 ml-auto shrink-0" content={`Last bumped ${new Date(client.bumpedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}>
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <ChevronsUp size={13} className="text-accent" />
                  {timeAgo(client.bumpedAt)}
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <p className="relative mt-3.5 text-[14px] leading-relaxed text-ink-2 line-clamp-2 min-h-[2lh]">{client.summary}</p>

      <div className="relative z-10 mt-4 flex flex-wrap gap-1.5">
        {client.tags.slice(0, 4).map((t) => (
          <Link key={t} href={`/clients?tag=${encodeURIComponent(t)}`} className={`chip ${activeTags.includes(t) ? 'chip-active' : ''}`}>
            <span className="text-ink-3">#</span>
            {t}
          </Link>
        ))}
      </div>

      {/* One button, not two: a download starts with the Trust & Safety dialog on the listing's own page. */}
      <div className="relative z-10 mt-auto pt-5">
        <Link href={`/clients/${client.slug}`} className="btn btn-secondary btn-sm w-full group/view">
          View and download
          <Download size={14} className="transition-transform duration-200 group-hover/view:translate-y-0.5" />
        </Link>
      </div>
    </motion.article>
  );
}
