'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Link2 } from 'lucide-react';

export function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-secondary btn-lg w-[132px]"
      onClick={async () => {
        await navigator.clipboard.writeText(new URL(url, location.origin).toString()).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? 'y' : 'n'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-2"
        >
          {copied ? <Check size={16} className="text-ok" /> : <Link2 size={16} />}
          {copied ? 'Copied' : 'Copy link'}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
