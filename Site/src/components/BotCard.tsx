'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight, ChevronsUp, Server, Terminal } from 'lucide-react';
import { Avatar } from './Avatar';
import { BadgeRow } from './Badge';
import { NsfwMark } from './NsfwMark';
import { Tooltip } from './Tooltip';
import { compact, timeAgo } from '@/lib/format';
import type { BotCard as Card } from '@/lib/bots';

/** The server card's twin, for the bot board: servers instead of members, and a prefix instead of a language. */
export function BotCard({ bot, activeTags = [] }: { bot: Card; activeTags?: string[] }) {
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group relative flex w-full flex-col card p-5 overflow-hidden hover:border-line-strong transition-colors"
    >
      <span
        aria-hidden
        className="absolute left-0 top-5 h-10 w-[3px] rounded-r-full origin-center scale-y-0 group-hover:scale-y-100 transition-transform duration-300 ease-out-soft"
        style={{ background: bot.accent }}
      />
      <div className="flex items-start gap-3.5">
        <Avatar src={bot.avatarUrl} name={bot.name} id={bot.id} size={52} round className="transition-transform duration-300 ease-out-soft group-hover:-rotate-3" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-display text-[16.5px] font-bold leading-tight">
            <Link href={`/bots/${bot.id}`} className="truncate after:absolute after:inset-0 after:content-['']">
              {bot.name}
            </Link>
            <BadgeRow kinds={bot.badges} seed={bot.id} size={17} max={3} />
            {bot.nsfw && <NsfwMark />}
          </h3>
          <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Server size={13} strokeWidth={2.2} />
              <span className="tabular-nums text-ink-2 font-medium">{compact(bot.serverCount)}</span>
            </span>
            {bot.prefix && (
              <span className="inline-flex items-center gap-1 truncate">
                <Terminal size={13} strokeWidth={2.2} />
                <code className="font-mono text-ink-2">{bot.prefix}</code>
              </span>
            )}
            {bot.bumpedAt && (
              <Tooltip className="relative z-10 ml-auto shrink-0" content={`Last bumped ${new Date(bot.bumpedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}>
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <ChevronsUp size={13} className="text-accent" />
                  {timeAgo(bot.bumpedAt)}
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3.5 text-[14px] leading-relaxed text-ink-2 line-clamp-2 min-h-[2lh]">{bot.summary}</p>

      <div className="relative z-10 mt-4 flex flex-wrap gap-1.5">
        {bot.tags.slice(0, 4).map((t) => (
          <Link key={t} href={`/bots?tag=${encodeURIComponent(t)}`} className={`chip ${activeTags.includes(t) ? 'chip-active' : ''}`}>
            <span className="text-ink-3">#</span>
            {t}
          </Link>
        ))}
      </div>

      <div className="relative z-10 mt-auto pt-5 flex items-center gap-2">
        <Link href={`/bots/${bot.id}`} className="btn btn-secondary btn-sm flex-1">
          View
        </Link>
        <a href={`/add-bot/${bot.id}`} className="btn btn-primary btn-sm flex-1 group/add">
          Add
          <ArrowUpRight size={15} className="transition-transform duration-200 group-hover/add:translate-x-0.5 group-hover/add:-translate-y-0.5" />
        </a>
      </div>
    </motion.article>
  );
}
