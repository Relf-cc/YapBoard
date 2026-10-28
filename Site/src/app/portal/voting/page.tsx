// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { isAdmin } from '@/lib/session';
import { getVotingConfig } from '@/lib/votes';
import { Avatar } from '@/components/Avatar';
import { PageHead } from '@/components/portal/PageHead';
import { VoteTargetButtons, VotingSettings, VotingSwitch } from '@/components/portal/VotingControls';

export const metadata: Metadata = { title: 'Voting' };

const DAY = 24 * 60 * 60_000;
const TOP = 15;

type Row = { id: string; total: number; counted: number; networks: number; revoked: number };

/** Votes in the last 24 hours, grouped by server or by voter, busiest first, with what's needed to judge them. */
async function busiest(by: 'serverId' | 'userId', since: Date): Promise<Row[]> {
  const top = await db.vote.groupBy({ by: [by], where: { createdAt: { gt: since } }, _count: { _all: true }, orderBy: { _count: { [by]: 'desc' } }, take: TOP });
  const ids = top.map((t) => t[by] as string);
  if (!ids.length) return [];
  const [counted, nets, revoked] = await Promise.all([
    db.vote.groupBy({ by: [by], where: { [by]: { in: ids }, createdAt: { gt: since }, revokedAt: null }, _count: { _all: true } }),
    db.vote.groupBy({ by: [by, 'ipHash'], where: { [by]: { in: ids }, createdAt: { gt: since } } }),
    db.vote.groupBy({ by: [by], where: { [by]: { in: ids }, revokedFor: by === 'serverId' ? 'server' : 'user' }, _count: { _all: true } }),
  ]);
  const n = (rows: { _count: { _all: number } }[], id: string) => (rows as Record<string, unknown>[]).find((r) => r[by] === id)?._count as { _all: number } | undefined;
  return top.map((t) => {
    const id = t[by] as string;
    return {
      id,
      total: t._count._all,
      counted: n(counted, id)?._all ?? 0,
      networks: nets.filter((r) => r[by] === id).length,
      revoked: n(revoked, id)?._all ?? 0,
    };
  });
}

/** Servers or users with revoked votes that aren't in the busiest lists any more, so they can still be restored. */
async function revokedOnly(kind: 'server' | 'user', skip: string[]) {
  const by = kind === 'server' ? 'serverId' : 'userId';
  const rows = await db.vote.groupBy({ by: [by], where: { revokedFor: kind, [by]: { notIn: skip } }, _count: { _all: true }, orderBy: { _count: { [by]: 'desc' } }, take: TOP });
  return rows.map((r) => ({ id: r[by] as string, total: 0, counted: 0, networks: 0, revoked: r._count._all }));
}

