// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight, SearchX, X } from 'lucide-react';
import clsx from 'clsx';
import { BOT_SORTS, botSearchHref, parseBotSearch, searchBots, type BotSearchParams } from '@/lib/bots';
import { BotGrid } from '@/components/BotGrid';
import { SortSelect } from '@/components/browse/Selects';
import { getRankingConfig } from '@/lib/engagement';
import { FilterPanel } from '@/components/browse/FilterPanel';
import { Badge } from '@/components/Badge';
import { GlyphScatter } from '@/components/Glyphs';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = parseBotSearch(await searchParams);
  if (p.q) return { title: `“${p.q}” bots` };
  if (p.tags.length) return { title: p.tags.map((t) => `#${t}`).join(' ') + ' bots' };
  return { title: 'Browse bots', description: 'Bots for your Yapin’ server: music, moderation, games and more.' };
}

export default async function BrowseBots({ searchParams }: Props) {
  const p = parseBotSearch(await searchParams);
  const [res, cfg] = await Promise.all([searchBots(p), getRankingConfig()]);
  const ranking = cfg.enabled && cfg.affectsRanking;
  const filtered = p.q || p.tags.length || p.nsfw || p.verified;
  const title = p.q ? `Results for “${p.q}”` : p.tags.length ? p.tags.map((t) => `#${t}`).join(' + ') : 'All bots';

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8">
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[240px_1fr]">
        {/* ---------- filters ---------- */}
        <FilterPanel active={[p.nsfw, p.verified].filter(Boolean).length}>
          <form action="/bots" className="flex gap-2">
            <input name="q" defaultValue={p.q} placeholder="Search bots" className="field h-10 min-w-0 flex-1 text-sm" />
            <button className="btn btn-secondary btn-sm">Go</button>
          </form>

          {res.facets.length > 0 && (
            <FilterGroup title={p.tags.length ? 'Narrow it down' : 'Popular here'}>
              <div className="flex flex-wrap gap-1.5">
                {res.facets.map((f) => (
                  <Link key={f.name} href={botSearchHref({ ...p, tags: [...p.tags, f.name], page: 1 })} className="chip">
                    <span className="text-ink-3">+</span>
                    {f.name}
                    <span className="text-ink-3 tabular-nums">{f.count}</span>
                  </Link>
                ))}
              </div>
            </FilterGroup>
          )}

          <FilterGroup title="Content">
            <div className="space-y-3">
              <ToggleLink href={botSearchHref({ ...p, verified: !p.verified, page: 1 })} on={p.verified}>
                <span className="inline-flex items-center gap-1.5">
                  Verified &amp; official only <Badge kind="VERIFIED" size={15} />
                </span>
              </ToggleLink>
              <ToggleLink href={botSearchHref({ ...p, nsfw: !p.nsfw, page: 1 })} on={p.nsfw}>
                Show 18+ bots
              </ToggleLink>
            </div>
          </FilterGroup>
        </FilterPanel>

        {/* ---------- results ---------- */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] sm:text-[34px] font-extrabold leading-tight">{title}</h1>
              <p className="mt-1 text-sm text-ink-3 tabular-nums">
                {res.total.toLocaleString()} bot{res.total === 1 ? '' : 's'} for your Yapin’ server
              </p>
            </div>
            {/* Offering a sort that is switched off would be a menu item that silently does something else. */}
            <SortSelect value={p.sort} options={Object.entries(BOT_SORTS).filter(([k]) => k !== 'hot' || ranking)} />
          </div>

          {filtered && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {p.q && <ActiveChip href={botSearchHref({ ...p, q: '', page: 1 })}>“{p.q}”</ActiveChip>}
              {p.tags.map((t) => (
                <ActiveChip key={t} href={botSearchHref({ ...p, tags: p.tags.filter((x) => x !== t), page: 1 })}>
                  #{t}
                </ActiveChip>
              ))}
              {p.verified && <ActiveChip href={botSearchHref({ ...p, verified: false, page: 1 })}>Verified only</ActiveChip>}
              {p.nsfw && <ActiveChip href={botSearchHref({ ...p, nsfw: false, page: 1 })}>18+ shown</ActiveChip>}
              <Link href="/bots" className="text-[13px] font-medium text-ink-3 hover:text-ink ml-1">
                Clear all
              </Link>
            </div>
          )}

          <div className="mt-6">{res.items.length ? <BotGrid bots={res.items} activeTags={p.tags} animationKey={JSON.stringify(p)} /> : <Empty q={p.q} />}</div>

          {res.pages > 1 && <Pager p={p} page={res.page} pages={res.pages} />}
        </section>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3 font-sans">{title}</h2>
      {children}
    </div>
  );
}

function ToggleLink({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} role="switch" aria-checked={on} className="flex items-center justify-between gap-3 text-sm text-ink-2 hover:text-ink">
      {children}
      <span className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-surface-3')}>
        <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
    </Link>
  );
}

function ActiveChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="chip chip-active group pr-1.5">
      {children}
      <X size={13} className="opacity-70 group-hover:opacity-100" />
    </Link>
  );
}

function Pager({ p, page, pages }: { p: BotSearchParams; page: number; pages: number }) {
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="Pages">
      <Link aria-disabled={page === 1} href={botSearchHref({ ...p, page: page - 1 })} className={clsx('btn btn-ghost btn-sm', page === 1 && 'pointer-events-none opacity-40')}>
        <ChevronLeft size={16} /> Prev
      </Link>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
          <Link href={botSearchHref({ ...p, page: n })} aria-current={n === page ? 'page' : undefined} className={clsx('btn btn-sm w-9 px-0 tabular-nums', n === page ? 'btn-secondary' : 'btn-ghost')}>
            {n}
          </Link>
        </span>
      ))}
      <Link aria-disabled={page === pages} href={botSearchHref({ ...p, page: page + 1 })} className={clsx('btn btn-ghost btn-sm', page === pages && 'pointer-events-none opacity-40')}>
        Next <ChevronRight size={16} />
      </Link>
    </nav>
  );
}

function Empty({ q }: { q: string }) {
  return (
    <div className="relative overflow-hidden card px-6 py-16 text-center">
      <GlyphScatter
        items={[
          { g: 'plus', at: { left: '10%', top: '22%' }, size: 20, r: 12 },
          { g: 'squiggle', at: { left: '15%', bottom: '22%' }, size: 30, r: -4 },
          { g: 'ring', at: { right: '12%', top: '26%' }, size: 16, accent: true },
          { g: 'hash', at: { right: '9%', bottom: '18%' }, size: 24, r: 10 },
        ]}
      />
      <SearchX className="mx-auto text-ink-3" size={34} strokeWidth={1.6} />
      <h2 className="mt-4 text-xl font-bold">No bots here yet</h2>
      <p className="mt-2 text-sm text-ink-3 max-w-sm mx-auto">Nothing matches {q ? `“${q}”` : 'those filters'}. Try fewer tags, or list the bot you run.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/bots" className="btn btn-secondary btn-sm">
          Browse everything
        </Link>
        <Link href="/bots/add" className="btn btn-primary btn-sm">
          List your bot
        </Link>
      </div>
    </div>
  );
}
