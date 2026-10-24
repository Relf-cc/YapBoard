import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { timeAgo } from '@/lib/format';
import { reasonLabel } from '@/lib/reports';
import { Avatar } from '@/components/Avatar';
import { Reveal } from '@/components/Reveal';
import { PageHead } from '@/components/portal/PageHead';
import { auditLabel } from '@/components/portal/audit';

export default async function Overview() {
  await requireStaffPage();
  const base = await portalBase();
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [openAbuse, openRemoval, listed, hidden, handledWeek, newWeek, queue, audit] = await Promise.all([
    db.report.count({ where: { status: 'OPEN', kind: 'ABUSE' } }),
    db.report.count({ where: { status: 'OPEN', kind: 'REMOVAL' } }),
    db.server.count({ where: { status: 'PUBLIC' } }),
    db.server.count({ where: { status: { in: ['HIDDEN', 'REMOVED'] } } }),
    db.report.count({ where: { handledAt: { gte: weekAgo } } }),
    db.server.count({ where: { createdAt: { gte: weekAgo } } }),
    db.report.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      take: 8,
      include: { server: { select: { id: true, name: true, iconUrl: true } } },
    }),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { select: { username: true } } } }),
  ]);

  const tiles: [string, number, string?][] = [
    ['Open abuse reports', openAbuse, `${base}/reports?kind=ABUSE`],
    ['Open removal requests', openRemoval, `${base}/reports?kind=REMOVAL`],
    ['Handled this week', handledWeek],
    ['Public servers', listed, `${base}/servers`],
    ['New this week', newWeek, `${base}/servers?sort=new`],
    ['Hidden or removed', hidden, `${base}/servers?status=HIDDEN`],
  ];

  return (
    <div className="max-w-6xl">
      <PageHead title="Overview" sub="What needs looking at, oldest first." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map(([label, n, href], i) => {
          const body = (
            <>
              <div className="text-xs text-ink-3">{label}</div>
              <div className={`mt-1.5 font-display text-[28px] font-extrabold tabular-nums leading-none ${i < 2 && n > 0 ? 'text-accent' : ''}`}>{n.toLocaleString()}</div>
            </>
          );
          return (
            <Reveal key={label} delay={i * 0.03} y={8}>
              {href ? (
                <Link href={href} className="block card px-4 py-4 hover:border-line-strong transition-colors">
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
          <header className="flex items-center justify-between px-5 h-14 border-b border-line">
            <h2 className="font-bold">Queue</h2>
            <Link href={`${base}/reports`} className="text-sm text-ink-3 hover:text-ink inline-flex items-center gap-1">
              All reports <ArrowRight size={14} />
            </Link>
          </header>
          {queue.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-3">Inbox zero. Nice.</p>
          ) : (
            <ul className="divide-y divide-line">
              {queue.map((r) => (
                <li key={r.id}>
                  <Link href={`${base}/reports/${r.id}?kind=${r.kind}`} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-surface-2 transition-colors">
                    <Avatar src={r.server.iconUrl} name={r.server.name} id={r.server.id} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{r.server.name}</div>
                      <div className="text-[13px] text-ink-3 truncate">{reasonLabel(r.kind, r.reason)}</div>
                    </div>
                    <span className={`text-[11px] font-semibold rounded-full px-2 h-5 inline-flex items-center border ${r.kind === 'ABUSE' ? 'text-accent border-accent/30 bg-accent-soft' : 'text-ink-2 border-line-strong'}`}>
                      {r.kind === 'ABUSE' ? 'Abuse' : 'Removal'}
                    </span>
                    <span className="w-16 text-right text-xs text-ink-3 tabular-nums">{timeAgo(r.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between px-5 h-14 border-b border-line">
            <h2 className="font-bold">Recent actions</h2>
            <Link href={`${base}/audit`} className="text-sm text-ink-3 hover:text-ink inline-flex items-center gap-1">
              Audit log <ArrowRight size={14} />
            </Link>
          </header>
          {audit.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-3">No actions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {audit.map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm flex gap-3">
                  <span className="text-ink-2 flex-1 min-w-0 truncate">
                    <b className="text-ink">@{a.actor.username}</b> {auditLabel(a.action)} <span className="font-mono text-xs text-ink-3">{a.targetId.slice(0, 12)}</span>
                  </span>
                  <span className="text-xs text-ink-3 tabular-nums shrink-0">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
