'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, ChevronDown, LayoutGrid, LogOut, Menu, Plus, Shield, X } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { Avatar } from './Avatar';

type NavUser = { id: string; name: string; username: string; avatarUrl: string | null } | null;

const LINKS = [
  { href: '/servers', label: 'Servers' },
  { href: '/bots', label: 'Bots' },
  { href: '/tags', label: 'Tags' },
  { href: '/bot', label: 'Bot' },
];

export function NavShell({ user, staff }: { user: NavUser; staff: boolean }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const home = path === '/';

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setMobile(false), [path]);

  return (
    <header className={clsx('sticky top-0 z-40 transition-[background-color,border-color] duration-300 border-b', scrolled || mobile ? 'bg-bg/85 backdrop-blur-md border-line' : 'bg-bg border-transparent')}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => {
            // '/bot' is a prefix of '/bots', so that one only lights up on its own page.
            const on = l.href === '/bot' ? path === '/bot' : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={clsx('relative px-3 py-2 text-sm font-medium rounded-lg transition-colors', on ? 'text-ink' : 'text-ink-2 hover:text-ink')}>
                {on && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={clsx('hidden lg:block flex-1 max-w-md transition-opacity duration-300', home && !scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
          <SearchBar shortcut={!home} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/add" className="btn btn-primary btn-sm hidden sm:inline-flex">
                <Plus size={15} strokeWidth={2.6} />
                Add server
              </Link>
              <UserMenu user={user} staff={staff} />
            </>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn btn-primary btn-sm">
              Log in
            </Link>
          )}
          <button className="md:hidden btn btn-ghost btn-sm px-2" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile((m) => !m)}>
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden border-t border-line"
          >
            <div className="px-4 py-4 space-y-3">
              <SearchBar />
              <div className="grid gap-1">
                {LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="px-3 py-2.5 rounded-lg text-[15px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
                    {l.label}
                  </Link>
                ))}
                {user && (
                  <>
                    <Link href="/add" className="px-3 py-2.5 rounded-lg text-[15px] font-medium text-accent hover:bg-surface-2">
                      Add server
                    </Link>
                    <Link href="/bots/add" className="px-3 py-2.5 rounded-lg text-[15px] font-medium text-accent hover:bg-surface-2">
                      List a bot
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function UserMenu({ user, staff }: { user: NonNullable<NavUser>; staff: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-full hover:bg-surface-2 transition-colors">
        <Avatar src={user.avatarUrl} name={user.name} id={user.id} size={28} round />
        <ChevronDown size={15} className={clsx('text-ink-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-line-strong bg-surface p-1.5 shadow-[0_16px_40px_-12px_#000c]"
          >
            <div className="px-3 py-2.5 border-b border-line mb-1">
              <div className="font-semibold text-sm truncate">{user.name}</div>
              <div className="text-xs text-ink-3 truncate">@{user.username}</div>
            </div>
            <MenuLink href="/dashboard" icon={<LayoutGrid size={15} />}>
              Your servers
            </MenuLink>
            <MenuLink href="/add" icon={<Plus size={15} />}>
              Add a server
            </MenuLink>
            <MenuLink href="/bots/add" icon={<Bot size={15} />}>
              List a bot
            </MenuLink>
            {staff && (
              <MenuLink href="/portal" icon={<Shield size={15} />}>
                Staff portal
              </MenuLink>
            )}
            <form action="/api/auth/logout" method="post" className="mt-1 pt-1 border-t border-line">
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors">
                <LogOut size={15} className="text-ink-3" />
                Log out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors">
      <span className="text-ink-3">{icon}</span>
      {children}
    </Link>
  );
}
