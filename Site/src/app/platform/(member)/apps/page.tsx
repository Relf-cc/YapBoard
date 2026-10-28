// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Plus } from 'lucide-react';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { compact, timeAgo } from '@/lib/format';
import { APP_STATUS, platformBase, readScopes, requireMemberPage, SCOPES } from '@/lib/platform';
import { PageHead } from '@/components/portal/PageHead';

export const metadata: Metadata = { title: 'Your apps' };

const TONE: Record<string, string> = {
  ACTIVE: 'text-ok bg-ok/10 border-ok/30',
  PAUSED: 'text-ink-2 bg-surface-2 border-line-strong',
  SUSPENDED: 'text-warn bg-warn/10 border-warn/30',
  REVOKED: 'text-danger bg-danger/10 border-danger/30',
};

export default async function PlatformApps() {
  const { member } = await requireMemberPage('/apps');
  const base = await platformBase();
  const apps = await db.platformApp.findMany({
    where: { ownerId: member.userId },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      botId: true,
      name: true,
      summary: true,
      status: true,
      statusNote: true,
      scopes: true,
      calls: true,
      errors: true,
      lastCallAt: true,
      _count: { select: { keys: { where: { revokedAt: null } } } },
    },
  });
  const live = apps.filter((a) => a.status !== 'REVOKED').length;
  const full = live >= member.appLimit;

  return (
    <div className="max-w-5xl">
      <PageHead title="Your apps" sub={`${live} of ${member.appLimit} registered. One app is one bot.`}>
        {full ? (
          <span className="text-sm text-ink-3">App limit reached - ask staff to raise it.</span>
        ) : (
          <Link href={`${base}/apps/new`} className="btn btn-primary btn-sm">
            <Plus size={15} /> Register an app
          </Link>
        )}
      </PageHead>

      {apps.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <p className="text-sm text-ink-3">Nothing registered yet.</p>
          <Link href={`${base}/apps/new`} className="btn btn-primary btn-sm mt-4">
            <Plus size={14} /> Register your bot
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {apps.map((a) => (
            <li key={a.id}>
              <Link href={`${base}/apps/${a.id}`} className="card block p-5 transition-colors hover:border-line-strong">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-[17px] font-bold">{a.name}</h2>
                      <span className={clsx('inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold', TONE[a.status] ?? TONE.PAUSED)}>{APP_STATUS[a.status]}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[12px] text-ink-3">{a.botId}</p>
                    {a.summary && <p className="mt-2 max-w-xl text-sm text-ink-2">{a.summary}</p>}
                    {a.statusNote && a.status !== 'ACTIVE' && <p className="mt-2 max-w-xl text-[13px] text-warn">{a.statusNote}</p>}
                  </div>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-ink-3" />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-3">
                  <span>
                    <b className="tabular-nums text-ink-2">{a._count.keys}</b> live key{a._count.keys === 1 ? '' : 's'}
                  </span>
                  <span>
                    <b className="tabular-nums text-ink-2">{compact(a.calls)}</b> calls
                  </span>
                  <span className={a.errors ? 'text-warn' : undefined}>
                    <b className="tabular-nums">{compact(a.errors)}</b> errors
                  </span>
                  <span>last call {a.lastCallAt ? timeAgo(a.lastCallAt) : 'never'}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {readScopes(a.scopes).map((s) => (
                      <span key={s} className="chip h-6 text-[11.5px]">
                        {SCOPES[s].command}
                      </span>
                    ))}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
