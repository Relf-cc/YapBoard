// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppWindow, Bot, ChevronsUp, Download, Eye, MousePointerClick, Plus, Server, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { botEnabled } from '@/lib/env';
import { getUser } from '@/lib/session';
import { compact } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { BadgeRow } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { BumpStatus } from '@/components/manage/BumpStatus';

export const metadata: Metadata = { title: 'Your listings' };

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect('/login?next=/dashboard');
  const [servers, bots, clients] = await Promise.all([
    db.server.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, iconUrl: true, status: true, badges: { select: { kind: true } }, nsfw: true, memberCount: true, views: true, joins: true, bumpCount: true, bumpedAt: true },
    }),
    db.botListing.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, avatarUrl: true, status: true, badges: { select: { kind: true } }, nsfw: true, serverCount: true, views: true, adds: true, bumpCount: true, bumpedAt: true },
    }),
    db.clientListing.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, name: true, iconUrl: true, status: true, badges: { select: { kind: true } }, nsfw: true, version: true, views: true, downloads: true, bumpCount: true, bumpedAt: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-extrabold">Your listings</h1>
          <p className="mt-1 text-sm text-ink-3">Servers, bots and clients you’ve added. Bump each one every 2 hours to stay near the top.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/clients/add" className="btn btn-secondary">
            <AppWindow size={16} /> List a client
          </Link>
          <Link href="/bots/add" className="btn btn-secondary">
            <Bot size={16} /> List a bot
          </Link>
          <Link href="/add" className="btn btn-primary">
            <Plus size={16} strokeWidth={2.6} /> Add server
          </Link>
        </div>
      </div>

      {servers.length === 0 && bots.length === 0 && clients.length === 0 ? (
        <Reveal>
          <div className="mt-10 card px-6 py-16 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Plus size={26} />
            </div>
            <h2 className="mt-5 text-xl font-bold">Nothing listed yet</h2>
            <p className="mt-2 text-sm text-ink-3">Add your first server, bot or client and it’ll show up here with its stats.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/add" className="btn btn-primary">
                List a server
              </Link>
              <Link href="/bots/add" className="btn btn-secondary">
                List a bot
              </Link>
              <Link href="/clients/add" className="btn btn-secondary">
                List a client
              </Link>
            </div>
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
                      <BadgeRow kinds={s.badges.map((b) => b.kind)} seed={s.id} size={17} max={3} />
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

      {bots.length > 0 && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <Bot size={19} className="text-accent" /> Your bots
          </h2>
          <ul className="mt-5 space-y-3">
            {bots.map((b, i) => (
              <li key={b.id}>
                <Reveal delay={i * 0.04} y={10} className="card p-5 flex flex-col md:flex-row md:items-center gap-5 hover:border-line-strong transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Avatar src={b.avatarUrl} name={b.name} id={b.id} size={52} round />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/bots/${b.id}`} className="font-display text-[17px] font-bold truncate hover:text-accent transition-colors">
                          {b.name}
                        </Link>
                        <BadgeRow kinds={b.badges.map((x) => x.kind)} seed={b.id} size={17} max={3} />
                        {b.nsfw && <NsfwMark />}
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
                        <Metric icon={<Server size={13} />} value={compact(b.serverCount)} label="servers" />
                        <Metric icon={<Eye size={13} />} value={compact(b.views)} label="views" />
                        <Metric icon={<MousePointerClick size={13} />} value={compact(b.adds)} label="adds" />
                        <Metric icon={<ChevronsUp size={13} />} value={compact(b.bumpCount)} label="bumps" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <BumpStatus serverId={b.id} kind="bot" bumpedAt={b.bumpedAt?.toISOString() ?? null} canWebBump={b.status === 'PUBLIC'} compact />
                    <Link href={`/bots/${b.id}/manage`} className="btn btn-secondary btn-sm">
                      Manage
                    </Link>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      )}

      {clients.length > 0 && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <AppWindow size={19} className="text-accent" /> Your clients
          </h2>
          <ul className="mt-5 space-y-3">
            {clients.map((c, i) => (
              <li key={c.id}>
                <Reveal delay={i * 0.04} y={10} className="card p-5 flex flex-col md:flex-row md:items-center gap-5 hover:border-line-strong transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Avatar src={c.iconUrl} name={c.name} id={c.id} size={52} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/clients/${c.slug}`} className="font-display text-[17px] font-bold truncate hover:text-accent transition-colors">
                          {c.name}
                        </Link>
                        <BadgeRow kinds={c.badges.map((x) => x.kind)} seed={c.id} size={17} max={3} />
                        {c.nsfw && <NsfwMark />}
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
                        <Metric icon={<Download size={13} />} value={compact(c.downloads)} label="downloads" />
                        <Metric icon={<Eye size={13} />} value={compact(c.views)} label="views" />
                        <Metric icon={<ChevronsUp size={13} />} value={compact(c.bumpCount)} label="bumps" />
                        {c.version && <span className="inline-flex items-center gap-1.5 font-mono text-ink-2">{c.version}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <BumpStatus serverId={c.id} kind="client" bumpedAt={c.bumpedAt?.toISOString() ?? null} canWebBump={c.status === 'PUBLIC'} compact />
                    <Link href={`/clients/${c.slug}/manage`} className="btn btn-secondary btn-sm">
                      Manage
                    </Link>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
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
