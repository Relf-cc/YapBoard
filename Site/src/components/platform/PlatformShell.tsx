// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { SessionUser } from '@/lib/session';
import type { Member } from '@/lib/platform';
import { Logo } from '../Logo';
import { PlatformNav } from './PlatformNav';

/**
 * The platform's chrome, shared by both of its layouts.
 *
 * A member gets the portal's frame: sidebar, nav, the licence note at the foot. Someone who isn't in the
 * programme gets a plain header instead — they can still read the terms (that's the point: you shouldn't
 * have to accept an agreement to find out what it says), but there's nothing to navigate.
 */
export function PlatformShell({
  user,
  member,
  base,
  siteUrl,
  children,
}: {
  user: SessionUser;
  member: Member | null;
  base: string;
  siteUrl: string;
  children: React.ReactNode;
}) {
  const footer = (
    <p className="mt-12 text-xs text-ink-3">
      © {new Date().getFullYear()} Christian Relf. All rights reserved. The YapBoard platform API is licensed to programme members for use in their
      own bots - not for resale, and not for running a service like YapBoard.
    </p>
  );

  if (!member) {
    return (
      <div className="min-h-dvh">
        <header className="border-b border-line bg-raised">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
            <Logo href={base || '/'} suffix="Platform" />
            <Link href={base || '/'} className="btn btn-secondary btn-sm">
              Have an invite?
            </Link>
          </div>
        </header>
        <main className="px-4 pb-16 sm:px-6">
          {children}
          <div className="mx-auto max-w-3xl">{footer}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <PlatformNav
        base={base}
        siteUrl={siteUrl}
        counts={{ apps: member._count.apps, limit: member.appLimit }}
        user={{ id: user.id, name: user.displayName || user.username, avatarUrl: user.avatarUrl }}
      />
      <main className="min-w-0 px-4 py-8 sm:px-8">
        {children}
        {footer}
      </main>
    </div>
  );
}
