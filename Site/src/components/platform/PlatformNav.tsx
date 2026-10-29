'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowUpRight, BookOpen, Boxes, Gauge, Scale, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from '../Logo';
import { Avatar } from '../Avatar';

/** The portal's sidebar, for the developer platform: same frame, same sliding highlight, its own five links. */
type Props = {
  base: string;
  siteUrl: string;
  counts: { apps: number; limit: number };
  user: { id: string; name: string; avatarUrl: string | null };
};

export function PlatformNav({ base, siteUrl, counts, user }: Props) {
  const path = usePathname();
  // usePathname gives the rewritten path on the subdomain too, so compare without the /platform prefix.
  const here = path.replace(/^\/platform/, '') || '/';
  const items = [
    { href: '/', label: 'Overview', icon: Gauge },
    { href: '/apps', label: 'Your apps', icon: Boxes, count: counts.apps },
    { href: '/docs', label: 'Commands & API', icon: BookOpen },
    { href: '/requirements', label: 'Requirements & code', icon: ShieldCheck },
    { href: '/program', label: 'Platform terms', icon: Scale },
  ];

  const isOn = (href: string) => (href === '/' ? here === '/' : here.startsWith(href));

  return (
    <aside className="lg:sticky lg:top-0 lg:h-dvh border-b lg:border-b-0 lg:border-r border-line bg-raised flex flex-col">
      <div className="px-5 h-16 flex items-center">
        <Logo href={base || '/'} suffix="Platform" />
      </div>
      <nav className="px-3 pb-3 lg:pb-0 flex lg:flex-col gap-0.5 overflow-x-auto">
        {items.map((it) => {
          const on = isOn(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.label}
              href={`${base}${it.href === '/' ? '' : it.href}` || '/'}
              className={clsx('relative flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', on ? 'text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface')}
            >
              {on && <motion.span layoutId="platform-nav" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <Icon size={16} className={clsx('relative', on ? 'text-accent' : 'text-ink-3')} />
              <span className="relative flex-1">{it.label}</span>
              {it.count !== undefined && (
                <span className="relative text-[11px] font-semibold tabular-nums text-ink-3">
                  {it.count}/{counts.limit}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden lg:block p-3 border-t border-line">
        <a href={siteUrl} className="flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-ink-3 hover:text-ink hover:bg-surface transition-colors">
          Open YapBoard <ArrowUpRight size={14} />
        </a>
        <div className="mt-2 flex items-center gap-3 px-3 py-2">
          <Avatar src={user.avatarUrl} name={user.name} id={user.id} size={30} round />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-ink-3">developer</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
