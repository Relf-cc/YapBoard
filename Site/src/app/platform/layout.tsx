// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Platform', template: '%s · YapBoard Platform' },
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/**
 * platform.yapboard.dev. The staff portal's frame - sidebar, cards, the same tokens - for the people building
 * bots on top of YapBoard rather than the ones moderating it.
 *
 * Two groups under here, because they're gated differently:
 *   (member) - the programme itself. Logged in but not a member? The invite wall, not a 404: the whole point
 *              is that somebody handed you a code, and that's where it goes.
 *   (open)   - the terms. Any logged-in account may read them, member or not, since redeeming an invite is
 *              what accepts them and nobody should have to accept an agreement to find out what it says.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return children;
}
