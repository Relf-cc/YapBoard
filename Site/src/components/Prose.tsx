import { Reveal } from './Reveal';

export function ProsePage({ title, updated, sections }: { title: string; updated?: string; sections: { h: string; p: string[] }[] }) {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-12">
      <Reveal>
        <h1 className="text-[34px] sm:text-[44px] font-extrabold">{title}</h1>
        {updated && <p className="mt-2 text-sm text-ink-3">Last updated {updated}</p>}
      </Reveal>
      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <Reveal key={s.h} delay={Math.min(i, 4) * 0.03}>
            <section>
              <h2 className="text-xl font-bold">{s.h}</h2>
              <div className="mt-3 space-y-3 text-[15.5px] leading-relaxed text-ink-2">
                {s.p.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
