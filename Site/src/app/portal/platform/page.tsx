// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { compact, timeAgo } from '@/lib/format';
import { APP_STATUS, busiestApps, inviteOpen, platformLink, platformOutcomes, platformSeries, readScopes } from '@/lib/platform';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { isAdmin } from '@/lib/session';
import { Reveal } from '@/components/Reveal';
import { PageHead } from '@/components/portal/PageHead';
import { InviteActions, InviteComposer, MemberControls, PlatformAppActions } from '@/components/portal/PlatformAdmin';

export const metadata: Metadata = { title: 'Developer platform' };

/** Outcomes worth a second look on a staff page, with why. */
const WATCH: Record<string, string> = {
  wrong_server: 'bumping listings that aren\u2019t theirs',
  banned: 'banned accounts still bumping',
  http_429: 'over the rate limit',
  http_403: 'calling without the scope',
};

const TONE: Record<string, string> = {
  ACTIVE: 'text-ok bg-ok/10 border-ok/30',
  PAUSED: 'text-ink-2 bg-surface-2 border-line-strong',
  SUSPENDED: 'text-warn bg-warn/10 border-warn/30',
  REVOKED: 'text-danger bg-danger/10 border-danger/30',
};

/**
 * The staff side of platform.yapboard.dev: who's in the program, what they may call, and what their bots have
 * been calling. Three decisions live here - admit, set the ceiling, switch off - and nothing else.
 */
