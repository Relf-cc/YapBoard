import Link from 'next/link';
import { ArrowRight, Bot, ChevronsUp, PenLine } from 'lucide-react';
import { db } from '@/lib/db';
import { cardSelect, toCard } from '@/lib/servers';
import { popularTags } from '@/lib/search';
import { Hero } from '@/components/home/Hero';
import { BumpMarquee } from '@/components/home/BumpMarquee';
import { ServerGrid } from '@/components/ServerGrid';
import { CountUp } from '@/components/CountUp';
import { Reveal } from '@/components/Reveal';
import { Glyph, type GlyphName } from '@/components/Glyphs';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const listed = { status: 'PUBLIC', nsfw: false };
  const dayAgo = new Date(Date.now() - 864e5);
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [tags, bumped, fresh, stats, bumpsToday] = await Promise.all([
    popularTags(24),
    db.server.findMany({ where: listed, select: cardSelect, orderBy: { bumpedAt: { sort: 'desc', nulls: 'last' } }, take: 18 }),
    db.server.findMany({ where: { ...listed, createdAt: { gte: weekAgo } }, select: cardSelect, orderBy: { createdAt: 'desc' }, take: 3 }),
    db.server.aggregate({ where: { status: 'PUBLIC' }, _count: true, _sum: { memberCount: true } }),
    db.bump.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);
  const cards = bumped.map(toCard);

  return (
    <>
      <Hero tags={tags} />

      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface">
          <Stat label="servers listed" value={stats._count} />
          <Stat label="members reached" value={stats._sum.memberCount ?? 0} />
          <Stat label="bumps today" value={bumpsToday} />
        </div>
      </section>

      <section className="mt-14">
        <BumpMarquee items={cards.slice(6).map((c) => ({ id: c.id, name: c.name, iconUrl: c.iconUrl, bumpedAt: c.bumpedAt }))} />
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16">
        <SectionHead title="Recently bumped" sub="Fresh at the top. Servers bump every 2 hours to stay here." href="/servers" />
        <ServerGrid servers={cards.slice(0, 6)} />
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-20">
        <SectionHead title="Browse by tag" sub="Every server picks up to five tags." href="/tags" cta="All tags" />
        <Reveal>
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {tags.slice(0, 12).map((t, i) => (
              <Link
                key={t.name}
                href={`/servers?tag=${encodeURIComponent(t.name)}`}
                className="group relative overflow-hidden rounded-xl border border-line bg-surface px-4 py-3.5 hover:border-line-strong transition-colors"
              >
                <span className="font-display font-bold text-[15px]">
                  <span className="text-accent mr-0.5 transition-transform inline-block group-hover:-rotate-12">#</span>
                  {t.name}
                </span>
                <span className="block text-xs text-ink-3 mt-0.5 tabular-nums">{t.count} servers</span>
                <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-[34px] font-display font-extrabold text-ink/[0.035] select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {fresh.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-20">
          <SectionHead title="New this week" sub="Say hi before everyone else does." href="/servers?sort=new" />
          <ServerGrid servers={fresh.map(toCard)} />
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface">
            <div className="grid lg:grid-cols-[1fr_1.4fr]">
              <div className="p-8 sm:p-10 border-b lg:border-b-0 lg:border-r border-line">
                <p className="eyebrow">For server owners</p>
                <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold leading-tight">Get your server in front of people who’ll actually stay.</h2>
                <p className="mt-4 text-ink-2 leading-relaxed">Listing is free. Add the bot, write a page that sounds like you, and bump when you’re around.</p>
                <Link href="/add" className="btn btn-primary btn-lg mt-8 group">
                  List your server
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
              <ol className="grid sm:grid-cols-3">
                <Step n={1} icon={<Bot size={18} />} title="Add the bot" body="Add YapBoard to your server from Server settings → Bots. It's how we know the server is yours." />
                <Step n={2} icon={<PenLine size={18} />} title="Write your page" body="A one-liner, a longer description, an invite link and up to five tags." />
                <Step n={3} icon={<ChevronsUp size={18} />} title="Bump it" body="Type /bump in your server every 2 hours to move back to the top of the list." last />
              </ol>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-5 sm:py-6 text-center">
      <div className="font-display text-2xl sm:text-[32px] font-extrabold leading-none">
        <CountUp value={value} />
      </div>
      <div className="mt-2 text-[12.5px] sm:text-[13px] text-ink-3">{label}</div>
    </div>
  );
}

function SectionHead({ title, sub, href, cta = 'See all' }: { title: string; sub: string; href: string; cta?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        <h2 className="text-2xl sm:text-[28px] font-extrabold">{title}</h2>
        <p className="mt-1 text-sm text-ink-3">{sub}</p>
      </div>
      <Link href={href} className="group shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-accent transition-colors">
        {cta}
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

const STEP_GLYPHS: GlyphName[] = ['plus', 'squiggle', 'chevrons'];

function Step({ n, icon, title, body, last }: { n: number; icon: React.ReactNode; title: string; body: string; last?: boolean }) {
  return (
    <li className={`group relative p-8 ${last ? '' : 'border-b sm:border-b-0 sm:border-r border-line'}`}>
      <Glyph
        name={STEP_GLYPHS[n - 1]}
        size={28}
        className="absolute bottom-6 right-6 text-ink-3/25 transition-[color,rotate] duration-500 ease-out-soft group-hover:-rotate-12 group-hover:text-accent/60"
      />
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
        <span className="font-mono text-xs text-ink-3">0{n}</span>
      </div>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">{body}</p>
    </li>
  );
}
