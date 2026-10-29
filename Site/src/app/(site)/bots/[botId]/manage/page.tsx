// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArrowUpRight, PartyPopper } from 'lucide-react';
import { canManageBot } from '@/lib/bots';
import { grandfather, isPro, limitsFor, planState } from '@/lib/pro';
import { billingEnabled } from '@/lib/env';
import { db } from '@/lib/db';
import { compact } from '@/lib/format';
import { getUser } from '@/lib/session';
import { Avatar } from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { BotListingForm } from '@/components/manage/BotListingForm';
import { BumpStatus } from '@/components/manage/BumpStatus';
import { DangerZone } from '@/components/manage/DangerZone';
import { Managers } from '@/components/manage/Managers';
import { ProPanel } from '@/components/manage/ProPanel';
import { isOwner } from '@/lib/manage';

export const metadata: Metadata = { title: 'Manage bot listing' };

type Props = { params: Promise<{ botId: string }>; searchParams: Promise<{ created?: string }> };

export default async function ManageBot({ params, searchParams }: Props) {
  const { botId } = await params;
  const { created } = await searchParams;
  const user = await getUser();
  if (!user) redirect(`/login?next=/bots/${botId}/manage`);

  const b = await db.botListing.findUnique({ where: { id: botId }, include: { tags: { include: { tag: true } }, badges: { select: { kind: true } }, managers: { select: { userId: true, user: { select: { username: true, displayName: true, avatarUrl: true } } } } } });
  if (!b || !canManageBot(user, b)) notFound();

  // Raised to cover whatever the listing already holds, so a lapsed plan can't make the form unsaveable.
  const plan = await planState(b.ownerId);
  const pro = await isPro('bot', b.id, b.ownerId);
  const limits = grandfather(limitsFor('bot', pro), { description: b.description.length, tags: b.tags.length });
  const owner = isOwner(user, b);
  const managers = b.managers.map((m) => ({ userId: m.userId, username: m.user.username, displayName: m.user.displayName, avatarUrl: m.user.avatarUrl }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10">
      {created && (
        <Reveal y={-8}>
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4">
            <PartyPopper size={20} className="text-accent shrink-0" />
            <p className="text-sm">
              <b>You’re live.</b> Your bot is on the board. Bump it every 2 hours to stay near the top.
            </p>
          </div>
        </Reveal>
      )}

      <Reveal>
        <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar src={b.avatarUrl} name={b.name} id={b.id} size={64} round />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[28px] font-extrabold truncate">{b.name}</h1>
                <BadgeRow kinds={b.badges.map((x) => x.kind)} seed={b.id} size={22} max={4} />
                {b.nsfw && <NsfwMark size="md" />}
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-0.5 text-sm text-ink-3 font-mono">{b.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BumpStatus serverId={b.id} kind="bot" bumpedAt={b.bumpedAt?.toISOString() ?? null} canWebBump={b.status === 'PUBLIC'} />
            <Link href={`/bots/${b.id}`} className="btn btn-secondary btn-sm">
              View page <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </Reveal>

      {b.status === 'PENDING' && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Waiting for a staff review. It isn’t on the bot board yet, and nobody but you and staff can open its page. You
          can keep editing while you wait - saving doesn’t put you back in the queue.
        </div>
      )}

      {b.status === 'DENIED' && (
        <div className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <b>Staff asked for changes{b.statusNote ? ':' : '.'}</b>
          {b.statusNote ? ` ${b.statusNote}` : ''} Fix it below and save - that sends the listing back for review.
        </div>
      )}

      {(b.status === 'HIDDEN' || b.status === 'REMOVED') && (
        <div className="mt-6 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {b.status === 'HIDDEN' ? 'YapBoard staff hid this listing' : 'YapBoard staff removed this listing'}
          {b.statusNote ? `: ${b.statusNote}` : '.'} Edits are saved but it won’t show on the bot board.
        </div>
      )}

      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Servers', b.serverCount],
            ['Page views', b.views],
            ['Add clicks', b.adds],
            ['Total bumps', b.bumpCount],
          ].map(([label, n]) => (
            <div key={label as string} className="card px-5 py-4">
              <div className="text-xs text-ink-3">{label}</div>
              <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{compact(n as number)}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-10">
        <BotListingForm
          limits={limits}
          mode="edit"
          devMode={false}
          initial={{
            botId: b.id,
            supportServerId: b.supportServerId ?? '',
            name: b.name,
            avatarUrl: b.avatarUrl,
            serverCount: b.serverCount,
            summary: b.summary,
            description: b.description,
            inviteUrl: b.inviteUrl ?? '',
            website: b.website ?? '',
            prefix: b.prefix ?? '',
            library: b.library ?? '',
            language: b.language,
            nsfw: b.nsfw,
            unlisted: b.status === 'UNLISTED',
            accent: b.accent,
            tags: b.tags.map((t) => t.tag.name),
            badges: b.badges.map((x) => x.kind),
          }}
        />
      </div>

      <ProPanel kind="bot" listingId={b.id} plan={plan} billingOn={billingEnabled()} removed={b.status === 'REMOVED'} />

      <Managers kind="bot" listingId={b.id} managers={managers} max={limits.managers} isOwner={owner} />

      {owner && b.status !== 'REMOVED' && <DangerZone serverId={b.id} name={b.name} kind="bot" />}
    </div>
  );
}
