// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { Apple, Globe, Monitor, Package, Smartphone, Terminal } from 'lucide-react';
import { PLATFORMS, type Platform } from '@/lib/platforms';

/**
 * A glyph per platform. Deliberately generic shapes rather than the real logos: those are trademarks, and a
 * listing page full of other companies' marks is exactly the kind of thing YapBoard shouldn't be doing.
 */
const ICONS = {
  windows: Monitor,
  mac: Apple,
  linux: Terminal,
  android: Smartphone,
  ios: Smartphone,
  web: Globe,
  other: Package,
} as const;

export function PlatformIcon({ platform, size = 15, className }: { platform: Platform; size?: number; className?: string }) {
  const Icon = ICONS[platform] ?? Package;
  return <Icon size={size} strokeWidth={2.1} className={className} aria-hidden />;
}

/** The small "runs on Windows, Linux" row under a card's title. */
export function PlatformRow({ platforms, size = 13, className }: { platforms: Platform[]; size?: number; className?: string }) {
  if (!platforms.length) return null;
  return (
    <span className={className} title={platforms.map((p) => PLATFORMS[p].label).join(', ')}>
      <span className="sr-only">Runs on {platforms.map((p) => PLATFORMS[p].label).join(', ')}</span>
      <span aria-hidden className="inline-flex items-center gap-1">
        {platforms.slice(0, 4).map((p) => (
          <PlatformIcon key={p} platform={p} size={size} />
        ))}
      </span>
    </span>
  );
}
