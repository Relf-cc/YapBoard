import Link from 'next/link';
import type { CSSProperties } from 'react';
import { SearchBar } from '../SearchBar';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export function Hero({ tags }: { tags: { name: string; count: number }[] }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="dots absolute inset-0 -top-16" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-20 pb-14 sm:pt-28 text-center">
        <h1 className="rise text-[44px] leading-[1.02] sm:text-[68px] font-extrabold" style={d(60)}>
          Find a server worth{' '}
          <span className="relative inline-block whitespace-nowrap">
            yapping
            <Squiggle />
          </span>{' '}
          in.
        </h1>
        <p className="rise mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2" style={d(150)}>
          Thousands of Yapin’ communities for games, art, study, anime and everything else. Search by tag, language or size, then jump straight in.
        </p>

        <div className="rise relative z-10 mt-9 text-left" style={d(240)}>
          <SearchBar size="lg" shortcut />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <span className="rise mr-1 self-center text-[13px] text-ink-3" style={d(380)}>
            Popular:
          </span>
          {tags.slice(0, 9).map((t, i) => (
            <Link key={t.name} href={`/servers?tag=${encodeURIComponent(t.name)}`} className="chip rise" style={{ ...d(400 + i * 35), '--rise-y': '6px' } as CSSProperties}>
              <span className="text-ink-3">#</span>
              {t.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Hand-drawn underline that draws itself in. */
function Squiggle() {
  return (
    <svg aria-hidden viewBox="0 0 220 24" preserveAspectRatio="none" className="absolute left-[-2%] -bottom-2 sm:-bottom-3 w-[104%] h-[0.32em] overflow-visible">
      <path
        className="draw"
        pathLength={1}
        d="M3 15 C 30 5, 52 21, 78 12 S 128 4, 152 13 S 196 20, 217 8"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
