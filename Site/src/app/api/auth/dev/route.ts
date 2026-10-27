// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { NextResponse, type NextRequest } from 'next/server';
import { devLoginEnabled, env } from '@/lib/env';
import { createSession, upsertUser } from '@/lib/session';
import { normalizeTag } from '@/lib/tags';
import { safeNext } from '@/lib/next-url';

/** Local-only login so the site can be tried without Yapin' OAuth credentials. Off in production. */
export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const form = await req.formData();
  const username = normalizeTag(String(form.get('username') || '')).replace(/-/g, '_') || 'dev_user';
  const staff = form.get('staff') === 'on';
  const id = `dev-${username}`;
  await upsertUser({ id, username, display_name: username.replace(/_/g, ' ') }, staff ? 'ADMIN' : 'USER');
  await createSession(id);
  const next = safeNext(String(form.get('next') || '/'), env.portalUrl);
  return NextResponse.redirect(next.startsWith('http') ? next : new URL(next, env.siteUrl), 303);
}
