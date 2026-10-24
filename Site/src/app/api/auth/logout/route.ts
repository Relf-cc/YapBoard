import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { destroySession } from '@/lib/session';
import { sameOrigin } from '@/lib/http';

export async function POST(req: NextRequest) {
  if (sameOrigin(req)) await destroySession();
  return NextResponse.redirect(new URL('/', env.siteUrl), 303);
}
