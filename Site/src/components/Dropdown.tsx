'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export type DropdownOption = { value: string; label: string };

type Props = {
  options: DropdownOption[];
  /** Controlled value. Leave out and pass `defaultValue` for plain forms. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Submits the value with the surrounding form, like a native select would. */
  name?: string;
  /** Accessible name; there's no visible label inside the trigger. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Dims the trigger while whatever the change kicked off is loading. */
  pending?: boolean;
  className?: string;
};

const SIZE = { sm: 'h-8 px-2.5 text-xs', md: 'h-10 text-sm', lg: '' };
const MENU_MAX = 288;

type Place = { left: number; width: number; maxHeight: number } & ({ top: number } | { bottom: number });

/**
 * A select that matches the rest of the site. Follows the select-only combobox pattern: focus stays on the
 * trigger, arrows/Home/End move, Enter or Space picks, Esc closes, and typing jumps to a matching option.
 * The menu is portalled and fixed so it isn't clipped by scrolling tables, and opens upwards near the bottom.
 */
export function Dropdown({ options, value, defaultValue, onChange, name, label, size = 'lg', disabled, pending, className }: Props) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);

  const current = value ?? inner;
  const selected = Math.max(0, options.findIndex((o) => o.value === current));
  const optId = (i: number) => `${id}-o${i}`;

  const pick = (i: number) => {
    const v = options[i]?.value;
    setOpen(false);
    if (v === undefined || v === current) return;
    setInner(v);
    onChange?.(v);
  };

  const show = () => {
    if (disabled) return;
    setActive(selected);
    setOpen(true);
  };

  // Position against the trigger, and keep it there while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 160);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < Math.min(MENU_MAX, options.length * 36 + 8) && above > below;
      setPlace(up ? { left, width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(MENU_MAX, above) } : { left, width, top: r.bottom + 6, maxHeight: Math.min(MENU_MAX, below) });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, options.length]);

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-o${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, open, active, place]);

  // The menu is portalled into <body>, which only exists once we're on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      if (!open) show();
      setActive(Math.max(0, Math.min(last, i)));
    };
    switch (e.key) {
      case 'ArrowDown':
        return open ? move(active + 1) : move(selected);
      case 'ArrowUp':
        return open ? move(active - 1) : move(selected);
      case 'Home':
        return move(0);
      case 'End':
        return move(last);
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) pick(active);
        else show();
        return;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        return;
      case 'Tab':
        if (open) pick(active);
        return;
    }
    // Type-ahead: letters typed close together build up a prefix to match.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const t = typed.current;
      t.text = (now - t.at < 600 ? t.text : '') + e.key.toLowerCase();
      t.at = now;
      const from = open ? active : selected;
      const order = [...options.keys()].map((k) => (from + 1 + k) % options.length);
      const hit = order.find((i) => options[i].label.toLowerCase().startsWith(t.text)) ?? order.find((i) => options[i].label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (hit !== undefined) {
        e.preventDefault();
        if (open) setActive(hit);
        else pick(hit);
      }
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? optId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={clsx(
          'field flex items-center justify-between gap-2 text-left cursor-pointer transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
          SIZE[size],
          open && 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]',
          pending && 'opacity-60',
          className,
        )}
      >
        <span className="truncate">{options[selected]?.label}</span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className={clsx('shrink-0 text-ink-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {name && <input type="hidden" name={name} value={current} />}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && place && (
              <motion.ul
                ref={menu}
                id={`${id}-list`}
                role="listbox"
                aria-label={label}
                initial={{ opacity: 0, y: 'top' in place ? -4 : 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 'top' in place ? -4 : 4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                style={{ ...place, position: 'fixed', transformOrigin: 'top' in place ? 'top' : 'bottom' } as CSSProperties}
                className="z-[90] overflow-y-auto overscroll-contain rounded-xl border border-line-strong bg-surface p-1 shadow-[0_16px_40px_-12px_#000e]"
              >
                {options.map((o, i) => (
                  <li
                    key={o.value}
                    id={optId(i)}
                    role="option"
                    aria-selected={i === selected}
                    onPointerMove={() => setActive(i)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      pick(i);
                      btn.current?.focus();
                    }}
                    className={clsx(
                      'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 select-none transition-colors',
                      size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
                      i === active ? 'bg-surface-2 text-ink' : 'text-ink-2',
                      i === selected && 'font-semibold text-ink',
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {i === selected && <Check size={14} className="shrink-0 text-accent" />}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
