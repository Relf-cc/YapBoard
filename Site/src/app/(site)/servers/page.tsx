import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight, SearchX, X } from 'lucide-react';
import clsx from 'clsx';
import { AD_MIN_RESULTS, parseSearch, search, searchHref, SIZES, SORTS, type SearchParams } from '@/lib/search';
import { LANGUAGES, languageName } from '@/lib/languages';
import { ServerGrid } from '@/components/ServerGrid';
import { SearchBar } from '@/components/SearchBar';
import { SortSelect, LanguageSelect } from '@/components/browse/Selects';
import { FilterPanel } from '@/components/browse/FilterPanel';
import { Badge } from '@/components/Badge';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = parseSearch(await searchParams);
  if (p.q) return { title: `“${p.q}” servers` };
  if (p.tags.length) return { title: p.tags.map((t) => `#${t}`).join(' ') + ' servers' };
  return { title: 'Browse servers' };
}

export default async function Browse({ searchParams }: Props) {
  const p = parseSearch(await searchParams);
  const res = await search(p);
  const page = Math.min(p.page, res.pages);
  const filtered = p.q || p.tags.length || p.lang || p.size !== 'any' || p.nsfw || p.verified;
  const title = p.q ? `Results for “${p.q}”` : p.tags.length ? p.tags.map((t) => `#${t}`).join(' + ') : 'All servers';
  // A random slot for the YapBoard Pro card, picked fresh on each request.
  const adAt = res.items.length >= AD_MIN_RESULTS ? Math.floor(Math.random() * (res.items.length + 1)) : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8">
      <div className="lg:hidden mb-6">
        <SearchBar defaultValue={p.q} />
      </div>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[240px_1fr]">
        {/* ---------- filters ---------- */}
        <FilterPanel active={[p.lang, p.size !== 'any', p.nsfw, p.verified].filter(Boolean).length}>
          <FilterGroup title="Size">
            <div className="flex flex-wrap lg:flex-col gap-1">
              {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((s) => (
                <FilterLink key={s} href={searchHref({ ...p, size: s, page: 1 })} active={p.size === s}>
                  {SIZES[s]}
                </FilterLink>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Language">
            <LanguageSelect value={p.lang ?? ''} options={Object.entries(LANGUAGES)} />
          </FilterGroup>

          {res.facets.length > 0 && (
            <FilterGroup title={p.tags.length ? 'Narrow it down' : 'Popular here'}>
              <div className="flex flex-wrap gap-1.5">
                {res.facets.map((f) => (
                  <Link key={f.name} href={searchHref({ ...p, tags: [...p.tags, f.name], page: 1 })} className="chip">
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
              <ToggleLink href={searchHref({ ...p, verified: !p.verified, page: 1 })} on={p.verified}>
                <span className="inline-flex items-center gap-1.5">
                  Verified &amp; official only <Badge kind="VERIFIED" size={15} />
                </span>
              </ToggleLink>
              <ToggleLink href={searchHref({ ...p, nsfw: !p.nsfw, page: 1 })} on={p.nsfw}>
                Show 18+ servers
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
                {res.total.toLocaleString()} server{res.total === 1 ? '' : 's'}
                {res.loose && ' matching some of your words'}
              </p>
            </div>
            <SortSelect value={p.sort} options={Object.entries(SORTS).filter(([k]) => k !== 'relevance' || p.q)} />
          </div>

          {filtered && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {p.q && <ActiveChip href={searchHref({ ...p, q: '', page: 1 })}>“{p.q}”</ActiveChip>}
              {p.tags.map((t) => (
                <ActiveChip key={t} href={searchHref({ ...p, tags: p.tags.filter((x) => x !== t), page: 1 })}>
                  #{t}
                </ActiveChip>
              ))}
              {p.lang && <ActiveChip href={searchHref({ ...p, lang: null, page: 1 })}>{languageName(p.lang)}</ActiveChip>}
              {p.size !== 'any' && <ActiveChip href={searchHref({ ...p, size: 'any', page: 1 })}>{SIZES[p.size]}</ActiveChip>}
              {p.verified && <ActiveChip href={searchHref({ ...p, verified: false, page: 1 })}>Verified only</ActiveChip>}
              {p.nsfw && <ActiveChip href={searchHref({ ...p, nsfw: false, page: 1 })}>18+ shown</ActiveChip>}
              <Link href="/servers" className="text-[13px] font-medium text-ink-3 hover:text-ink ml-1">
                Clear all
              </Link>
            </div>
          )}

          <div className="mt-6">
            {res.items.length ? (
              <ServerGrid servers={res.items} activeTags={p.tags} animationKey={JSON.stringify({ ...p, page })} adAt={adAt} />
            ) : (
              <Empty p={p} />
            )}
          </div>

          {res.pages > 1 && <Pager p={p} page={page} pages={res.pages} />}
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

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        'px-3 py-1.5 rounded-lg text-sm transition-colors',
        active ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </Link>
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

function Pager({ p, page, pages }: { p: SearchParams; page: number; pages: number }) {
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="Pages">
      <Link aria-disabled={page === 1} href={searchHref({ ...p, page: page - 1 })} className={clsx('btn btn-ghost btn-sm', page === 1 && 'pointer-events-none opacity-40')}>
        <ChevronLeft size={16} /> Prev
      </Link>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
          <Link href={searchHref({ ...p, page: n })} aria-current={n === page ? 'page' : undefined} className={clsx('btn btn-sm w-9 px-0 tabular-nums', n === page ? 'btn-secondary' : 'btn-ghost')}>
            {n}
          </Link>
        </span>
      ))}
      <Link aria-disabled={page === pages} href={searchHref({ ...p, page: page + 1 })} className={clsx('btn btn-ghost btn-sm', page === pages && 'pointer-events-none opacity-40')}>
        Next <ChevronRight size={16} />
      </Link>
    </nav>
  );
}

function Empty({ p }: { p: SearchParams }) {
  return (
    <div className="card px-6 py-16 text-center">
      <SearchX className="mx-auto text-ink-3" size={34} strokeWidth={1.6} />
      <h2 className="mt-4 text-xl font-bold">Nothing yet</h2>
      <p className="mt-2 text-sm text-ink-3 max-w-sm mx-auto">
        No servers match {p.q ? `“${p.q}”` : 'those filters'}. Try fewer tags, a different spelling, or a wider size range.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/servers" className="btn btn-secondary btn-sm">
          Browse everything
        </Link>
        <Link href="/add" className="btn btn-primary btn-sm">
          List your server
        </Link>
      </div>
    </div>
  );
}
