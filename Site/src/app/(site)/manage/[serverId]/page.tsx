// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArrowUpRight, PartyPopper } from 'lucide-react';
import { db } from '@/lib/db';
import { botEnabled } from '@/lib/env';
import { getUser } from '@/lib/session';
import { canManageListing, readLinks, readScreenshots } from '@/lib/servers';
import { grandfather, isPro, limitsFor, planState } from '@/lib/pro';
import { billingEnabled } from '@/lib/env';
import { compact } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { ListingForm } from '@/components/manage/ListingForm';
import { BumpStatus } from '@/components/manage/BumpStatus';
import { DangerZone } from '@/components/manage/DangerZone';
import { Managers } from '@/components/manage/Managers';
import { ProPanel } from '@/components/manage/ProPanel';
import { isOwner } from '@/lib/manage';
import { SyncButton } from '@/components/manage/SyncButton';

export const metadata: Metadata = { title: 'Manage listing' };

type Props = { params: Promise<{ serverId: string }>; searchParams: Promise<{ created?: string }> };

export default async function Manage({ params, searchParams }: Props) {
  const { serverId } = await params;
  const { created } = await searchParams;
  const user = await getUser();
  if (!user) redirect(`/login?next=/manage/${serverId}`);

  const s = await db.server.findUnique({ where: { id: serverId }, include: { tags: { include: { tag: true } }, badges: { select: { kind: true } }, managers: { select: { userId: true, user: { select: { username: true, displayName: true, avatarUrl: true } } } } } });
  if (!s || !canManageListing(user, s)) notFound();

  // What this listing may contain, raised to cover whatever it already holds so a lapsed plan can't make
  // the form unsaveable. The route works the same numbers out again for itself (src/lib/pro.ts).
  const plan = await planState(s.ownerId);
  const pro = await isPro('server', s.id, s.ownerId);
  const limits = grandfather(limitsFor('server', pro), { description: s.description.length, tags: s.tags.length });
  const owner = isOwner(user, s);
  const managers = s.managers.map((m) => ({ userId: m.userId, username: m.user.username, displayName: m.user.displayName, avatarUrl: m.user.avatarUrl }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10">
      {created && (
        <Reveal y={-8}>
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4">
            <PartyPopper size={20} className="text-accent shrink-0" />
            <p className="text-sm">
              <b>You’re live.</b> Your server is on the board. Bump it with <code className="font-mono">/bump</code> every 2 hours to stay near the top.
            </p>
          </div>
        </Reveal>
      )}

      <Reveal>
        <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar src={s.iconUrl} name={s.name} id={s.id} size={64} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[28px] font-extrabold truncate">{s.name}</h1>
                <BadgeRow kinds={s.badges.map((b) => b.kind)} seed={s.id} size={22} max={4} />
                {s.nsfw && <NsfwMark size="md" />}
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-0.5 text-sm text-ink-3 font-mono">{s.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BumpStatus serverId={s.id} bumpedAt={s.bumpedAt?.toISOString() ?? null} canWebBump={!botEnabled() && s.status === 'PUBLIC'} />
            {botEnabled() && <SyncButton serverId={s.id} />}
            <Link href={`/view/${s.id}`} className="btn btn-secondary btn-sm">
              View page <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </Reveal>

      {(s.status === 'HIDDEN' || s.status === 'REMOVED') && (
        <div className="mt-6 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {s.status === 'HIDDEN' ? 'YapBoard staff hid this listing' : 'YapBoard staff removed this listing'}
          {s.statusNote ? `: ${s.statusNote}` : '.'} Edits are saved but it won’t show in search.
        </div>
      )}

      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Members', s.memberCount],
            ['Page views', s.views],
            ['Join clicks', s.joins],
            ['Total bumps', s.bumpCount],
          ].map(([label, n]) => (
            <div key={label} className="card px-5 py-4">
              <div className="text-xs text-ink-3">{label}</div>
              <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{compact(n as number)}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-10">
        <ListingForm
          mode="edit"
          devMode={!botEnabled()}
          initial={{
            serverId: s.id,
            name: s.name,
            iconUrl: s.iconUrl,
            memberCount: s.memberCount,
            summary: s.summary,
            description: s.description,
            inviteUrl: s.inviteUrl,
            language: s.language,
            nsfw: s.nsfw,
            unlisted: s.status === 'UNLISTED',
            broadcastsOff: s.broadcastsOff,
            accent: s.accent,
            tags: s.tags.map((t) => t.tag.name),
            theme: s.theme,
            customBannerUrl: s.customBannerUrl ?? '',
            bannerX: s.bannerX,
            bannerY: s.bannerY,
            bannerScale: s.bannerScale,
            screenshots: readScreenshots(s.screenshots, limits.screenshots),
            links: readLinks(s.links, limits.links),
            eventTitle: s.eventTitle,
            eventAt: s.eventAt ? s.eventAt.toISOString() : null,
            eventUrl: s.eventUrl,
            altLanguage: s.altLanguage,
            altSummary: s.altSummary,
            altDescription: s.altDescription,
            badges: s.badges.map((b) => b.kind),
          }}
          limits={limits}
          pro={pro}
        />
      </div>

      <ProPanel kind="server" listingId={s.id} plan={plan} billingOn={billingEnabled()} removed={s.status === 'REMOVED'} />

      <Managers kind="server" listingId={s.id} managers={managers} max={limits.managers} isOwner={owner} />

      {owner && s.status !== 'REMOVED' && <DangerZone serverId={s.id} name={s.name} />}
    </div>
  );
}
