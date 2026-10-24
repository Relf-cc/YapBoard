'use client';

import { animate, useInView, useMotionValue, useTransform, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { compact } from '@/lib/format';

export function CountUp({ value, format = 'compact' }: { value: number; format?: 'compact' | 'plain' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => (format === 'compact' ? compact(Math.round(v)) : Math.round(v).toLocaleString()));
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [inView, mv, value]);
  return <motion.span ref={ref} className="tabular-nums">{text}</motion.span>;
}
