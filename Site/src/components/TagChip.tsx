import Link from 'next/link';
import clsx from 'clsx';

export function TagChip({ name, active, count, href }: { name: string; active?: boolean; count?: number; href?: string }) {
  return (
    <Link href={href ?? `/servers?tag=${encodeURIComponent(name)}`} className={clsx('chip', active && 'chip-active')}>
      <span className="text-ink-3">#</span>
      {name}
      {count !== undefined && <span className="ml-0.5 text-ink-3 tabular-nums">{count}</span>}
    </Link>
  );
}