export default async function PortalVoting() {
  const me = await requireStaffPage('/voting');
  const base = await portalBase();
  const cfg = await getVotingConfig();
  const since = new Date(Date.now() - DAY);

  const [servers, voters, today, revokedToday, off] = await Promise.all([
    busiest('serverId', since),
    busiest('userId', since),
    db.vote.count({ where: { createdAt: { gt: since } } }),
    db.vote.count({ where: { createdAt: { gt: since }, revokedAt: { not: null } } }),
    db.server.findMany({ where: { votingOff: true }, select: { id: true }, take: 50 }),
  ]);
  const [revokedServers, revokedUsers] = await Promise.all([
    revokedOnly('server', servers.map((s) => s.id)),
    revokedOnly('user', voters.map((v) => v.id)),
  ]);
  const serverRows = [...servers, ...revokedServers, ...off.filter((o) => !servers.some((s) => s.id === o.id) && !revokedServers.some((s) => s.id === o.id)).map((o) => ({ id: o.id, total: 0, counted: 0, networks: 0, revoked: 0 }))];
  const userRows = [...voters, ...revokedUsers];

  const [serverInfo, userInfo, countedNow] = await Promise.all([
    db.server.findMany({ where: { id: { in: serverRows.map((r) => r.id) } }, select: { id: true, name: true, iconUrl: true, votingOff: true } }),
    db.user.findMany({ where: { id: { in: userRows.map((r) => r.id) } }, select: { id: true, username: true, displayName: true, avatarUrl: true, bannedAt: true } }),
    // Counted votes overall (any age), for the Revoke button.
    db.vote.groupBy({ by: ['serverId'], where: { serverId: { in: serverRows.map((r) => r.id) }, revokedAt: null }, _count: { _all: true } }),
  ]);
  const countedByUser = await db.vote.groupBy({ by: ['userId'], where: { userId: { in: userRows.map((r) => r.id) }, revokedAt: null }, _count: { _all: true } });

  return (
    <div className="max-w-6xl space-y-10">
      <PageHead title="Voting" sub="People vote for servers; each vote nudges a server up “recently bumped”, far less than a bump.">
        <VotingSwitch enabled={cfg.enabled} />
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Voting" value={!cfg.enabled ? 'Paused' : cfg.affectsRanking ? 'On' : 'On, not ranking'} tone={!cfg.enabled ? 'danger' : cfg.affectsRanking ? 'ok' : 'warn'} />
        <Stat label="Votes, last 24h" value={today.toLocaleString()} />
        <Stat label="Revoked, last 24h" value={revokedToday.toLocaleString()} tone={revokedToday ? 'warn' : undefined} />
      </div>

      <section>
        <h2 className="mb-3 font-bold">Settings</h2>
        <VotingSettings initial={cfg} canEdit={isAdmin(me)} />
      </section>

      <section>
        <h2 className="font-bold">Servers</h2>
        <p className="mb-3 text-sm text-ink-3">Most voted in the last 24 hours. Lots of votes from few networks is the usual sign of alt accounts.</p>
        <Table head={['Server', '24h', 'Networks', '']} empty="No votes in the last 24 hours.">
          {serverRows.map((r) => {
            const s = serverInfo.find((x) => x.id === r.id);
            const counted = countedNow.find((c) => c.serverId === r.id)?._count._all ?? 0;
            return (
              <tr key={r.id}>
                <td className="px-5 py-3">
                  <Link href={`${env.siteUrl}/view/${r.id}`} target="_blank" className="flex items-center gap-3 hover:text-accent">
                    <Avatar src={s?.iconUrl} name={s?.name ?? r.id} id={r.id} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s?.name ?? 'Deleted server'}</span>
                      <span className="font-mono text-[11px] text-ink-3">{r.id}</span>
                    </span>
                    {s?.votingOff && <span className="text-[10px] font-bold uppercase tracking-wider text-warn">voting off</span>}
                  </Link>
                </td>
                <Counts r={r} />
                <td className="px-5 py-3 text-right">{s && <VoteTargetButtons kind="server" id={r.id} counted={counted} revoked={r.revoked} votingOff={s.votingOff} />}</td>
              </tr>
            );
          })}
        </Table>
      </section>

      <section>
        <h2 className="font-bold">Voters</h2>
        <p className="mb-3 text-sm text-ink-3">Busiest voters in the last 24 hours. Banned users’ votes stop counting on their own.</p>
        <Table head={['User', '24h', 'Networks', '']} empty="No votes in the last 24 hours.">
          {userRows.map((r) => {
            const u = userInfo.find((x) => x.id === r.id);
            const counted = countedByUser.find((c) => c.userId === r.id)?._count._all ?? 0;
            return (
              <tr key={r.id}>
                <td className="px-5 py-3">
                  <Link href={`${base}/users?q=${encodeURIComponent(r.id)}`} className="flex items-center gap-3 hover:text-accent">
                    <Avatar src={u?.avatarUrl} name={u?.displayName || u?.username || r.id} id={r.id} size={30} round />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">@{u?.username ?? 'unknown'}</span>
                      <span className="font-mono text-[11px] text-ink-3">{r.id}</span>
                    </span>
                    {u?.bannedAt && <span className="text-[10px] font-bold uppercase tracking-wider text-danger">banned</span>}
                  </Link>
                </td>
                <Counts r={r} />
                <td className="px-5 py-3 text-right">
                  <VoteTargetButtons kind="user" id={r.id} counted={counted} revoked={r.revoked} />
                </td>
              </tr>
            );
          })}
        </Table>
      </section>
    </div>
  );
}

function Counts({ r }: { r: Row }) {
  return (
    <>
      <td className="px-3 py-3 tabular-nums">
        {r.counted.toLocaleString()}
        {r.total > r.counted && <span className="text-xs text-ink-3"> / {r.total} ({r.total - r.counted} not counted)</span>}
      </td>
      <td className={clsx('px-3 py-3 tabular-nums', r.total >= 5 && r.networks <= r.total / 4 ? 'font-semibold text-warn' : 'text-ink-2')}>{r.total ? r.networks : '-'}</td>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={clsx('mt-1 font-display text-2xl font-bold', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')}>{value}</div>
    </div>
  );
}

function Table({ head, empty, children }: { head: string[]; empty: string; children: React.ReactNode[] }) {
  if (!children.length) return <div className="card px-5 py-8 text-center text-sm text-ink-3">{empty}</div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs text-ink-3">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={clsx('py-2.5 font-medium', i === 0 ? 'px-5' : 'px-3')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
