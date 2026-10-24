'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';

type Side = 'top' | 'bottom';
type Pos = { x: number; y: number; side: Side; arrow: number };

const GAP = 8;
const EDGE = 8;
// Moving from one tooltip to the next shortly after skips the open delay, like native menus.
let lastClosed = 0;

/**
 * Hover/focus tooltip rendered in a portal, so cards with overflow-hidden can't clip it.
 * Prefers `side`, flips when there's no room, and stays inside the viewport.
 */
export function Tooltip({ content, children, side = 'top', delay = 160, className }: { content: ReactNode; children: ReactNode; side?: Side; delay?: number; className?: string }) {
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  const show = (wait = delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), Date.now() - lastClosed < 400 ? 0 : wait);
  };
  const hide = () => {
    clearTimeout(timer.current);
    if (open) lastClosed = Date.now();
    setOpen(false);
  };

  // Measure before paint so it never flashes in the wrong place.
  useLayoutEffect(() => {
    if (!open || !trigger.current || !tip.current) return;
    const r = trigger.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    let s: Side = side;
    let y = s === 'top' ? r.top - t.height - GAP : r.bottom + GAP;
    if (s === 'top' && y < EDGE) {
      s = 'bottom';
      y = r.bottom + GAP;
    } else if (s === 'bottom' && y + t.height > window.innerHeight - EDGE) {
      s = 'top';
      y = r.top - t.height - GAP;
    }
    const center = r.left + r.width / 2;
    const x = Math.min(Math.max(EDGE, center - t.width / 2), window.innerWidth - t.width - EDGE);
    setPos({ x, y, side: s, arrow: center - x });
  }, [open, side]);

  // Anything that moves the trigger closes the tooltip rather than leaving it floating.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const s = pos?.side ?? side;

  return (
    <>
      <span
        ref={trigger}
        className={clsx('inline-flex', className)}
        onPointerEnter={(e) => e.pointerType !== 'touch' && show()}
        onPointerLeave={hide}
        onFocus={() => show(0)}
        onBlur={hide}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={tip}
                id={id}
                role="tooltip"
                initial={{ opacity: 0, scale: 0.96, y: s === 'top' ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
                transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                style={{ position: 'fixed', left: pos?.x ?? -9999, top: pos?.y ?? -9999, transformOrigin: `${pos?.arrow ?? 0}px ${s === 'top' ? '100%' : '0%'}` }}
                className="pointer-events-none z-[100] max-w-[260px] rounded-[10px] border border-line-strong bg-[#0c0d0f] px-3 py-2 text-[12.5px] leading-snug text-ink-2 shadow-[0_12px_32px_-8px_#000d]"
              >
                {content}
                <span
                  aria-hidden
                  className={clsx('absolute size-2.5 rotate-45 border-line-strong bg-[#0c0d0f]', s === 'top' ? '-bottom-[6px] border-r border-b' : '-top-[6px] border-l border-t')}
                  style={{ left: (pos?.arrow ?? 0) - 5 }}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
