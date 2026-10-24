import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ChevronsUp, Eye, MousePointerClick, Plus, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { botEnabled } from '@/lib/env';
import { getUser } from '@/lib/session';
import { compact } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { BumpStatus } from '@/components/manage/BumpStatus';

export const metadata: Metadata = { title: 'Your servers' };

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect('/login?next=/dashboard');
  const servers = await db.server.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, iconUrl: true, status: true, badge: true, nsfw: true, memberCount: true, views: true, joins: true, bumpCount: true, bumpedAt: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-extrabold">Your servers</h1>
          <p className="mt-1 text-sm text-ink-3">Listings you’ve added. Bump each one every 2 hours to stay near the top.</p>
        </div>
        <Link href="/add" className="btn btn-primary">
          <Plus size={16} strokeWidth={2.6} /> Add server
        </Link>
      </div>

      {servers.length === 0 ? (
        <Reveal>
          <div className="mt-10 card px-6 py-16 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Plus size={26} />
            </div>
            <h2 className="mt-5 text-xl font-bold">Nothing listed yet</h2>
            <p className="mt-2 text-sm text-ink-3">Add your first server and it’ll show up here with its stats.</p>
            <Link href="/add" className="btn btn-primary mt-6">
              List a server
            </Link>
          </div>
        </Reveal>
      ) : (
        <ul className="mt-8 space-y-3">
          {servers.map((s, i) => (
            <li key={s.id}>
              <Reveal delay={i * 0.04} y={10} className="card p-5 flex flex-col md:flex-row md:items-center gap-5 hover:border-line-strong transition-colors">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <Avatar src={s.iconUrl} name={s.name} id={s.id} size={52} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/view/${s.id}`} className="font-display text-[17px] font-bold truncate hover:text-accent transition-colors">
                        {s.name}
                      </Link>
                      <Badge kind={s.badge} seed={s.id} size={17} />
                      {s.nsfw && <NsfwMark />}
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
                      <Metric icon={<Users size={13} />} value={compact(s.memberCount)} label="members" />
                      <Metric icon={<Eye size={13} />} value={compact(s.views)} label="views" />
                      <Metric icon={<MousePointerClick size={13} />} value={compact(s.joins)} label="joins" />
                      <Metric icon={<ChevronsUp size={13} />} value={compact(s.bumpCount)} label="bumps" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <BumpStatus serverId={s.id} bumpedAt={s.bumpedAt?.toISOString() ?? null} canWebBump={!botEnabled() && s.status === 'PUBLIC'} compact />
                  <Link href={`/manage/${s.id}`} className="btn btn-secondary btn-sm">
                    Manage
                  </Link>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span className="text-ink-2 font-medium tabular-nums">{value}</span> {label}
    </span>
  );
}
