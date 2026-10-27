// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArrowUpRight, Clock3, PartyPopper } from 'lucide-react';
import { canManageClient, readPlatforms, readScreenshots } from '@/lib/clients';
import { db } from '@/lib/db';
import { compact } from '@/lib/format';
import { RELEASE_ERRORS, type ReleaseFailure } from '@/lib/github';
import { getUser } from '@/lib/session';
import { Avatar } from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import { NsfwMark } from '@/components/NsfwMark';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { BumpStatus } from '@/components/manage/BumpStatus';
import { ClientListingForm } from '@/components/manage/ClientListingForm';
import { DangerZone } from '@/components/manage/DangerZone';

export const metadata: Metadata = { title: 'Manage client listing' };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> };

export default async function ManageClient({ params, searchParams }: Props) {
  const { slug } = await params;
  const { created } = await searchParams;
  const user = await getUser();
  if (!user) redirect(`/login?next=/clients/${slug}/manage`);

  const c = await db.clientListing.findUnique({
    where: { slug },
    include: {
      tags: { include: { tag: true } },
      badges: { select: { kind: true } },
      files: { select: { id: true, platform: true, kind: true, label: true, url: true, managed: true }, orderBy: { position: 'asc' } },
    },
  });
  if (!c || !canManageClient(user, c)) notFound();

  const manual = c.files.filter((f) => !f.managed);
  const managedCount = c.files.length - manual.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      {created && (
        <Reveal y={-8}>
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4">
            <PartyPopper size={20} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-relaxed">
              <b>Sent for review.</b> A staff member checks every client before it goes on the board — we’ll DM you
              through the YapBoard bot either way. You can keep editing while you wait.
            </p>
          </div>
        </Reveal>
      )}

      <Reveal>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar src={c.iconUrl} name={c.name} id={c.id} size={64} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-[28px] font-extrabold">{c.name}</h1>
                <BadgeRow kinds={c.badges.map((x) => x.kind)} seed={c.id} size={22} max={4} />
                {c.nsfw && <NsfwMark size="md" />}
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-0.5 font-mono text-sm text-ink-3">/clients/{c.slug}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BumpStatus serverId={c.id} kind="client" bumpedAt={c.bumpedAt?.toISOString() ?? null} canWebBump={c.status === 'PUBLIC'} />
            <Link href={`/clients/${c.slug}`} className="btn btn-secondary btn-sm">
              View page <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </Reveal>

      {c.status === 'PENDING' && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Waiting for a staff review. It isn’t on the client board yet, and nobody but you and staff can open its page.
          You can keep editing while you wait — saving doesn’t put you back to the end of the queue.
        </div>
      )}

      {c.status === 'DENIED' && (
        <div className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <b>Staff asked for changes{c.statusNote ? ':' : '.'}</b>
          {c.statusNote ? ` ${c.statusNote}` : ''} Fix it below and save — that sends the listing back for review.
        </div>
      )}

      {(c.status === 'HIDDEN' || c.status === 'REMOVED') && (
        <div className="mt-6 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {c.status === 'HIDDEN' ? 'YapBoard staff hid this listing' : 'YapBoard staff removed this listing'}
          {c.statusNote ? `: ${c.statusNote}` : '.'} Edits are saved but it won’t show on the client board.
        </div>
      )}

      {c.releaseError && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Clock3 size={16} className="mt-0.5 shrink-0" />
          <span>
            <b>The last release check didn’t work.</b> {RELEASE_ERRORS[c.releaseError as ReleaseFailure] ?? 'GitHub didn’t answer.'} Your
            existing download links are still on the page.
          </span>
        </div>
      )}

      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Downloads', c.downloads],
            ['Page views', c.views],
            ['Files listed', c.files.length],
            ['Total bumps', c.bumpCount],
          ].map(([label, n]) => (
            <div key={label as string} className="card px-5 py-4">
              <div className="text-xs text-ink-3">{label}</div>
              <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{compact(n as number)}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-10">
        <ClientListingForm
          mode="edit"
          initial={{
            id: c.id,
            slug: c.slug,
            name: c.name,
            summary: c.summary,
            description: c.description,
            iconUrl: c.iconUrl ?? '',
            bannerUrl: c.bannerUrl ?? '',
            website: c.website ?? '',
            sourceUrl: c.sourceUrl ?? '',
            framework: c.framework ?? '',
            supportServerId: c.supportServerId ?? '',
            language: c.language,
            nsfw: c.nsfw,
            unlisted: c.status === 'UNLISTED' || (c.status === 'PENDING' && c.requestedUnlisted),
            accent: c.accent,
            theme: c.theme,
            screenshots: readScreenshots(c.screenshots),
            platforms: readPlatforms(c.platforms),
            releaseSource: c.releaseSource,
            repo: c.repo ?? '',
            files: manual.map((f) => ({ platform: f.platform, label: f.label, url: f.url, kind: f.kind })),
            tags: c.tags.map((t) => t.tag.name),
            badges: c.badges.map((x) => x.kind),
            version: c.version,
            downloads: c.downloads,
            managedCount,
            releaseError: c.releaseError,
          }}
        />
      </div>

      {c.status !== 'REMOVED' && <DangerZone serverId={c.id} name={c.name} kind="client" />}
    </div>
  );
}
