// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { explainHot, factorAsHours, getRankingConfig, SIGNALS, type ScoreTerms } from '@/lib/engagement';
import { isListingKind } from '@/lib/pro';
import type { ListingKind } from '@/lib/pro-fields';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { PageHead } from '@/components/portal/PageHead';

export const metadata: Metadata = { title: 'Why this score' };

type Props = { params: Promise<{ kind: string; listingId: string }> };

/**
 * Every term behind one listing's score, with its work shown.
 *
 * This is not a nicety. It is the answer to "why did my server drop", which is the support ticket this whole
 * ranking generates, and it is the only practical way to tune the weights: pick ten listings you already
 * have an opinion about, and read why the board disagrees with you.
 *
 * It recomputes rather than reading `hotScore`, so it also catches the case where the stored number is stale
 * - the difference between the two is itself worth seeing.
 */
export default async function ExplainScore({ params }: Props) {
  await requireStaffPage('/ranking');
  const { kind, listingId } = await params;
  if (!isListingKind(kind)) notFound();
  const base = await portalBase();

  const [name, terms, cfg, stored] = await Promise.all([nameOf(kind, listingId), explainHot(kind, listingId), getRankingConfig(), storedScore(kind, listingId)]);
  if (!name) notFound();

  const H = cfg.halfLifeHours;
  const asAge = (hours: number) => (Math.abs(hours) < 36 ? `${Math.round(hours)}h` : `${(hours / 24).toFixed(1)} days`);

  return (
    <div>
      <Link href={`${base}/ranking`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft size={14} /> Ranking
      </Link>
      <PageHead title={name} sub={`Why this ${kind} scores what it does.`} />

      {!terms ? (
        <p className="card p-5 text-[13px] text-ink-3">No score could be worked out - the listing may have just been deleted.</p>
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-3">Score now</div>
                <div className="font-display text-3xl font-bold tabular-nums">{terms.score.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-3">Stored</div>
                <div className={clsx('font-display text-xl font-bold tabular-nums', Math.abs((stored ?? 0) - terms.score) > 0.01 ? 'text-warn' : 'text-ink-3')}>
                  {stored === null ? '-' : stored.toFixed(3)}
                </div>
              </div>
              {terms.score === 0 && <p className="text-[13px] text-ink-3">Zero means no counted activity in the window at all - not a penalty.</p>}
            </div>
          </div>

          <section>
            <h2 className="mb-3 text-sm font-bold">What counted</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-raised text-[11px] uppercase tracking-wider text-ink-3">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Signal</th>
                    <th className="px-4 py-2 text-right font-semibold">Weight</th>
                    <th className="px-4 py-2 text-right font-semibold">Cap each</th>
                    <th className="px-4 py-2 text-right font-semibold">Events</th>
                    <th className="px-4 py-2 text-right font-semibold">People</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {SIGNALS.map((sig) => {
                    const w = cfg.weights[kind as ListingKind][sig];
                    const c = terms.counted[sig];
                    return (
                      <tr key={sig} className={clsx(c.events === 0 && 'text-ink-3')}>
                        <td className="px-4 py-2 font-medium capitalize">{sig}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{w.w}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{w.cap}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{c.events}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{c.actors}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11.5px] text-ink-3">
              Events are what survived the per-person cap and the one-network-one-person rule. Owner and co-manager comments never count here - they still show,
              still get their badge.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold">The arithmetic</h2>
            <div className="card divide-y divide-line overflow-hidden text-[13px]">
              <Row label="Activity (log2 of the weighted, decayed sum)" value={terms.activity === null ? 'nothing' : terms.activity.toFixed(3)} />
              <Row
                label={`Diversity - ${terms.actors} distinct ${terms.actors === 1 ? 'person' : 'people'}`}
                value={`x ${terms.diversityFactor.toFixed(3)}`}
                age={terms.diversityFactor > 0 ? asAge(factorAsHours(terms.diversityFactor, H)) : null}
              />
              <Row label="Size" value={`x ${terms.sizeFactor.toFixed(3)}`} age={asAge(factorAsHours(terms.sizeFactor, H))} />
              <Row label="Rating" value={`x ${terms.ratingFactor.toFixed(3)}`} age={asAge(factorAsHours(terms.ratingFactor, H))} />
              <Row
                label={terms.proBoost > 1 ? 'YapBoard Pro boost' : 'YapBoard Pro boost (not on a plan)'}
                value={`x ${terms.proBoost.toFixed(2)}`}
                age={terms.proBoost > 1 ? asAge(factorAsHours(terms.proBoost, H)) : null}
              />
              <Row label="Penalties" value={terms.penalty ? `- ${terms.penalty.toFixed(3)}` : 'none'} age={terms.penalty ? `-${asAge(terms.penalty * H)}` : null} />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
              Every multiplier is shown as the amount of freshness it is worth, because that is the only unit anything here can honestly be compared in. A x1.25
              boost is not “25% better” - it is the difference between activity happening today and the same activity happening {asAge(factorAsHours(1.25, H))}{' '}
              ago.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, age }: { label: string; value: string; age?: string | null }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="min-w-0 flex-1">{label}</span>
      {age && <span className="shrink-0 text-[11.5px] text-ink-3">{age}</span>}
      <span className="w-24 shrink-0 text-right font-mono tabular-nums">{value}</span>
    </div>
  );
}

async function nameOf(kind: ListingKind, id: string): Promise<string | null> {
  const where = { id };
  const row =
    kind === 'server'
      ? await db.server.findUnique({ where, select: { name: true } })
      : kind === 'bot'
        ? await db.botListing.findUnique({ where, select: { name: true } })
        : await db.clientListing.findUnique({ where, select: { name: true } });
  return row?.name ?? null;
}

async function storedScore(kind: ListingKind, id: string): Promise<number | null> {
  const where = { id };
  const row =
    kind === 'server'
      ? await db.server.findUnique({ where, select: { hotScore: true } })
      : kind === 'bot'
        ? await db.botListing.findUnique({ where, select: { hotScore: true } })
        : await db.clientListing.findUnique({ where, select: { hotScore: true } });
  return row?.hotScore ?? null;
}

export type { ScoreTerms };
