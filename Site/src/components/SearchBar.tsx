'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, Hash, Search, Users } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { compact } from '@/lib/format';

type Suggest = {
  tags: { name: string; count: number }[];
  servers: { id: string; name: string; iconUrl: string | null; memberCount: number; badge: string | null }[];
};
type Option = { key: string; href: string; kind: 'query' | 'tag' | 'server'; label: string; meta?: string; server?: Suggest['servers'][number] };

export function SearchBar({ defaultValue = '', size = 'md', autoFocus = false, shortcut = false }: { defaultValue?: string; size?: 'md' | 'lg'; autoFocus?: boolean; shortcut?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggest>({ tags: [], servers: [] });
  const [active, setActive] = useState(0);

  useEffect(() => setQ(defaultValue), [defaultValue]);

  // Debounced suggestions; stale responses are dropped by the abort.
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setData({ tags: [], servers: [] });
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: Suggest) => {
          setData(d);
          setActive(0);
        })
        .catch(() => {});
    }, 140);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  // "/" focuses the search from anywhere.
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea|select/i.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const term = q.trim();
  const options: Option[] = term
    ? [
        { key: 'q', href: `/servers?q=${encodeURIComponent(term)}`, kind: 'query', label: term },
        ...data.tags.map((t) => ({ key: `t:${t.name}`, href: `/servers?tag=${encodeURIComponent(t.name)}`, kind: 'tag' as const, label: t.name, meta: `${t.count} server${t.count === 1 ? '' : 's'}` })),
        ...data.servers.map((s) => ({ key: `s:${s.id}`, href: `/view/${s.id}`, kind: 'server' as const, label: s.name, meta: compact(s.memberCount), server: s })),
      ]
    : [];
  const show = open && options.length > 0;

  const go = (o: Option | undefined) => {
    if (!o) return;
    setOpen(false);
    input.current?.blur();
    router.push(o.href);
  };

  const lg = size === 'lg';

  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(show ? options[active] : { key: 'q', href: term ? `/servers?q=${encodeURIComponent(term)}` : '/servers', kind: 'query', label: term });
        }}
        className={clsx(
          'group relative flex items-center rounded-xl border bg-raised transition-[border-color,box-shadow] duration-200',
          'border-line-strong hover:border-[#44454f] focus-within:!border-accent focus-within:shadow-[0_0_0_4px_var(--accent-soft)]',
          lg ? 'h-14 pl-5 pr-2' : 'h-10 pl-3.5 pr-1.5',
        )}
      >
        <Search size={lg ? 20 : 16} className="shrink-0 text-ink-3 transition-colors group-focus-within:text-accent" />
        <input
          ref={input}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % options.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a - 1 + options.length) % options.length);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={lg ? 'Search servers, games, communities, #tags…' : 'Search servers'}
          className={clsx('min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3', lg ? 'px-3.5 text-[17px]' : 'px-2.5 text-sm')}
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search servers"
        />
        {lg ? (
          <button type="submit" className="btn btn-primary h-10 px-5">
            Search
          </button>
        ) : (
          shortcut && <span className="kbd mr-1.5 hidden sm:inline-flex">/</span>
        )}
      </form>

      <AnimatePresence>
        {show && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 left-0 right-0 mt-2 p-1.5 rounded-xl border border-line-strong bg-surface shadow-[0_16px_40px_-12px_#000c] origin-top"
          >
            {options.map((o, i) => (
              <li key={o.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(o)}
                  className={clsx('relative w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm', i === active ? 'text-ink' : 'text-ink-2')}
                >
                  {i === active && <motion.span layoutId={`${listId}-hl`} className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />}
                  <span className="relative flex items-center gap-3 min-w-0 flex-1">
                    {o.kind === 'query' && <Search size={15} className="text-ink-3 shrink-0" />}
                    {o.kind === 'tag' && <Hash size={15} className="text-accent shrink-0" />}
                    {o.kind === 'server' && o.server && <Avatar src={o.server.iconUrl} name={o.server.name} id={o.server.id} size={22} />}
                    <span className="truncate">
                      {o.kind === 'query' ? (
                        <>
                          Search for <span className="font-semibold text-ink">“{o.label}”</span>
                        </>
                      ) : (
                        o.label
                      )}
                    </span>
                    {o.server && <Badge kind={o.server.badge} seed={o.server.id} size={14} />}
                  </span>
                  <span className="relative shrink-0 text-xs text-ink-3 inline-flex items-center gap-1">
                    {o.kind === 'server' && <Users size={12} />}
                    {o.meta}
                    {i === active && o.kind === 'query' && <CornerDownLeft size={13} />}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
