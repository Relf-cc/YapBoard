import type { ReactNode } from 'react';
import Link from 'next/link';
import { Reveal } from './Reveal';

/** A paragraph, or `{ ul: [...] }` for a bullet list. */
export type ProseBlock = ReactNode | { ul: ReactNode[] };
export type ProseSection = { id: string; h: string; p: ProseBlock[] };

const isList = (b: ProseBlock): b is { ul: ReactNode[] } => typeof b === 'object' && b !== null && 'ul' in b;

export function ProseLink({ href, children }: { href: string; children: ReactNode }) {
  const cls = 'text-accent font-medium hover:underline';
  if (href.startsWith('mailto:')) return <a href={href} className={cls}>{children}</a>;
  if (/^https?:/.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
  return <Link href={href} className={cls}>{children}</Link>;
}

function Blocks({ blocks }: { blocks: ProseBlock[] }) {
  return blocks.map((b, j) =>
    isList(b) ? (
      <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-ink-3">
        {b.ul.map((li, k) => (
          <li key={k}>{li}</li>
        ))}
      </ul>
    ) : (
      <p key={j}>{b}</p>
    ),
  );
}

export function ProsePage({ title, updated, intro, summary, sections }: { title: string; updated?: string; intro?: ReactNode; summary?: ReactNode[]; sections: ProseSection[] }) {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-12">
      <Reveal>
        <h1 className="text-[34px] sm:text-[44px] font-extrabold">{title}</h1>
        {updated && <p className="mt-2 text-sm text-ink-3">Last updated {updated}</p>}
        {intro && <p className="mt-6 text-[15.5px] leading-relaxed text-ink-2">{intro}</p>}
      </Reveal>

      {summary && (
        <Reveal delay={0.03}>
          <div className="card mt-8 p-6">
            <h2 className="text-sm font-semibold text-ink">The short version</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2 marker:text-accent">
              {summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-3">This summary is here to help. The full text below is what applies.</p>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.05}>
        <nav aria-label="Contents" className="mt-8 border-l border-line pl-4">
          <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink-3 hover:text-ink transition-colors">
                  <span className="tabular-nums">{i + 1}.</span> {s.h}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Reveal>

      <div className="mt-12 space-y-10">
        {sections.map((s, i) => (
          <Reveal key={s.id} delay={Math.min(i, 4) * 0.03}>
            <section id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold">
                <span className="text-ink-3 tabular-nums">{i + 1}.</span> {s.h}
              </h2>
              <div className="mt-3 space-y-3 text-[15.5px] leading-relaxed text-ink-2">
                <Blocks blocks={s.p} />
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
