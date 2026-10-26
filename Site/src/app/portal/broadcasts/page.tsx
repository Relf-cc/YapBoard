import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { countReachable, progressOf } from '@/lib/broadcasts';
import { requireStaffPage } from '@/lib/portal';
import { isAdmin } from '@/lib/session';
import { PageHead } from '@/components/portal/PageHead';
import { BroadcastComposer, type BroadcastRow } from '@/components/portal/BroadcastComposer';

export const metadata: Metadata = { title: 'Broadcasts' };
export const dynamic = 'force-dynamic';

export default async function BroadcastsPage() {
  const me = await requireStaffPage('/broadcasts');
  const [rows, reach, listed, optedOut] = await Promise.all([
    db.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { author: { select: { username: true } } } }),
    countReachable(),
    db.server.count({ where: { status: { in: ['PUBLIC', 'UNLISTED'] } } }),
    db.server.count({ where: { status: { in: ['PUBLIC', 'UNLISTED'] }, broadcastsOff: true } }),
  ]);

  const withProgress: BroadcastRow[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      linkUrl: r.linkUrl ?? '',
      linkLabel: r.linkLabel ?? '',
      status: r.status,
      author: r.author.username,
      createdAt: r.createdAt.toISOString(),
      progress: await progressOf(r.id),
    })),
  );

  const tiles: [string, number, string][] = [
    ['Servers we can reach', reach, 'They’ve used /bump, so we know where to post.'],
    ['Listed servers', listed, 'Everything public or unlisted.'],
    ['Opted out', optedOut, 'They’ve turned broadcasts off.'],
  ];

  return (
    <div className="max-w-5xl">
      <PageHead title="Broadcasts" sub="One message, posted by the bot in every server that has used it." />

      <div className="grid grid-cols-3 gap-3">
        {tiles.map(([label, n, hint]) => (
          <div key={label} className="card px-4 py-4">
            <div className="text-xs text-ink-3">{label}</div>
            <div className="mt-1.5 font-display text-[28px] font-extrabold leading-none tabular-nums">{n.toLocaleString()}</div>
            <div className="mt-1.5 text-[11px] leading-snug text-ink-3">{hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <BroadcastComposer rows={withProgress} reach={reach} canSend={isAdmin(me)} />
      </div>

      {!isAdmin(me) && <p className="mt-4 text-xs text-ink-3">Any staff member can write a draft and stop one that’s going out. Only admins can send.</p>}
    </div>
  );
}
