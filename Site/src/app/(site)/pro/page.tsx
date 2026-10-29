// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { ArrowRight, Check, Hash, Images, Link2, Minus, Paintbrush, ScrollText, type LucideIcon } from 'lucide-react';
import { BadgeMark } from '@/components/Badge';
import { Reveal } from '@/components/Reveal';
import { GlyphScatter, Note, type ScatterItem } from '@/components/Glyphs';
import { ProCheckout } from '@/components/pro/ProCheckout';
import { billingEnabled } from '@/lib/env';
import { freeLimits, planState, proLimits, PRICING } from '@/lib/pro';
import { getUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'YapBoard Pro',
  description: 'Screenshots, a header style, extra buttons, twice the tags and a much longer description - for your server, bot and client.',
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

const free = freeLimits('server');
const pro = proLimits('server');

/**
 * What Pro actually does, in the order it's worth paying for.
 *
 * Every line here is a field the forms and the listing pages really gate on `isPro` - src/lib/pro.ts is
 * the one place that decides, and src/lib/pro-fields.ts holds the numbers quoted below. Nothing on this
 * page is a plan; if it's written here, it works.
 */
const PERKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Images, title: 'Screenshots', body: `A gallery on your page, up to ${pro.screenshots} images. People decide from pictures long before they read a word.` },
  { icon: Paintbrush, title: 'Header style', body: 'Four ways to draw the top of your page, built from your own accent colour, instead of the default.' },
  { icon: Link2, title: 'Extra buttons', body: `Up to ${pro.links} of your own buttons beside Join - a website, a wiki, a shop, your YouTube.` },
  { icon: Hash, title: 'Twice the tags', body: `${pro.tags} instead of ${free.tags}, so you turn up in more of the searches that fit. Tags are discovery, not ranking.` },
  { icon: ScrollText, title: 'Room to write', body: `${pro.description.toLocaleString()} characters instead of ${free.description.toLocaleString()}, with full Markdown.` },
  { icon: Check, title: 'The Pro mark', body: 'On your cards and your page, so people can see the listing is looked after. Not a staff check.' },
];

/** [feature, free, pro]: true for included, a string to spell out the difference. */
const COMPARE: [string, boolean | string, boolean | string][] = [
  ['Listing, tags and page', true, true],
  ['Bump with /bump', 'Every 2 hours', 'Every 2 hours'],
  ['Where you rank', 'Bumps and votes', 'Bumps and votes'],
  ['Tags', String(free.tags), String(pro.tags)],
  ['Description', `${free.description.toLocaleString()} characters`, `${pro.description.toLocaleString()} characters`],
  ['Screenshot gallery', false, `Up to ${pro.screenshots}`],
  ['Header style', false, '4 styles'],
  ['Extra buttons', false, `Up to ${pro.links}`],
  ['The Pro mark', false, true],
];

