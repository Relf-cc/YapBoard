import { Button, Embed, Row } from './yapper.js';
import { config } from './config.js';

export const ACCENT = '#ff6b4a';
const MUTED = '#4e5058';
const RED = '#f23f43';
/** Same as the site's BUMP_COOLDOWN_MS. */
export const BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const FOOTER = `YapBoard · ${new URL(config.siteUrl).host}`;
let footerIcon;

/** Called once we're online: the bot's own avatar goes in every footer. */
export function setBrand(me) {
  footerIcon = picture(fileUrl('avatars', me?.avatar_url ?? me?.avatar_path ?? me?.avatar));
}

/**
 * Embed pictures must be https and on Yapin’s own hosts (or a short list of others); anything else would make the
 * whole message fail, so it's dropped instead.
 */
export function picture(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)(yapin\.gg|yapper\.website)$/.test(u.hostname) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every card: a colour bar, the YapBoard footer and, if there is one, a server icon on the right.
 * `tone`: 'accent' (orange), 'muted' (grey, for "not yet"), 'error' (red) or a listing's own #hex.
 */
export function card({ title, description, tone = 'accent', icon, url, author, time = false } = {}) {
  const color = tone === 'error' ? RED : tone === 'muted' ? MUTED : tone === 'accent' ? ACCENT : /^#[0-9a-f]{6}$/i.test(tone) ? tone : ACCENT;
  const e = new Embed().color(color).footer(FOOTER, footerIcon);
  if (title) e.title(String(title).slice(0, 256));
  if (description) e.description(description);
  if (url?.startsWith('https://')) e.url(url);
  if (picture(icon)) e.thumbnail(picture(icon));
  if (author) e.author(author.name, { icon: picture(author.icon) });
  if (time) e.timestamp();
  return e;
}

/**
 * Link buttons must be https, so in local dev (http://localhost) the links go in the text instead.
 * Returns { components, extra }: pass components to reply(), append extra to the description.
 */
export function links(...pairs) {
  const ok = pairs.filter(([, url]) => url);
  if (!ok.length) return { components: undefined, extra: '' };
  if (ok.every(([, url]) => url.startsWith('https://'))) {
    return { components: [new Row(ok.map(([label, url]) => Button.link(label, url)))], extra: '' };
  }
  return { components: undefined, extra: '\n\n' + ok.map(([label, url]) => `[${label} →](${url})`).join('   ') };
}

/** Send one card with optional link buttons. */
export function answer(msg, embed, ...linkPairs) {
  const { components, extra } = links(...linkPairs);
  if (extra) embed.description((embed.data.description || '') + extra);
  return msg.reply('', { embeds: [embed], components });
}

/** 2h 0m → "2h", 83m → "1h 23m", 40s → "under a minute". */
export function duration(ms) {
  const mins = Math.ceil(Math.max(0, ms) / 60_000);
  if (mins <= 1) return 'under a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const until = (when) => duration(new Date(when).getTime() - Date.now());

/** How far through the cooldown we are: ▰▰▰▰▰▰▱▱▱▱ */
export function cooldownBar(nextAt, width = 12) {
  const left = Math.max(0, new Date(nextAt).getTime() - Date.now());
  const done = Math.round(width * Math.min(1, 1 - left / BUMP_COOLDOWN_MS));
  return '▰'.repeat(done) + '▱'.repeat(width - done);
}

export const number = (n) => Number(n || 0).toLocaleString('en-US');

export const siteLink = (path = '') => `${config.siteUrl}${path}`;

/** `tag` `tag` `tag`, at most 8 so the line doesn't wrap into a wall. */
export const tagLine = (tags = []) => tags.slice(0, 8).map((t) => `\`${t}\``).join(' ');

/* ---------------- Reading Yapin' payloads (field names vary a little between endpoints) ---------------- */

/** Endpoints return paths; this turns one into a full URL (docs: "Image and CDN URL formats"). Same as the site's fileUrl. */
export function fileUrl(kind, path) {
  if (typeof path !== 'string' || !path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/')) return `https://www.yapin.gg${path}`;
  return `https://files.yapper.website/${kind}/${path}`;
}

export function memberCountOf(server) {
  const n = server?.member_count ?? server?.memberCount ?? server?.members_count;
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}

/** The server a message was sent in, or null for DMs. */
export async function serverIdOf(bot, msg) {
  if (msg.server_id) return String(msg.server_id);
  const ch = await bot.channel(msg.channel_id);
  return ch?.server_id ? String(ch.server_id) : null;
}

/** Who sent a message, in the shape the site's /api/internal/bump wants. */
export async function authorOf(bot, msg) {
  let u = null;
  try {
    u = await bot.user(msg.author_id);
  } catch {
    // Profile lookup is only for nicer data on the site; the bump still works without it.
  }
  const username = String(u?.username ?? msg.author_username ?? msg.username ?? msg.author?.username ?? `user-${msg.author_id}`).slice(0, 64);
  const displayName = u?.display_name ?? msg.author_display_name ?? msg.author?.display_name ?? null;
  return {
    id: String(msg.author_id),
    username,
    displayName: displayName ? String(displayName).slice(0, 100) : null,
    avatarUrl: fileUrl('avatars', u?.avatar_url ?? u?.avatar_path ?? u?.avatar),
  };
}
