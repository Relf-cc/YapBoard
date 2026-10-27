// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, ChartColumn, Check, ChevronsUp, Link2, Minus, Pin, Timer, type LucideIcon } from 'lucide-react';
import { BadgeMark } from '@/components/Badge';
import { Reveal } from '@/components/Reveal';
import { GlyphScatter, Note, type ScatterItem } from '@/components/Glyphs';

export const metadata: Metadata = {
  title: 'YapBoard Pro',
  description: 'A purple check, stronger bumps and deeper stats for your Yapin’ server listing.',
};

/** Re-points the site accent at purple for this page only, so buttons, chips and links follow without new styles. */
const PURPLE = {
  '--accent': '#9a6bff',
  '--accent-hover': '#ab84ff',
  '--accent-press': '#8655f5',
  '--accent-soft': '#9a6bff1f',
  '--accent-line': '#9a6bff55',
  '--on-accent': '#13092b',
} as CSSProperties;

const PERKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: BadgeCheck, title: 'Purple checkmark', body: 'Next to your name on every card, search result and server page.' },
  { icon: ChevronsUp, title: 'Stronger bumps', body: 'Bump every hour instead of every two, and stay near the top for longer.' },
  { icon: ChartColumn, title: 'Deeper stats', body: 'Views, joins and bumps day by day, so you can see what’s working.' },
  { icon: Pin, title: 'Featured spot', body: 'Take turns in the featured row on the home page and in matching searches.' },
  { icon: Link2, title: 'Custom link', body: 'A short yapboard.dev link with your server’s name in it.' },
  { icon: Timer, title: 'Priority review', body: 'Your edits and requests go to the front of the staff queue.' },
];

/** [feature, free, pro]: true for included, a string to spell out the difference. */
const COMPARE: [string, boolean | string, boolean | string][] = [
  ['Listing, tags and server page', true, true],
  ['Bump with /bump', 'Every 2 hours', 'Every hour'],
  ['View, join and bump totals', true, true],
  ['Day-by-day stats', false, true],
  ['Purple checkmark', false, true],
  ['Featured spot', false, true],
  ['Custom link', false, true],
  ['Priority review', false, true],
];

const FAQ: [string, string][] = [
  ['When is Pro coming?', 'Soon. We’re building it now and will announce it on YapBoard when it’s ready.'],
  ['How much will it cost?', 'We’ll share pricing at launch. It will be a simple monthly price per server, with no ads or upsells inside it.'],
  ['Will free listings change?', 'No. Everything that’s free today stays free. Pro adds to it.'],
  ['Does Pro change the rules?', 'No. Pro servers follow the same listing guidelines and can still be hidden or removed. The purple check means a server has Pro. It isn’t a staff check like Verified.'],
];

const GLYPHS: Record<'hero' | 'compare' | 'faq' | 'closer', ScatterItem[]> = {
  hero: [
    { g: 'hash', at: { left: '4%', top: '14%' }, size: 30, r: -12 },
    { g: 'squiggle', at: { left: '20%', top: '-6%' }, size: 34, r: 4 },
    { g: 'ring', at: { left: '12%', top: '60%' }, size: 18 },
    { g: 'asterisk', at: { left: '1%', top: '86%' }, size: 20, r: 10, accent: true },
    { g: 'chevrons', at: { right: '7%', top: '8%' }, size: 30, r: 8, accent: true },
    { g: 'plus', at: { right: '16%', top: '50%' }, size: 20, r: 14 },
    { g: 'check', at: { right: '2%', top: '80%' }, size: 26, r: -8 },
  ],
  // Outside the table, so wide screens only.
  compare: [
    { g: 'plus', at: { left: '-9%', top: '30%' }, size: 22, r: 8 },
    { g: 'zigzag', at: { left: '-12%', top: '62%' }, size: 30, r: -6, accent: true },
    { g: 'check', at: { right: '-9%', top: '22%' }, size: 26, r: -10, accent: true },
    { g: 'ring', at: { right: '-7%', top: '70%' }, size: 16 },
  ],
  faq: [
    { g: 'asterisk', at: { right: '6%', top: '-2%' }, size: 22, r: 12, accent: true },
    { g: 'squiggle', at: { right: '16%', top: '1%' }, size: 30, r: -4 },
  ],
  closer: [
    { g: 'chevrons', at: { left: '7%', top: '20%' }, size: 26, r: -10 },
    { g: 'ring', at: { left: '14%', bottom: '18%' }, size: 14, accent: true },
    { g: 'plus', at: { right: '9%', top: '24%' }, size: 18, r: 12, accent: true },
    { g: 'arrow', at: { right: '13%', bottom: '20%' }, size: 24, r: 6 },
  ],
};

