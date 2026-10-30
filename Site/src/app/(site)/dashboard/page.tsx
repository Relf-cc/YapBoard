// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppWindow, Bot, ChevronsUp, Download, Eye, MousePointerClick, Plus, Server, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { botEnabled } from '@/lib/env';
import { getUser } from '@/lib/session';
import { planState } from '@/lib/pro';
import { compact } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { Reveal } from '@/components/Reveal';
import { ProfileSettings } from '@/components/ProfileSettings';
import { StatusBadge } from '@/components/StatusBadge';
import { BadgeRow, ProMark } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { BumpStatus } from '@/components/manage/BumpStatus';
import { ProWelcome } from '@/components/pro/ProWelcome';
import { ProPlanStrip, ProToggle } from '@/components/pro/DashboardPro';

export const metadata: Metadata = { title: 'Your listings' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ pro?: string }> }) {
  const user = await getUser();
  if (!user) redirect('/login?next=/dashboard');
  const [me, servers, bots, clients] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { bio: true, link: true, profileHidden: true } }),
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

  // Which of these are under their Pro plan. One query for the lot, and the same answer the manage pages
  // and the listing pages give (src/lib/pro.ts).
  const plan = await planState(user.id);
  const onPro = (kind: 'server' | 'bot' | 'client', id: string) => plan.covered.some((c) => c.kind === kind && c.listingId === id);

  /**
   * Is there a slot free for one more listing of this kind? The same rule as `canAssign` in src/lib/pro.ts,
   * worked out here from the plan we already have rather than by asking three more times: a kind whose base
   * slot is unused always fits, otherwise it needs one of the floating extras.
   */
  const floatingUsed = plan.covered.filter((c) => c.via === 'slot').length;
  const canAdd = (kind: 'server' | 'bot' | 'client') =>
    plan.active && (!plan.covered.some((c) => c.kind === kind && c.via === 'base') || floatingUsed < plan.extraSlots);

  /**
   * Back from Stripe Checkout (src/components/pro/ProWelcome.tsx).
   *
   * The query string alone isn't enough to say "payment received": anyone can type it. Somebody who has
   * never been through a checkout has no Stripe Customer, so that row is the cheap proof - and once the
   * plan is live the question doesn't arise. Without either, this URL does nothing, which is right.
   */
  const welcome = (await searchParams).pro === 'welcome';
  const customer = welcome && !plan.active ? (await db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } }))?.stripeCustomerId : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-10">
      {welcome && (plan.active || customer) && (
        <ProWelcome active={plan.active} spare={plan.spare} hasListings={servers.length + bots.length + clients.length > 0} />
      )}
      {plan.active && (
        <ProPlanStrip
          plan={{
            active: plan.active,
            grace: plan.grace,
            capacity: plan.capacity,
            used: plan.covered.length,
            spare: plan.spare,
            overflow: plan.overflow.length,
            extraSlots: plan.extraSlots,
            cycle: plan.cycle,
            // Dates cross to the browser as ISO strings and are formatted there in UTC, so the server's
            // HTML and the hydrated markup agree (src/components/pro/DashboardPro.tsx).
            until: plan.until?.toISOString() ?? null,
            endingAt: plan.endingAt?.toISOString() ?? null,
          }}
        />
      )}
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
                      {onPro('server', s.id) && <ProMark size={17} seed={s.id} />}
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
                  <ProToggle kind="server" listingId={s.id} covered={onPro('server', s.id)} canAssign={canAdd('server')} removed={s.status === 'REMOVED'} />
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
                        {onPro('bot', b.id) && <ProMark size={17} seed={b.id} />}
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
                    <ProToggle kind="bot" listingId={b.id} covered={onPro('bot', b.id)} canAssign={canAdd('bot')} removed={b.status === 'REMOVED'} />
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
                        {onPro('client', c.id) && <ProMark size={17} seed={c.id} />}
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
                    <ProToggle kind="client" listingId={c.id} covered={onPro('client', c.id)} canAssign={canAdd('client')} removed={c.status === 'REMOVED'} />
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

      {me && (
        <Reveal delay={0.1}>
          <section className="mt-12">
            <ProfileSettings userId={user.id} initial={me} />
          </section>
        </Reveal>
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
