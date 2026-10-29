'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Hash, X } from 'lucide-react';
import clsx from 'clsx';
import { MAX_TAGS, normalizeTag } from '@/lib/tags';

/** `max` is the listing's own cap, which YapBoard Pro raises (src/lib/pro-fields.ts). */
export function TagInput({ value, onChange, invalid, max = MAX_TAGS }: { value: string[]; onChange: (tags: string[]) => void; invalid?: boolean; max?: number }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; count: number }[]>([]);
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const full = value.length >= max;

  useEffect(() => {
    const t = normalizeTag(text);
    if (!t) return setSuggestions([]);
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(t)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => {
          setSuggestions((d.tags as { name: string; count: number }[]).filter((s) => !value.includes(s.name)));
          setActive(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [text, value]);

  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (t && !value.includes(t) && !full) onChange([...value, t]);
    setText('');
    setSuggestions([]);
  };

  const showList = focus && !full && suggestions.length > 0;

  return (
    <div className="relative">
      <div
        onClick={() => input.current?.focus()}
        className={clsx(
          'field h-auto min-h-11 flex flex-wrap items-center gap-1.5 py-1.5 cursor-text',
          focus && '!border-accent shadow-[0_0_0_3px_var(--accent-soft)]',
          invalid && !focus && '!border-danger/60',
        )}
      >
        <AnimatePresence initial={false}>
          {value.map((t) => (
            <motion.span
              key={t}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="chip chip-active pr-1"
            >
              #{t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((x) => x !== t));
                }}
                className="rounded-full p-0.5 hover:bg-accent/20"
              >
                <X size={12} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          ref={input}
          value={text}
          disabled={full}
          onChange={(e) => {
            if (/[,\s]$/.test(e.target.value)) add(e.target.value);
            else setText(e.target.value);
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            if (text) add(text);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(showList ? suggestions[active].name : text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
            else if (e.key === 'ArrowDown' && showList) {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp' && showList) {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
            }
          }}
          placeholder={full ? '' : value.length ? 'Add another…' : 'gaming, anime, study…'}
          className="min-w-[120px] flex-1 bg-transparent outline-none text-[15px] placeholder:text-ink-3 h-7"
          aria-label="Add a tag"
        />
        <span className="ml-auto pr-0.5 text-xs text-ink-3 tabular-nums">
          {value.length}/{max}
        </span>
      </div>

      <AnimatePresence>
        {showList && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            className="absolute z-20 mt-1.5 w-full rounded-xl border border-line-strong bg-surface p-1 shadow-xl"
          >
            {suggestions.map((s, i) => (
              <li key={s.name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(s.name)}
                  className={clsx('w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left', i === active ? 'bg-surface-2 text-ink' : 'text-ink-2')}
                >
                  <Hash size={14} className="text-accent" />
                  {s.name}
                  <span className="ml-auto text-xs text-ink-3">{s.count} servers</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
