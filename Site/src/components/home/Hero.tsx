'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { SearchBar } from '../SearchBar';

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({ tags }: { tags: { name: string; count: number }[] }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="dots absolute inset-0 -top-16" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-20 pb-14 sm:pt-28 text-center">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="eyebrow">
          The Yapin’ server list
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.05 }}
          className="mt-4 text-[44px] leading-[1.02] sm:text-[68px] font-extrabold"
        >
          Find a server worth{' '}
          <span className="relative inline-block whitespace-nowrap">
            yapping
            <Squiggle />
          </span>{' '}
          in.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.15 }} className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Thousands of Yapin’ communities for games, art, study, anime and everything else. Search by tag, language or size, then jump straight in.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.25 }} className="mt-9 text-left">
          <SearchBar size="lg" shortcut />
        </motion.div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.03, delayChildren: 0.4 } } }}
          className="mt-6 flex flex-wrap justify-center gap-2"
        >
          <span className="mr-1 self-center text-[13px] text-ink-3">Popular:</span>
          {tags.slice(0, 9).map((t) => (
            <motion.span key={t.name} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } } }}>
              <Link href={`/servers?tag=${encodeURIComponent(t.name)}`} className="chip">
                <span className="text-ink-3">#</span>
                {t.name}
              </Link>
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** Hand-drawn underline that draws itself in. */
function Squiggle() {
  return (
    <svg aria-hidden viewBox="0 0 220 24" preserveAspectRatio="none" className="absolute left-[-2%] -bottom-2 sm:-bottom-3 w-[104%] h-[0.32em] overflow-visible">
      <motion.path
        d="M3 15 C 30 5, 52 21, 78 12 S 128 4, 152 13 S 196 20, 217 8"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.55, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}
