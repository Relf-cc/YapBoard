'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight, ChevronsUp, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { compact, timeAgo } from '@/lib/format';
import { languageName } from '@/lib/languages';
import type { ServerCard as Card } from '@/lib/servers';

export const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export function ServerCard({ server, activeTags = [] }: { server: Card; activeTags?: string[] }) {
  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group relative flex flex-col card p-5 overflow-hidden hover:border-line-strong transition-colors"
    >
      <span
        aria-hidden
        className="absolute left-0 top-5 h-10 w-[3px] rounded-r-full origin-center scale-y-0 group-hover:scale-y-100 transition-transform duration-300 ease-out-soft"
        style={{ background: server.accent }}
      />
      <div className="flex items-start gap-3.5">
        <Avatar src={server.iconUrl} name={server.name} id={server.id} size={52} className="transition-transform duration-300 ease-out-soft group-hover:-rotate-3" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[16.5px] font-bold leading-tight truncate">
            <Link href={`/view/${server.id}`} className="after:absolute after:inset-0 after:content-['']">
              {server.name}
            </Link>
          </h3>
          <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Users size={13} strokeWidth={2.2} />
              <span className="tabular-nums text-ink-2 font-medium">{compact(server.memberCount)}</span>
            </span>
            <span>{languageName(server.language)}</span>
            {server.nsfw && <span className="rounded px-1 text-[10.5px] font-bold text-danger border border-danger/40">18+</span>}
          </div>
        </div>
        {server.bumpedAt && (
          <span className="inline-flex items-center gap-0.5 text-[11.5px] text-ink-3 tabular-nums" title="Last bumped">
            <ChevronsUp size={13} className="text-accent" />
            {timeAgo(server.bumpedAt)}
          </span>
        )}
      </div>

      <p className="mt-3.5 text-[14px] leading-relaxed text-ink-2 line-clamp-2 min-h-[2lh]">{server.summary}</p>

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
