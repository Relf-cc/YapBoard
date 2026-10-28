// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { platformBase, readScopes, requireMemberPage, SCOPE_ORDER } from '@/lib/platform';
import { AppForm } from '@/components/platform/AppForm';
import { PageHead } from '@/components/portal/PageHead';

export const metadata: Metadata = { title: 'Register an app' };

export default async function NewApp() {
  const { member } = await requireMemberPage('/apps/new');
  const base = await platformBase();
  const live = await db.platformApp.count({ where: { ownerId: member.userId, status: { not: 'REVOKED' } } });

  return (
    <div className="max-w-5xl">
      <Link href={`${base}/apps`} className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft size={14} /> Your apps
      </Link>
      <PageHead title="Register an app" sub="One app per bot. The scopes you pick are the only calls its keys will answer." />

      {live >= member.appLimit ? (
        <div className="card max-w-2xl p-6 text-sm text-ink-2">
          You’ve registered {live} of {member.appLimit} apps. Retire one you’re no longer running, or ask staff to raise the limit - tell them which
          bot and what it’s for.
        </div>
      ) : (
        <AppForm base={base} allowed={readScopes(member.scopes)} scopeOrder={SCOPE_ORDER} />
      )}
    </div>
  );
}
