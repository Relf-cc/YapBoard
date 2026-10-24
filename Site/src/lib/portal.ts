import 'server-only';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { env } from './env';
import { getUser, isStaff } from './session';

/** '' on portal.yapboard.dev (served at the root), '/portal' on the main domain (dev). */
export async function portalBase() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || '').toLowerCase();
  return host.startsWith('portal.') ? '' : '/portal';
}

/** Staff gate for portal pages. Not logged in → main site login, then back here. */
export async function requirePortalUser(path = '') {
  const user = await getUser();
  if (!user) {
    const base = await portalBase();
    const back = base ? `${base}${path}` : `${env.portalUrl}${path}`;
    redirect(`${base ? '' : env.siteUrl}/login?next=${encodeURIComponent(back)}`);
  }
  return { user, staff: isStaff(user) && !user.bannedAt };
}

/**
 * Every portal page calls this first, before loading anything. The layout's check is not enough on its own:
 * Next renders a page alongside its layout, so a page that skips this sends its data even when the layout
 * shows "Staff only" or redirects to login.
 */
export async function requireStaffPage(path = '') {
  const { user, staff } = await requirePortalUser(path);
  if (!staff) notFound();
  return user;
}
