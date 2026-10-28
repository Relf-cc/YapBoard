// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import { ArrowRight, Ban, BookOpen, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { compact, timeAgo } from '@/lib/format';
import { APP_STATUS, apiRoot, platformBase, readScopes, requireMemberPage, SCOPES } from '@/lib/platform';
import { Reveal } from '@/components/Reveal';
import { PageHead } from '@/components/portal/PageHead';

export default async function PlatformOverview() {
  const { member } = await requireMemberPage();
  const base = await platformBase();
  const since = new Date(Date.now() - 13 * 864e5);
  since.setUTCHours(0, 0, 0, 0);

  const [apps, liveKeys, window] = await Promise.all([
    db.platformApp.findMany({
      where: { ownerId: member.userId, status: { not: 'REVOKED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, botId: true, name: true, status: true, scopes: true, calls: true, lastCallAt: true, _count: { select: { keys: { where: { revokedAt: null } } } } },
    }),
    db.platformKey.count({ where: { revokedAt: null, app: { ownerId: member.userId, status: { not: 'REVOKED' } } } }),
    db.platformUsage.aggregate({ where: { app: { ownerId: member.userId }, day: { gte: since } }, _sum: { calls: true, errors: true } }),
  ]);

  const allowed = readScopes(member.scopes);
  const calls = window._sum.calls ?? 0;
  const errors = window._sum.errors ?? 0;
  const tiles: [string, string, string?][] = [
    ['Apps', `${apps.length}/${member.appLimit}`, `${base}/apps`],
    ['Live keys', String(liveKeys)],
    ['Calls, last 14 days', compact(calls)],
    ['Errors, last 14 days', compact(errors)],
    ['Scopes allowed', `${allowed.length}/${Object.keys(SCOPES).length}`],
  ];

  return (
    <div className="max-w-6xl">
      <PageHead title="Overview" sub="Your apps, your keys, and what they’ve been calling.">
        <Link href={`${base}/apps/new`} className="btn btn-primary btn-sm">
          <Plus size={15} /> Register an app
        </Link>
      </PageHead>

      {member.status !== 'ACTIVE' && (
        <div className="card mb-6 flex items-start gap-3 border-danger/30 bg-danger/5 p-4">
          <Ban size={18} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-sm">
            <b>Your developer account is suspended.</b> Every key is refused while it is.
            {member.statusNote && <span className="block mt-1 text-ink-2">{member.statusNote}</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map(([label, value, href], i) => {
          const body = (
            <>
              <div className="text-xs text-ink-3">{label}</div>
              <div className={`mt-1.5 font-display text-[28px] font-extrabold leading-none tabular-nums ${label.startsWith('Errors') && errors > 0 ? 'text-warn' : ''}`}>{value}</div>
            </>
          );
          return (
            <Reveal key={label} delay={i * 0.03} y={8}>
              {href ? (
                <Link href={href} className="card block px-4 py-4 transition-colors hover:border-line-strong">
                  {body}
                </Link>
              ) : (
                <div className="card px-4 py-4">{body}</div>
              )}
            </Reveal>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-line px-5">
            <h2 className="font-bold">Your apps</h2>
            <Link href={`${base}/apps`} className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
              All apps <ArrowRight size={14} />
            </Link>
          </header>
          {apps.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-ink-3">No apps yet. One app is one bot.</p>
              <Link href={`${base}/apps/new`} className="btn btn-secondary btn-sm mt-4">
                <Plus size={14} /> Register your first
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {apps.map((a) => (
                <li key={a.id}>
                  <Link href={`${base}/apps/${a.id}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{a.name}</span>
                        {a.status !== 'ACTIVE' && (
                          <span className="inline-flex h-5 items-center rounded-full border border-line-strong bg-surface-2 px-2 text-[11px] font-semibold text-ink-2">{APP_STATUS[a.status]}</span>
                        )}
                      </div>
                      <div className="truncate text-[13px] text-ink-3">
                        <span className="font-mono text-xs">{a.botId}</span> · {readScopes(a.scopes).length || 'no'} scopes · {a._count.keys} live key
                        {a._count.keys === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-ink-3">{a.lastCallAt ? timeAgo(a.lastCallAt) : 'never called'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-line px-5">
            <h2 className="font-bold">What you may call</h2>
            <Link href={`${base}/docs`} className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
              Docs <BookOpen size={14} />
            </Link>
          </header>
          <ul className="divide-y divide-line">
            {(Object.keys(SCOPES) as (keyof typeof SCOPES)[]).map((key) => {
              const on = allowed.includes(key);
              return (
                <li key={key} className="flex items-start gap-3 px-5 py-3.5">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${on ? 'bg-ok' : 'bg-surface-3'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {SCOPES[key].label} <code className="ml-1 font-mono text-[11px] text-ink-3">{key}</code>
                    </div>
                    <p className="text-[13px] leading-snug text-ink-3">{on ? SCOPES[key].blurb : 'Not on your account - ask staff if you need it.'}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-5 py-3.5 text-[13px] text-ink-3">
            Invited by <b className="text-ink-2">@{member.invite?.invitedBy.username ?? 'staff'}</b>, {timeAgo(member.joinedAt)}.
          </div>
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Three steps</h2>
        <ol className="mt-3 grid gap-4 text-sm text-ink-2 md:grid-cols-3">
          <li>
            <b className="text-ink">1. Register your bot</b>
            <p className="mt-1 leading-relaxed text-ink-3">Its Yapin’ bot ID, and the scopes you need. One app per bot.</p>
          </li>
          <li>
            <b className="text-ink">2. Mint a key</b>
            <p className="mt-1 leading-relaxed text-ink-3">Shown once. Keep it on your server, never in the client or a repo.</p>
          </li>
          <li>
            <b className="text-ink">3. Call the API</b>
            <p className="mt-1 leading-relaxed text-ink-3">
              <code className="font-mono text-[12px] text-ink-2">{apiRoot()}</code>, with your key as a bearer token.
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}