const FAQ: [string, string][] = [
  [
    'Does Pro push my server up the board?',
    'No, and it never will. Where a server sits is decided by bumps and votes, and anyone in your server can bump it every two hours whether you pay or not. Pro makes your listing better, not better-placed - the day the front page can be bought is the day nobody bothers bumping.',
  ],
  [
    'What does it cost?',
    `${PRICING.symbol}${PRICING.base.monthly} a month covers one server, one bot and one client. Each extra listing of any kind is ${PRICING.symbol}${PRICING.slot.monthly} a month more, so three servers and a bot is ${PRICING.symbol}${PRICING.base.monthly + PRICING.slot.monthly * 2} a month. The annual plan is two months free. Prices are in ${PRICING.currency}.`,
  ],
  [
    'Which of my listings does it cover?',
    'You choose. A plan comes with one slot for a server, one for a bot and one for a client, and you point each at whichever listing you like from its manage page. Extra slots float - use them on whatever mix you want, and move them whenever.',
  ],
  [
    'What if I cancel?',
    'Nothing is deleted, ever. Your gallery, header style and extra buttons stop showing and sit waiting; the tags and the description you already wrote stay exactly where they are, and stay editable. What you lose is the ability to add more. Come back and the page is as you left it.',
  ],
  ['Will free listings change?', 'No. Everything that’s free today stays free. Pro adds to it, and never takes anything away to sell it back.'],
  [
    'Does Pro change the rules?',
    'No. Pro listings follow the same guidelines and can still be hidden or removed, on exactly the same terms. The Pro mark says a listing is on a plan. It isn’t a staff check like Verified.',
  ],
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

export default async function ProPage() {
  const user = await getUser();
  const plan = await planState(user?.id);
  const onSale = billingEnabled();

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
            Your listing, <span className="text-accent">properly.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-2">
            Screenshots, a header style, your own buttons, twice the tags and room to actually write. One plan covers a server, a bot and a client.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-3">
            It doesn&rsquo;t touch where you rank. Bumps and votes decide that, free or not.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <PagePreview />
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
        <Reveal>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
            Bot listings get the tags, the description and the mark - there&rsquo;s nowhere on a bot page for a gallery yet. Client listings get {proLimits('client').screenshots}{' '}
            screenshots instead of {freeLimits('client').screenshots}, since they&rsquo;ve always had a gallery and a header style for free.
          </p>
        </Reveal>
      </section>

      {/* ---------- price ---------- */}
      <section id="price" className="mx-auto max-w-5xl px-4 sm:px-6 mt-24 scroll-mt-24">
        <Reveal>
          <div className="text-center">
            <h2 className="text-2xl sm:text-[28px] font-extrabold">One plan, three boards</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
              A server, a bot and a client are covered from the start. Running more than one of something? Add a listing for {PRICING.symbol}
              {PRICING.slot.monthly} a month.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.06} className="mt-8">
          <ProCheckout plan={plan} loggedIn={!!user} onSale={onSale} />
        </Reveal>
      </section>

      {/* ---------- free vs pro ---------- */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-24">
        <Reveal className="relative">
          <GlyphScatter items={GLYPHS.compare} className="hidden lg:block" />
          <h2 className="text-2xl sm:text-[28px] font-extrabold">Free and Pro</h2>
          <p className="mt-1 text-sm text-ink-3">For a server listing.</p>
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
                {COMPARE.map(([feature, freeCell, proCell]) => (
                  <tr key={feature}>
                    <td className="h-12 px-5 text-ink-2">{feature}</td>
                    <td className="px-3 text-center">
                      <Cell v={freeCell} />
                    </td>
                    <td className="px-3 text-center bg-accent-soft/40">
                      <Cell v={proCell} pro />
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
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold">
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
            <h2 className="mt-4 text-2xl font-extrabold">{plan.active ? 'Pick your listings' : 'Make your listing worth clicking'}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-3">
              {plan.active
                ? 'Open any listing you own and put it on Pro from its manage page.'
                : 'Free listings stay free, and always will. Pro is for when you want the page to do more work.'}
            </p>
            <Link href={plan.active ? '/dashboard' : onSale ? '#price' : '/add'} className="btn btn-primary mt-6 group">
              {plan.active ? 'Your listings' : onSale ? 'See the price' : 'List your server'}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function Cell({ v, pro: isPro }: { v: boolean | string; pro?: boolean }) {
  if (typeof v === 'string') return <span className={isPro ? 'font-semibold text-ink' : 'text-ink-3'}>{v}</span>;
  if (v) return <Check size={16} className={`mx-auto ${isPro ? 'text-accent' : 'text-ink-2'}`} aria-label="Included" />;
  return <Minus size={16} className="mx-auto text-ink-3/50" aria-label="Not included" />;
}

/**
 * A small drawing of a Pro listing page: the header style, the mark, a gallery and the extra buttons.
 *
 * It replaces an older picture of the board with a Pro server sitting on top of it, which sold placement
 * Pro doesn't buy. This one only shows things Pro actually does.
 */
function PagePreview() {
  return (
    <div aria-hidden className="relative mx-auto mt-14 max-w-xl overflow-hidden rounded-2xl border border-line bg-raised text-left">
      <Note className="absolute right-full top-6 mr-1 hidden lg:flex">your header</Note>
      <Note flip className="absolute left-full top-24 ml-1 hidden lg:flex">
        your gallery
      </Note>

      {/* header */}
      <div className="relative h-20 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--accent) 34%, var(--bg))' }}>
        <span className="absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--accent) 70%, transparent) 1px, transparent 0)', backgroundSize: '14px 14px' }} />
        <span className="absolute -left-6 -bottom-8 size-28 rounded-full opacity-50 blur-2xl" style={{ background: 'var(--accent)' }} />
        <span className="absolute inset-0 bg-gradient-to-t from-raised/90 to-transparent" />
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {/* name + mark */}
        <div className="-mt-6 flex items-end gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-accent-soft font-display text-lg font-extrabold text-accent ring-[4px] ring-raised">Y</span>
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="flex items-center gap-1.5 font-display text-[15px] font-bold">
              Your server <BadgeMark kind="PRO" size={15} seed="pro-hero" />
            </div>
            <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-surface-3" />
          </div>
        </div>

        {/* buttons */}
        <div className="mt-4 flex gap-2">
          <span className="h-7 w-20 rounded-lg bg-accent" />
          <span className="h-7 w-16 rounded-lg border border-line-strong bg-surface" />
          <span className="h-7 w-16 rounded-lg border border-line-strong bg-surface" />
        </div>

        {/* gallery */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="relative block h-16 overflow-hidden rounded-lg border border-line bg-surface">
              <span className="absolute inset-0 opacity-40" style={{ background: `linear-gradient(${120 + i * 40}deg, color-mix(in srgb, var(--accent) 45%, transparent), transparent)` }} />
            </span>
          ))}
        </div>

        {/* description */}
        <div className="mt-4 space-y-1.5">
          <span className="block h-1.5 w-full rounded-full bg-surface-3" />
          <span className="block h-1.5 w-[92%] rounded-full bg-surface-3" />
          <span className="block h-1.5 w-[78%] rounded-full bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
