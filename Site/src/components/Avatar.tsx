// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { CSSProperties } from 'react';
import { hueFor, initials } from '@/lib/format';
import clsx from 'clsx';

/** Server icon or user avatar, falling back to initials on a tinted square. */
export function Avatar({
  src,
  name,
  id,
  size = 48,
  round = false,
  className,
  glow,
}: {
  src?: string | null;
  name: string;
  id: string;
  size?: number;
  round?: boolean;
  className?: string;
  /** Optional accent color to halo behind the avatar, e.g. a server's listing color. */
  glow?: string;
}) {
  const radius = round ? '9999px' : `${Math.round(size * 0.3)}px`;
  const haloStyle: CSSProperties = glow ? { filter: `drop-shadow(0 0 18px color-mix(in srgb, ${glow} 55%, transparent))` } : {};
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={clsx('shrink-0 object-cover bg-surface-2', className)}
        style={{ width: size, height: size, borderRadius: radius, ...haloStyle }}
      />
    );
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
        ...haloStyle,
      }}
    >
      {initials(name)}
    </span>
  );
}
