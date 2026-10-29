// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { db } from './db';
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, isUploadPath, uploadPath, type UploadKind } from './upload-fields';

/** The limits and the URL shape live in a module the browser can import too. */
export * from './upload-fields';

/**
 * Images people upload for their listings.
 *
 * YapBoard still doesn't touch the files a client ships - those stay on the maintainer's release page, and the
 * download dialog says so. This is only the pictures on the listing itself: an icon, a banner, screenshots.
 * Hotlinking them from an image host was the only option before, and it broke listings every time somebody's
 * free host expired.
 *
 * Three rules keep that from turning into open file hosting:
 *
 * - Only real images, decided by the file's own first bytes rather than by what the browser said it was, and
 *   never SVG, which is a scriptable document that would be served from our own origin.
 * - Small, and capped per kind (MAX_UPLOAD_BYTES), because the bytes sit in the database.
 * - Rows nothing points at are swept a day later, so a picture chosen and then replaced doesn't stay forever.
 */

/** How long an upload has to be claimed by a listing before the sweep takes it. */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/** No one person's images should fill the volume. Past this, the oldest have to be freed up first. */
export const MAX_UPLOADS_PER_USER = 120;

/**
 * What a file really is, from its first bytes. Returns null for anything not in UPLOAD_TYPES - including a
 * .png that is actually something else, which is the case worth catching.
 */
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  for (const t of UPLOAD_TYPES) {
    if (!t.magic.every((b, i) => bytes[i] === b)) continue;
    // RIFF containers are also .wav and .avi; only the ones that say WEBP at byte 8 are images.
    if (t.mime === 'image/webp' && String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') continue;
    return { mime: t.mime, ext: t.ext };
  }
  return null;
}

/** Everything wrong with a file, said the way the person who picked it would say it. */
export type UploadRefusal = { error: string };

/** Store an image and return the path a listing can point at, or why it couldn't be stored. */
export async function saveUpload(ownerId: string, kind: UploadKind, bytes: Uint8Array): Promise<{ url: string; bytes: number; mime: string } | UploadRefusal> {
  if (bytes.byteLength === 0) return { error: 'That file is empty.' };
  if (bytes.byteLength > MAX_UPLOAD_BYTES[kind]) return { error: `That image is too big. The limit for ${kind === 'icon' ? 'an icon' : `a ${kind}`} is ${MAX_UPLOAD_BYTES[kind] / (1024 * 1024)} MB.` };

  const type = sniffImage(bytes);
  if (!type) return { error: 'That isn’t a PNG, JPG, GIF or WebP image.' };

  const mine = await db.upload.count({ where: { ownerId } });
  if (mine >= MAX_UPLOADS_PER_USER) return { error: 'You’ve uploaded as many images as one account can hold. Remove some from your listings and try again tomorrow.' };

  const row = await db.upload.create({
    data: { ownerId, kind, mime: type.mime, ext: type.ext, bytes: bytes.byteLength, data: Buffer.from(bytes) },
    select: { id: true },
  });
  return { url: uploadPath(row.id, type.ext), bytes: bytes.byteLength, mime: type.mime };
}

/** The id in /u/<id>.png, or null if that isn't one of our paths. */
export const uploadIdFromPath = (url: string | null | undefined) => (url && isUploadPath(url) ? url.slice(3, url.lastIndexOf('.')) : null);

/**
 * Delete uploads no listing points at and which are older than the grace period.
 *
 * Every id in use is collected first and the rest go in one delete, rather than asking about each upload in
 * turn: there are few enough listings for that to be one small query, and it stays one query as uploads pile
 * up.
 *
 * **Every column that can hold an upload path has to be listed here.** One that isn't looks exactly like an
 * orphan, and the image is deleted out from under a live listing once the grace period passes - so a new
 * picker anywhere means another `select` in this function. Server listings earn their query because a Pro
 * owner's custom banner lives there (`customBannerUrl`); their `bannerUrl` is a Yapin' URL rather than an
 * upload, but it is read anyway, since `uploadIdFromPath` ignores anything that isn't one of ours and the
 * column could hold a path the day somebody points the picker at it.
 */
export async function sweepUploads(): Promise<number> {
  const [clients, servers] = await Promise.all([
    db.clientListing.findMany({ select: { iconUrl: true, bannerUrl: true, screenshots: true } }),
    db.server.findMany({ select: { iconUrl: true, bannerUrl: true, customBannerUrl: true, screenshots: true } }),
  ]);
  const referenced = new Set<string>();
  for (const l of clients) {
    for (const url of [l.iconUrl, l.bannerUrl, ...parseScreenshotUrls(l.screenshots)]) {
      const id = uploadIdFromPath(url);
      if (id) referenced.add(id);
    }
  }
  for (const s of servers) {
    for (const url of [s.iconUrl, s.bannerUrl, s.customBannerUrl, ...parseScreenshotUrls(s.screenshots)]) {
      const id = uploadIdFromPath(url);
      if (id) referenced.add(id);
    }
  }
  const { count } = await db.upload.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - ORPHAN_GRACE_MS) }, id: { notIn: [...referenced] } },
  });
  return count;
}

/** Screenshots are a JSON array in a text column (SQLite has no array type); a broken one is simply empty. */
function parseScreenshotUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
