'use client';

import { useEffect, useId, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

/**
 * A centred dialog on every screen size: dimmed backdrop, small card, Escape or a click outside closes it.
 * Wrap it in <AnimatePresence> so it animates out too.
 */
export function Modal({ title, sub, onClose, children }: { title?: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field (or the dialog) so keyboard users start inside it.
    (panel.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])') ?? panel.current)?.focus();
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-title` : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 4 }}
        transition={{ type: 'spring', stiffness: 520, damping: 38 }}
        className="relative w-full max-w-[420px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-left shadow-xl outline-none"
      >
        <button data-close onClick={onClose} className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-raised hover:text-ink" aria-label="Close">
          <X size={16} />
        </button>
        {title && (
          <h2 id={`${id}-title`} className="pr-8 text-lg font-bold leading-snug text-ink">
            {title}
          </h2>
        )}
        {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
        {children}
      </motion.div>
    </motion.div>
  );
}

/** The "sent" state both report dialogs end on. */
export function ModalDone({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="py-4 text-center">
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.05 }}
        className="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-ok/15 text-ok"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.15 }} />
        </svg>
      </motion.span>
      <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink-3">{children}</p>
      <button onClick={onClose} className="btn btn-secondary btn-sm mt-6">
        Close
      </button>
    </motion.div>
  );
}
