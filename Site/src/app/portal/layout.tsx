// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { portalBase, requirePortalUser } from '@/lib/portal';
import { PortalNav } from '@/components/portal/PortalNav';

export const metadata: Metadata = { title: { default: 'Portal', template: '%s · YapBoard Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, staff } = await requirePortalUser();
  if (!staff) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="card max-w-sm p-8 text-center">
          <ShieldAlert size={36} className="mx-auto text-accent" strokeWidth={1.8} />
          <h1 className="mt-4 text-xl font-extrabold">Staff only</h1>
          <p className="mt-2 text-sm text-ink-3">You’re logged in as @{user.username}, which isn’t a YapBoard staff account.</p>
          <Link href={env.siteUrl} className="btn btn-secondary mt-6">
            Back to YapBoard
          </Link>
        </div>
      </div>
    );
  }

  const base = await portalBase();
  const [abuse, removal] = await Promise.all([
    db.report.count({ where: { status: 'OPEN', kind: 'ABUSE' } }),
    db.report.count({ where: { status: 'OPEN', kind: 'REMOVAL' } }),
  ]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <PortalNav
        base={base}
        siteUrl={env.siteUrl}
        counts={{ abuse, removal }}
        user={{ id: user.id, name: user.displayName || user.username, role: user.role, avatarUrl: user.avatarUrl }}
      />
      <main className="min-w-0 px-4 sm:px-8 py-8">{children}</main>
    </div>
  );
}
