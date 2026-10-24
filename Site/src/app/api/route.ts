import { env } from '@/lib/env';
import { json } from '@/lib/http';

/** The root of api.yapboard.dev: say what this is instead of showing the site's 404 page. */
export function GET() {
  return json({ name: 'YapBoard API', site: env.siteUrl });
}
