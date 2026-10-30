// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { getCommentsConfig } from '@/lib/comments';
import { boardMean, getRankingConfig, PAGE_ONE, WINDOW_NOTE } from '@/lib/engagement';
import { proSet } from '@/lib/pro';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { isAdmin } from '@/lib/session';
import { Avatar } from '@/components/Avatar';
import { PageHead } from '@/components/portal/PageHead';
import { CommentSettings, RankingSettings, RankingSwitches } from '@/components/portal/RankingControls';

export const metadata: Metadata = { title: 'Ranking' };

/**
 * The Active ranking, its numbers, and whether it is doing any good.
 *
 * The third table is the one that matters most and the one easiest to forget. An engagement ranking has a
 * natural rich-get-richer failure - the listings on page one get the activity that keeps them on page one -
 * so if the top slice's share of attention climbs after switching it on, the half-life is too long or the
 * size weight is too strong, in that order.
 */
export default async function PortalRanking() {
  const me = await requireStaffPage('/ranking');
  const base = await portalBase();
  const [cfg, comments, mean] = await Promise.all([getRankingConfig(), getCommentsConfig(), boardMean()]);

  const [top, listed, reviews, replies, counted, hidden] = await Promise.all([
    db.server.findMany({
      where: { status: 'PUBLIC' },
      select: { id: true, name: true, iconUrl: true, hotScore: true, hotAt: true, memberCount: true, reviewCount: true, ratingSum: true, ownerId: true },
      orderBy: { hotScore: 'desc' },
      take: PAGE_ONE,
    }),
    db.server.count({ where: { status: 'PUBLIC' } }),
    db.comment.count({ where: { parentId: null, hiddenAt: null } }),
    db.comment.count({ where: { parentId: { not: null }, hiddenAt: null } }),
    db.comment.count({ where: { counts: true, hiddenAt: null } }),
    db.comment.count({ where: { hiddenAt: { not: null } } }),
  ]);

  // Of the listings the ranking actually puts in front of people, how many are there partly because they paid.
  const promoted = await proSet('server', top.map((t) => t.id));
  const share = top.length ? Math.round((promoted.size / top.length) * 100) : 0;
  const scored = top.filter((t) => t.hotScore > 0).length;

  return (
    <div>
      <PageHead title="Ranking" sub="The “Active” sort: how much real, recent, human activity a listing has.">
        <RankingSwitches cfg={cfg} />
      </PageHead>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="State"
          value={!cfg.enabled ? 'Off' : cfg.affectsRanking ? 'Sorting' : 'Watch-only'}
          hint={!cfg.enabled ? 'No scores are kept' : cfg.affectsRanking ? 'Active is the default sort' : 'Scored, but sorting nothing yet'}
          tone={!cfg.enabled ? 'off' : cfg.affectsRanking ? 'live' : 'watch'}
        />
        <Stat label="Scored listings" value={`${scored} of ${listed}`} hint="A zero means no counted activity at all" />
        <Stat
          label="Promoted on page one"
          value={`${share}%`}
          /* Above about a fifth and the spacing rule is doing work the multiplier should be doing. */
          hint={share > 20 ? 'High - consider lowering the Pro boost' : 'Healthy'}
          tone={share > 20 ? 'watch' : undefined}
        />
        <Stat label="Board average rating" value={mean.toFixed(2)} hint="What every listing's own rating is shrunk toward" />
      </div>

      <div className="mb-6 rounded-xl border border-line bg-raised px-4 py-3 text-[12.5px] leading-relaxed text-ink-3">
        Scores are stored in log2 and anchored to a fixed epoch, so they are never “stale” - a row written last month still sorts correctly against one written a
        second ago, and a rebuild is safe to run at any time. {WINDOW_NOTE}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold">Page one, as the board would order it</h2>
        <div className="card divide-y divide-line overflow-hidden">
          {top.length === 0 && <p className="p-5 text-[13px] text-ink-3">Nothing listed yet.</p>}
          {top.map((s, i) => (
            <Link key={s.id} href={`${base}/ranking/server/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface">
              <span className="w-6 shrink-0 text-right font-mono text-[12px] text-ink-3">{i + 1}</span>
              <Avatar src={s.iconUrl} name={s.name} id={s.id} size={26} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{s.name}</span>
              {promoted.has(s.id) && (
                <span className="shrink-0 rounded-full border border-[#e0a019]/50 bg-[#e0a019]/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-[#f2bb3c]">
                  Promoted
                </span>
              )}
              <span className="shrink-0 text-[12px] tabular-nums text-ink-3">{s.reviewCount} rev</span>
              <span className="w-20 shrink-0 text-right font-mono text-[12px] tabular-nums">{s.hotScore.toFixed(2)}</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-ink-3">Click one to see every term behind its score.</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold">What there is to rank</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Reviews" value={String(reviews)} />
          <Stat label="Replies" value={String(replies)} />
          <Stat label="Counting toward rank" value={String(counted)} hint="The rest post, show and earn nothing" />
          <Stat label="Hidden" value={String(hidden)} hint="Kept, never deleted" />
        </div>
      </section>

      <div className="space-y-6">
        <RankingSettings initial={cfg} canEdit={isAdmin(me)} />
        <CommentSettings initial={comments} canEdit={isAdmin(me)} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'live' | 'watch' | 'off' }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-3">{label}</div>
      <div
        className={clsx(
          'mt-1 font-display text-xl font-bold tabular-nums',
          tone === 'live' && 'text-ok',
          tone === 'watch' && 'text-warn',
          tone === 'off' && 'text-ink-3',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{hint}</div>}
    </div>
  );
}
