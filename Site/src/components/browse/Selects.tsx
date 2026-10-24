'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useTransition } from 'react';
import clsx from 'clsx';

/** Updates one query param (and resets the page) without losing the rest. */
function useParam(name: string) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete('page');
    start(() => router.push(`${path}${next.size ? `?${next}` : ''}`));
  };
  return { set, pending };
}

function Select({ value, onChange, children, pending, label, className }: { value: string; onChange: (v: string) => void; children: React.ReactNode; pending: boolean; label: string; className?: string }) {
  return (
    <label className={clsx('relative inline-flex items-center', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx('field h-10 appearance-none pr-9 text-sm cursor-pointer transition-opacity', pending && 'opacity-60')}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 text-ink-3" />
    </label>
  );
}

export function SortSelect({ value, options }: { value: string; options: [string, string][] }) {
  const { set, pending } = useParam('sort');
  return (
    <Select label="Sort" value={value} onChange={set} pending={pending} className="w-48">
      {options.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </Select>
  );
}

export function LanguageSelect({ value, options }: { value: string; options: [string, string][] }) {
  const { set, pending } = useParam('lang');
  return (
    <Select label="Language" value={value} onChange={set} pending={pending} className="w-full">
      <option value="">Any language</option>
      {options.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </Select>
  );
}