export default function ProPage() {
  return (
    <div style={PURPLE}>
      {/* ---------- hero ---------- */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-14 sm:pt-20 text-center">
        <Reveal className="relative">
          <GlyphScatter items={GLYPHS.hero} />
          <p className="eyebrow inline-flex items-center gap-2">
            <BadgeMark kind="PRO" size={15} seed="pro" />
            YapBoard Pro
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-[40px] sm:text-[56px] font-extrabold leading-[1.02] tracking-[-0.02em]">
            Get your server <span className="text-accent">seen first.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[16.5px] leading-relaxed text-ink-2">A purple check, stronger bumps and deeper stats, for owners who want more from their listing.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            <span className="btn btn-primary btn-lg cursor-default">Coming soon</span>
            <a href="#perks" className="btn btn-secondary btn-lg group">
              See what’s included
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ListPreview />
        </Reveal>
      </section>

      {/* ---------- perks ---------- */}
      <section id="perks" className="mx-auto max-w-5xl px-4 sm:px-6 mt-24 scroll-mt-24">
        <Reveal>
          <h2 className="text-2xl sm:text-[28px] font-extrabold">What you get</h2>
          <p className="mt-1 text-sm text-ink-3">Everything in a free listing, plus:</p>
        </Reveal>
        <div className="mt-6 grid overflow-hidden rounded-2xl border border-line bg-line gap-px sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={Math.min(i, 5) * 0.03} className="bg-surface">
              <div className="group relative h-full overflow-hidden p-6">
                <Icon
                  aria-hidden
                  size={112}
                  strokeWidth={1}
                  className="pointer-events-none absolute -bottom-7 -right-6 text-ink/[0.035] transition-[color,rotate,translate] duration-500 ease-out-soft group-hover:-translate-y-1 group-hover:-rotate-6 group-hover:text-accent/[0.09]"
                />
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent transition-transform duration-300 ease-out-soft group-hover:-rotate-6">
                    <Icon size={18} />
                  </span>
                  <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="relative mt-5 font-bold">{title}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-ink-3">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- free vs pro ---------- */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-24">
        <Reveal className="relative">
          <GlyphScatter items={GLYPHS.compare} className="hidden lg:block" />
          <h2 className="text-2xl sm:text-[28px] font-extrabold">Free and Pro</h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="h-12 px-5 font-medium text-ink-3">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th className="w-[28%] px-3 text-center font-semibold text-ink-2">Free</th>
                  <th className="w-[28%] px-3 text-center font-semibold text-accent">
                    <span className="inline-flex items-center gap-1.5">
                      Pro <BadgeMark kind="PRO" size={14} seed="pro" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {COMPARE.map(([feature, free, pro]) => (
                  <tr key={feature}>
                    <td className="h-12 px-5 text-ink-2">{feature}</td>
                    <td className="px-3 text-center">
                      <Cell v={free} />
                    </td>
                    <td className="px-3 text-center bg-accent-soft/40">
                      <Cell v={pro} pro />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* ---------- faq ---------- */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-24">
        <Reveal className="relative">
          <GlyphScatter items={GLYPHS.faq} />
          <h2 className="text-2xl sm:text-[28px] font-extrabold">Questions</h2>
          <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span aria-hidden className="relative size-3.5 shrink-0 text-ink-3">
                    <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded bg-current" />
                    <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded bg-current transition-transform duration-200 group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="-mt-1 pb-5 text-sm leading-relaxed text-ink-3">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- closer ---------- */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-10 text-center">
            <GlyphScatter items={GLYPHS.closer} />
            <BadgeMark kind="PRO" size={30} seed="pro-cta" />
            <h2 className="mt-4 text-2xl font-extrabold">Pro is on the way</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-3">List your server for free now. When Pro launches, it’s one click to upgrade.</p>
            <Link href="/add" className="btn btn-primary mt-6 group">
              List your server
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function Cell({ v, pro }: { v: boolean | string; pro?: boolean }) {
  if (typeof v === 'string') return <span className={pro ? 'font-semibold text-ink' : 'text-ink-3'}>{v}</span>;
  if (v) return <Check size={16} className={`mx-auto ${pro ? 'text-accent' : 'text-ink-2'}`} aria-label="Included" />;
  return <Minus size={16} className="mx-auto text-ink-3/50" aria-label="Not included" />;
}

/** The list, with a Pro server on top: the same picture the Pro ad uses on /servers, larger. */
function ListPreview() {
  const rest: [string, string][] = [
    ['36%', '52%'],
    ['28%', '44%'],
  ];
  return (
    <div aria-hidden className="relative mx-auto mt-14 max-w-xl rounded-2xl border border-line bg-raised p-3 sm:p-4 text-left">
      <Note className="absolute right-full top-1 mr-1 hidden lg:flex">you, on top</Note>
      <Note flip className="absolute left-full top-1 ml-1 hidden lg:flex">
        bumped every hour
      </Note>
      <div className="flex items-center gap-3.5 rounded-xl border border-line-strong bg-surface p-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-accent-soft font-display text-lg font-extrabold text-accent">Y</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-display font-bold">
            Your server <BadgeMark kind="PRO" size={16} seed="pro-hero" />
          </div>
          <div className="mt-1 h-1.5 w-2/3 rounded-full bg-surface-3" />
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] text-ink-3">
          <ChevronsUp size={14} className="text-accent" />
          just now
        </span>
      </div>
      {rest.map(([a, b], i) => (
        <div key={i} className="flex items-center gap-3.5 px-3.5 py-3 opacity-50">
          <span className="size-9 shrink-0 rounded-[10px] bg-surface-3" />
          <div className="flex-1 space-y-2">
            <div className="h-2 rounded-full bg-surface-3" style={{ width: a }} />
            <div className="h-1.5 rounded-full bg-surface-2" style={{ width: b }} />
          </div>
        </div>
      ))}
    </div>
  );
}
