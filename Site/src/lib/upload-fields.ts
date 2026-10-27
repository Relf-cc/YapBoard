// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * What an uploaded image may be, and what its URL looks like afterwards.
 *
 * Split out of src/lib/uploads.ts for the same reason client-fields.ts is split out of clients.ts: that file
 * is `server-only` — it reaches the database — and the picker in the browser needs these limits to say no
 * before a 40 MB photo is sent anywhere. uploads.ts re-exports everything here.
 */

/** The kinds of image a listing has a place for. Each one gets its own size limit. */
export const UPLOAD_KINDS = ['icon', 'banner', 'screenshot'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const isUploadKind = (v: unknown): v is UploadKind => typeof v === 'string' && (UPLOAD_KINDS as readonly string[]).includes(v);

/**
 * Size caps, in bytes. Uploads are stored in the database, so these are deliberately small: an icon is drawn
 * at 112px and a banner at about 1500 wide, and neither needs a megabyte of photograph behind it.
 */
export const MAX_UPLOAD_BYTES: Record<UploadKind, number> = {
  icon: 2 * 1024 * 1024,
  banner: 4 * 1024 * 1024,
  screenshot: 4 * 1024 * 1024,
};

/**
 * The formats we take, by their first bytes. No SVG: it's a document that can carry script, and it would be
 * served from our own origin.
 */
export const UPLOAD_TYPES = [
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
  // WebP is "RIFF????WEBP": the four bytes at 8 are checked separately in sniffImage.
  { mime: 'image/webp', ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

/** For the file picker's `accept`, so the browser's own dialog filters to the same set. */
export const UPLOAD_ACCEPT = UPLOAD_TYPES.map((t) => t.mime).join(',');

/** Where an upload is served from. The id makes it unique, the extension keeps it looking like a file. */
export const uploadPath = (id: string, ext: string) => `/u/${id}.${ext}`;

/**
 * True for a URL that is one of our own uploads. Listings store this path rather than an absolute link, so
 * the images keep working if the site ever moves to another domain.
 */
export const isUploadPath = (v: string) => /^\/u\/[a-z0-9]{8,40}\.(png|jpg|gif|webp)$/.test(v);

/** "2.4 MB", for the line under a picker and for the message when a file is too big. */
export const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 * 10 ? 1 : 0).replace(/\.0$/, '')} MB`;
