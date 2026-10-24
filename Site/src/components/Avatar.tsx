import { hueFor, initials } from '@/lib/format';
import clsx from 'clsx';

/** Server icon or user avatar, falling back to initials on a tinted square. */
export function Avatar({ src, name, id, size = 48, round = false, className }: { src?: string | null; name: string; id: string; size?: number; round?: boolean; className?: string }) {
  const radius = round ? '9999px' : `${Math.round(size * 0.3)}px`;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} loading="lazy" className={clsx('shrink-0 object-cover bg-surface-2', className)} style={{ width: size, height: size, borderRadius: radius }} />;
  }
  const hue = hueFor(id);
  return (
    <span
      aria-hidden="true"
      className={clsx('shrink-0 inline-flex items-center justify-center font-display font-bold select-none', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.max(11, size * 0.36),
        background: `hsl(${hue} 32% 22%)`,
        color: `hsl(${hue} 70% 78%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 40% 32%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
