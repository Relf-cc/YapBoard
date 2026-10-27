// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import { popularTags } from '@/lib/search';
import { TagBrowser } from '@/components/TagBrowser';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = { title: 'Tags' };
export const dynamic = 'force-dynamic';

export default async function Tags() {
  const tags = await popularTags(2000);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10">
      <Reveal>
        <h1 className="text-[34px] sm:text-[44px] font-extrabold">Tags</h1>
        <p className="mt-2 text-ink-2">{tags.length.toLocaleString()} tags across every listed server. Pick one, or combine a few on the browse page.</p>
      </Reveal>
      <div className="mt-8">
        <TagBrowser tags={tags} />
      </div>
    </div>
  );
}
