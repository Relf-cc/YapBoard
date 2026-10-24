import type { NextRequest } from 'next/server';
import { suggest } from '@/lib/search';
import { clientIp, fail, json, rateLimit } from '@/lib/http';

export async function GET(req: NextRequest) {
  // Each call scores a few hundred listings; plenty for typing, not for hammering.
  if (!rateLimit(`suggest:${clientIp(req.headers)}`, 120, 60_000)) return fail('Slow down a little', 429);
  const out = await suggest(req.nextUrl.searchParams.get('q') || '');
  return json(out);
}
