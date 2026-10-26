'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowBigUp, ArrowUpRight, Bot, Flag, Gauge, Megaphone, Radio, ScrollText, Server, Trash, Users } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from '../Logo';
import { Avatar } from '../Avatar';

type Props = {
  base: string;
  siteUrl: string;
  counts: { abuse: number; removal: number };
  user: { id: string; name: string; role: string; avatarUrl: string | null };
};

export function PortalNav({ base, siteUrl, counts, user }: Props) {
  const path = usePathname();
  // usePathname gives the rewritten path on the subdomain too, so compare without the /portal prefix.
  const here = path.replace(/^\/portal/, '') || '/';
  const items = [
    { href: '/', label: 'Overview', icon: Gauge },
    { href: '/reports?kind=ABUSE', match: '/reports', kindMatch: 'ABUSE', label: 'Abuse reports', icon: Flag, count: counts.abuse },
    { href: '/reports?kind=REMOVAL', match: '/reports', kindMatch: 'REMOVAL', label: 'Removal requests', icon: Trash, count: counts.removal },
    { href: '/servers', label: 'Servers', icon: Server },
    { href: '/bots', label: 'Bots', icon: Bot },
    { href: '/users', label: 'Users', icon: Users },
    { href: '/voting', label: 'Voting', icon: ArrowBigUp },
    { href: '/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/broadcasts', label: 'Broadcasts', icon: Radio },
    { href: '/audit', label: 'Audit log', icon: ScrollText },
  ];
  const kind = useSearchParams().get('kind');

  const isOn = (it: (typeof items)[number]) => {
    if (it.match) return here.startsWith(it.match) && (kind ?? 'ABUSE') === it.kindMatch;
    return it.href === '/' ? here === '/' : here.startsWith(it.href);
  };

  return (
    <aside className="lg:sticky lg:top-0 lg:h-dvh border-b lg:border-b-0 lg:border-r border-line bg-raised flex flex-col">
      <div className="px-5 h-16 flex items-center">
        <Logo href={base || '/'} suffix="Portal" />
      </div>
      <nav className="px-3 pb-3 lg:pb-0 flex lg:flex-col gap-0.5 overflow-x-auto">
        {items.map((it) => {
          const on = isOn(it);
          const Icon = it.icon;
          return (
            <Link
              key={it.label}
              href={`${base}${it.href === '/' ? '' : it.href}` || '/'}
              className={clsx('relative flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', on ? 'text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface')}
            >
              {on && <motion.span layoutId="portal-nav" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <Icon size={16} className={clsx('relative', on ? 'text-accent' : 'text-ink-3')} />
              <span className="relative flex-1">{it.label}</span>
              {!!it.count && <span className="relative min-w-5 h-5 px-1.5 rounded-full bg-accent text-on-accent text-[11px] font-bold inline-flex items-center justify-center tabular-nums">{it.count}</span>}
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
            <div className="text-[11px] uppercase tracking-wider text-ink-3">{user.role.toLowerCase()}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
