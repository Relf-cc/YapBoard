import Link from 'next/link';
import { ChevronsUp } from 'lucide-react';
import { Avatar } from '../Avatar';
import { timeAgo } from '@/lib/format';

type Item = { id: string; name: string; iconUrl: string | null; bumpedAt: string | null };

/** Two copies side by side so the CSS loop is seamless. */
export function BumpMarquee({ items }: { items: Item[] }) {
  if (items.length < 4) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 gap-3 pr-3" aria-hidden={hidden || undefined}>
      {items.map((s) => (
        <li key={s.id}>
          <Link
            href={`/view/${s.id}`}
            tabIndex={hidden ? -1 : undefined}
            className="flex items-center gap-2.5 h-11 pl-1.5 pr-4 rounded-full border border-line bg-surface hover:border-line-strong hover:bg-surface-2 transition-colors"
          >
            <Avatar src={s.iconUrl} name={s.name} id={s.id} size={30} round />
            <span className="text-sm font-medium max-w-[180px] truncate">{s.name}</span>
            <span className="inline-flex items-center gap-0.5 text-xs text-ink-3">
              <ChevronsUp size={13} className="text-accent" />
              {timeAgo(s.bumpedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