export default async function PortalPlatform() {
  const me = await requireStaffPage('/platform');
  const base = await portalBase();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 13);

  const [members, apps, invites, window, series, outcomes, busiest] = await Promise.all([
    db.platformMember.findMany({
      orderBy: { joinedAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, bannedAt: true } },
        invite: { select: { note: true, invitedBy: { select: { username: true } } } },
        _count: { select: { apps: true } },
      },
    }),
    db.platformApp.findMany({
      orderBy: [{ lastCallAt: 'desc' }, { createdAt: 'desc' }],
      take: 60,
      include: { owner: { select: { userId: true, status: true, user: { select: { username: true } } } }, _count: { select: { keys: { where: { revokedAt: null } } } } },
    }),
    db.platformInvite.findMany({ orderBy: { createdAt: 'desc' }, take: 30, include: { invitedBy: { select: { username: true } }, redeemedBy: { select: { username: true } } } }),
    db.platformUsage.aggregate({ where: { day: { gte: since } }, _sum: { calls: true, errors: true, refused: true } }),
    platformSeries(),
    platformOutcomes(),
    busiestApps(),
  ]);

  const open = invites.filter(inviteOpen).length;
  const peak = Math.max(1, ...series.map((d) => d.calls));
  const suspended = members.filter((m) => m.status !== 'ACTIVE').length;
  const tiles: [string, string, boolean?][] = [
    ['Members', String(members.length)],
    ['Suspended', String(suspended), suspended > 0],
    ['Active apps', String(apps.filter((a) => a.status === 'ACTIVE').length)],
    ['Calls, last 14 days', compact(window._sum.calls ?? 0)],
    ['Refused', compact(window._sum.refused ?? 0)],
    ['Errors', compact(window._sum.errors ?? 0), (window._sum.errors ?? 0) > 0],
    ['Open invites', String(open)],
  ];

  return (
    <div className="max-w-6xl">
      <PageHead title="Developer platform" sub="Invite-only: bot developers putting YapBoard’s commands in their own bots.">
        <a href={env.platformUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          Open the platform
        </a>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {tiles.map(([label, value, warn], i) => (
          <Reveal key={label} delay={i * 0.03} y={8}>
            <div className="card px-4 py-4">
              <div className="text-xs text-ink-3">{label}</div>
              <div className={clsx('mt-1.5 font-display text-[28px] font-extrabold leading-none tabular-nums', warn && 'text-warn')}>{value}</div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">The programme, last 14 days</h2>
            <span className="text-xs text-ink-3">{compact(series.reduce((n, d) => n + d.calls, 0))} calls</span>
          </div>
          <ol className="mt-5 flex h-24 items-end gap-1.5">
            {series.map((d) => {
              const served = Math.max(0, d.calls - d.refused - d.errors);
              const band = (n: number) => (d.calls ? `${Math.max(2, (n / peak) * 100)}%` : '2px');
              return (
                <li key={d.day} className="flex h-full flex-1 flex-col justify-end gap-0.5" title={`${d.day}: ${d.calls} calls, ${d.refused} refused, ${d.errors} errors`}>
                  {d.errors > 0 && <span className="block rounded-t-sm bg-warn" style={{ height: band(d.errors) }} />}
                  {d.refused > 0 && <span className="block bg-surface-3" style={{ height: band(d.refused) }} />}
                  <span className={clsx('block rounded-sm', served ? 'bg-accent' : 'bg-surface-2')} style={{ height: served ? band(served) : '2px' }} />
                </li>
              );
            })}
          </ol>
          <div className="mt-2 flex justify-between text-[11px] text-ink-3">
            <span>{series[0]?.day}</span>
            <span>served / refused / errors</span>
            <span>today</span>
          </div>
        </section>

        <section className="card overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-line px-5">
            <h2 className="font-bold">Outcomes</h2>
            <span className="text-xs text-ink-3">what the API answered</span>
          </header>
          {outcomes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">No calls in the window.</p>
          ) : (
            <ul className="divide-y divide-line">
              {outcomes.slice(0, 8).map((o) => (
                <li key={o.outcome} className="flex items-center gap-3 px-5 py-2.5">
                  <code className={clsx('flex-1 font-mono text-[13px]', WATCH[o.outcome] ? 'text-warn' : o.outcome === 'ok' ? 'text-ok' : 'text-ink-2')}>{o.outcome}</code>
                  {WATCH[o.outcome] && <span className="text-[11px] text-ink-3">{WATCH[o.outcome]}</span>}
                  <span className="text-sm font-semibold tabular-nums">{compact(o.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Who is actually using it, and how well. `wrong_server` is the column to read twice: an app that
          keeps trying to bump bots from servers they don't belong to is probing, not integrating. */}
      <section className="card mt-8 overflow-x-auto">
        <header className="flex h-14 items-center justify-between border-b border-line px-5">
          <h2 className="font-bold">Busiest apps</h2>
          <span className="text-xs text-ink-3">last 14 days</span>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="h-11 px-5 font-medium">App</th>
              <th className="px-3 font-medium">Developer</th>
              <th className="px-3 font-medium">Calls</th>
              <th className="px-3 font-medium">Refused</th>
              <th className="px-3 font-medium">Errors</th>
              <th className="px-3 font-medium">wrong_server</th>
              <th className="px-5 text-right font-medium">Avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {busiest.map((a) => (
              <tr key={a.appId} className="hover:bg-surface-2/60">
                <td className="px-5 py-3">
                  <a href={platformLink(`/apps/${a.appId}`)} target="_blank" rel="noreferrer" className="group inline-flex flex-col">
                    <span className="font-semibold group-hover:text-accent">{a.name}</span>
                    <span className="font-mono text-[11px] text-ink-3">{a.botId}</span>
                  </a>
                </td>
                <td className="px-3 py-3 text-ink-2">@{a.username}</td>
                <td className="px-3 py-3 font-semibold tabular-nums text-ink-2">{compact(a.calls)}</td>
                <td className="px-3 py-3 tabular-nums text-ink-3">
                  {compact(a.refused)}
                  {a.calls > 0 && <span className="ml-1 text-[11px]">{Math.round((a.refused / a.calls) * 100)}%</span>}
                </td>
                <td className={clsx('px-3 py-3 tabular-nums', a.errors ? 'font-semibold text-warn' : 'text-ink-3')}>{compact(a.errors)}</td>
                <td className={clsx('px-3 py-3 tabular-nums', a.wrongServer ? 'font-semibold text-warn' : 'text-ink-3')}>{compact(a.wrongServer)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink-3">{a.avgMs}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
        {busiest.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">Nobody has called the API in the window.</p>}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <InviteComposer canGrantScopes={isAdmin(me)} />

        <section className="card overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-line px-5">
            <h2 className="font-bold">Invites</h2>
            <span className="text-xs text-ink-3">{open} open</span>
          </header>
          {invites.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-3">None written yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                  <code className="font-mono text-[13px] text-ink-2">{i.code}</code>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-3">
                    {i.note || <span className="italic">no note</span>}
                    {i.forUserId && <span className="ml-1.5 font-mono text-[11px]">→ {i.forUserId}</span>}
                  </span>
                  <span className="text-[11px] text-ink-3">
                    {i.redeemedAt
                      ? `used by @${i.redeemedBy?.username ?? '?'} ${timeAgo(i.redeemedAt)}`
                      : i.revokedAt
                        ? 'withdrawn'
                        : i.expiresAt && i.expiresAt.getTime() < Date.now()
                          ? 'expired'
                          : `by @${i.invitedBy.username}, ${timeAgo(i.createdAt)}`}
                  </span>
                  <InviteActions id={i.id} redeemed={!!i.redeemedAt || !!i.revokedAt} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-8 overflow-x-auto">
        <header className="flex h-14 items-center border-b border-line px-5">
          <h2 className="font-bold">Members</h2>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="h-11 px-5 font-medium">Developer</th>
              <th className="px-3 font-medium">Apps</th>
              <th className="px-3 font-medium">Joined</th>
              <th className="px-3 font-medium">Invited by</th>
              <th className="px-5 text-right font-medium">Scopes and standing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.userId} className="hover:bg-surface-2/60">
                <td className="px-5 py-3">
                  <Link href={`${base}/users?q=${m.userId}`} className="group inline-flex flex-col">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold group-hover:text-accent">@{m.user.username}</span>
                      {m.status === 'SUSPENDED' && <span className="inline-flex h-5 items-center rounded-full border border-warn/30 bg-warn/10 px-2 text-[11px] font-semibold text-warn">Suspended</span>}
                      {m.user.bannedAt && <span className="inline-flex h-5 items-center rounded-full border border-danger/30 bg-danger/10 px-2 text-[11px] font-semibold text-danger">Banned</span>}
                    </span>
                    <span className="font-mono text-[11px] text-ink-3">{m.userId}</span>
                  </Link>
                  {m.statusNote && <p className="mt-1 max-w-sm text-[12px] text-warn">{m.statusNote}</p>}
                </td>
                <td className="px-3 py-3 tabular-nums text-ink-2">
                  {m._count.apps}/{m.appLimit}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-ink-3">{timeAgo(m.joinedAt)}</td>
                <td className="px-3 py-3 text-ink-3">{m.invite?.invitedBy.username ? `@${m.invite.invitedBy.username}` : '-'}</td>
                <td className="px-5 py-3">
                  <MemberControls userId={m.userId} status={m.status} scopes={readScopes(m.scopes)} appLimit={m.appLimit} isAdmin={isAdmin(me)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">Nobody has redeemed an invite yet.</p>}
      </section>

      <section className="card mt-8 overflow-x-auto">
        <header className="flex h-14 items-center border-b border-line px-5">
          <h2 className="font-bold">Apps</h2>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="h-11 px-5 font-medium">App</th>
              <th className="px-3 font-medium">Developer</th>
              <th className="px-3 font-medium">Scopes</th>
              <th className="px-3 font-medium">Keys</th>
              <th className="px-3 font-medium">Calls</th>
              <th className="px-3 font-medium">Errors</th>
              <th className="px-3 font-medium">Last call</th>
              <th className="px-5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {apps.map((a) => (
              <tr key={a.id} className="hover:bg-surface-2/60">
                <td className="px-5 py-3">
                  <a href={platformLink(`/apps/${a.id}`)} target="_blank" rel="noreferrer" className="group inline-flex flex-col">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold group-hover:text-accent">{a.name}</span>
                      <span className={clsx('inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold', TONE[a.status] ?? TONE.PAUSED)}>{APP_STATUS[a.status]}</span>
                    </span>
                    <span className="font-mono text-[11px] text-ink-3">{a.botId}</span>
                  </a>
                  {a.summary && <p className="mt-1 max-w-sm text-[12px] text-ink-3">{a.summary}</p>}
                </td>
                <td className="px-3 py-3 text-ink-2">@{a.owner.user.username}</td>
                <td className="px-3 py-3 text-[12px] text-ink-3">{readScopes(a.scopes).join(', ') || '-'}</td>
                <td className="px-3 py-3 tabular-nums text-ink-2">{a._count.keys}</td>
                <td className="px-3 py-3 tabular-nums text-ink-2">{compact(a.calls)}</td>
                <td className={clsx('px-3 py-3 tabular-nums', a.errors ? 'font-semibold text-warn' : 'text-ink-3')}>{compact(a.errors)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-ink-3">{a.lastCallAt ? timeAgo(a.lastCallAt) : 'never'}</td>
                <td className="px-5 py-3 text-right">
                  <PlatformAppActions appId={a.id} status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {apps.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">No apps registered yet.</p>}
      </section>
    </div>
  );
}
