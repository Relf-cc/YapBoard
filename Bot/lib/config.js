import { fileURLToPath } from 'node:url';

// Bot/.env if there is one; real environment variables win (Yapin's bot hosting passes the token that way).
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (e) {
  if (e?.code !== 'ENOENT') throw e;
}

const siteUrl = (process.env.YAPBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');

export const config = {
  token: process.env.YAPPER_BOT_TOKEN || '',
  /** Public URL, used in links the bot posts. */
  siteUrl,
  /** Where /api/internal/* is called. Defaults to siteUrl; in Docker it's the site container (http://site:3000). */
  apiUrl: (process.env.YAPBOARD_API_URL || siteUrl).replace(/\/$/, ''),
  internalSecret: process.env.INTERNAL_API_SECRET || '',
  /** Where reminders are kept between restarts. */
  dataDir: fileURLToPath(new URL('../data/', import.meta.url)),
};

export function checkConfig() {
  const problems = [];
  if (!config.token.startsWith('yb_')) problems.push('YAPPER_BOT_TOKEN is missing (it starts with yb_)');
  if (config.internalSecret.length < 16) problems.push('INTERNAL_API_SECRET is missing or shorter than 16 characters (copy it from Site/.env)');
  for (const [name, url] of [['YAPBOARD_URL', config.siteUrl], ['YAPBOARD_API_URL', config.apiUrl]]) {
    try {
      new URL(url);
    } catch {
      problems.push(`${name} "${url}" isn't a URL`);
    }
  }
  return problems;
}
