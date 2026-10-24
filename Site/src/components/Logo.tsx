import Link from 'next/link';

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M8.5 9.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H15l-4.2 3.4c-.5.4-1.3 0-1.3-.6v-2.8h-1a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="#fff" />
      <rect x="10" y="12.6" width="11" height="2" rx="1" fill="var(--accent)" />
      <rect x="10" y="16.4" width="7" height="2" rx="1" fill="var(--accent)" opacity=".55" />
    </svg>
  );
}

export function Logo({ href = '/', suffix }: { href?: string; suffix?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 font-display text-[17px] font-bold tracking-tight">
      <span className="transition-transform duration-300 ease-out-soft group-hover:-rotate-6 group-hover:scale-105">
        <LogoMark />
      </span>
      <span>
        YapBoard{suffix && <span className="ml-1.5 font-semibold text-ink-3">{suffix}</span>}
      </span>
    </Link>
  );
}
