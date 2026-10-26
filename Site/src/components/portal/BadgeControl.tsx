'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { clearBadges, clearBotBadges, toggleBadge, toggleBotBadge } from '@/app/portal/actions';
import { BADGES, BADGE_ORDER, sortBadges, type BadgeKind } from '@/lib/badges';
import { BadgeMark, BadgeRow } from '../Badge';

const PANEL_W = 268;

/**
 * Staff badge picker: every badge in src/lib/badges.ts as a toggle, so a listing can hold several.
 * Each click saves on its own and rolls back if the action fails. The same picker serves both boards.
 */
export function BadgeControl({ id, badges, kind = 'server' }: { id: string; badges: readonly string[]; kind?: 'server' | 'bot' }) {
  const [held, setHeld] = useState(() => sortBadges(badges));
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);

  // Fixed and portalled so the scrolling table can't clip it; flips up near the bottom of the window.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8));
      const below = window.innerHeight - r.bottom - 12;
      setPlace(below < 340 && r.top > below ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
    };
    measure();
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const save = (next: BadgeKind[], run: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    const prev = held;
    setHeld(next);
    start(async () => {
      const r = await run();
      if (!r.ok) {
        setHeld(prev);
        alert(r.error);
      }
    });
  };

  const toggle = (badge: BadgeKind) => {
    const on = !held.includes(badge);
    save(on ? sortBadges([...held, badge]) : held.filter((k) => k !== badge), () =>
      kind === 'bot' ? toggleBotBadge({ botId: id, badge, on }) : toggleBadge({ serverId: id, badge, on }),
    );
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={held.length ? `Badges: ${held.map((k) => BADGES[k].label).join(', ')}` : 'Add a badge'}
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised pl-2 pr-1.5 transition-colors hover:border-line-strong disabled:opacity-60',
          open && 'border-accent',
        )}
      >
        {held.length ? <BadgeRow kinds={held} size={16} seed={id} max={3} tooltip={false} /> : <span className="text-xs text-ink-3">None</span>}
        <ChevronDown size={13} className={clsx('shrink-0 text-ink-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && place && (
              <motion.div
                ref={panel}
                role="menu"
                aria-label="Badges"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                style={{ ...place, position: 'fixed', width: PANEL_W }}
                className="z-[90] rounded-xl border border-line-strong bg-surface p-1 shadow-[0_16px_40px_-12px_#000e]"
              >
                <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Badges</p>
                {BADGE_ORDER.map((k) => {
                  const on = held.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      disabled={pending}
                      onClick={() => toggle(k)}
                      className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors', on ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                    >
                      <BadgeMark kind={k} size={18} seed={id + k} className={on ? undefined : 'opacity-50'} />
                      <span className="min-w-0 flex-1">
                        <span className={clsx('block text-[13px] font-semibold', on ? 'text-ink' : 'text-ink-2')}>{BADGES[k].label}</span>
                        <span className="block truncate text-[11px] text-ink-3">{BADGES[k].long}</span>
                      </span>
                      {on && <Check size={14} className="shrink-0 text-accent" />}
                    </button>
                  );
                })}
                {held.length > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save([], () => (kind === 'bot' ? clearBotBadges(id) : clearBadges(id)))}
                    className="mt-1 w-full rounded-lg border-t border-line px-2.5 py-2 text-[12px] font-semibold text-ink-3 transition-colors hover:text-danger"
                  >
                    Remove all
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
