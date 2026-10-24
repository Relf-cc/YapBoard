'use client';

import { motion } from 'motion/react';
import { ServerCard } from './ServerCard';
import type { ServerCard as Card } from '@/lib/servers';

export function ServerGrid({ servers, activeTags, animationKey }: { servers: Card[]; activeTags?: string[]; animationKey?: string }) {
  return (
    <motion.div
      key={animationKey}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {servers.map((s) => (
        <ServerCard key={s.id} server={s} activeTags={activeTags} />
      ))}
    </motion.div>
  );
}
