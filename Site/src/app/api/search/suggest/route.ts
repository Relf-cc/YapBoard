import type { NextRequest } from 'next/server';
import { suggest } from '@/lib/search';
import { json } from '@/lib/http';

export async function GET(req: NextRequest) {
  const out = await suggest(req.nextUrl.searchParams.get('q') || '');
  return json(out);
}
