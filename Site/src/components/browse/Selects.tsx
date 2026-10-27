'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Dropdown } from '../Dropdown';

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

const toOptions = (entries: [string, string][]) => entries.map(([value, label]) => ({ value, label }));

export function SortSelect({ value, options }: { value: string; options: [string, string][] }) {
  const { set, pending } = useParam('sort');
  return <Dropdown label="Sort" size="md" value={value} onChange={set} pending={pending} options={toOptions(options)} className="w-48" />;
}

export function LanguageSelect({ value, options }: { value: string; options: [string, string][] }) {
  const { set, pending } = useParam('lang');
  return <Dropdown label="Language" size="md" value={value} onChange={set} pending={pending} options={[{ value: '', label: 'Any language' }, ...toOptions(options)]} className="w-full" />;
}
