// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { fail, json, rateLimit, requireUser } from '@/lib/http';
import { MAX_UPLOAD_BYTES, isUploadKind, saveUpload } from '@/lib/uploads';

/**
 * One image, posted as multipart form-data by the picker in the listing form: `file` and `kind`.
 *
 * Nothing is attached to a listing here. The response is a path (/u/<id>.png) that the form drops into the
 * field it was picked for, and the listing claims it when the form is saved - so an upload the person then
 * changes their mind about is simply never referenced, and the sweep clears it a day later.
 */

/** The largest any kind may be, plus room for the multipart wrapper, used to refuse before reading the body. */
const HARD_LIMIT = Math.max(...Object.values(MAX_UPLOAD_BYTES)) + 64 * 1024;

export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if (g.error) return g.error;
  if (!rateLimit(`upload:${g.user.id}`, 40, 60 * 60_000)) return fail('That’s a lot of images at once. Try again in a little while.', 429);

  if (Number(req.headers.get('content-length') || 0) > HARD_LIMIT) return fail('That image is too big.', 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = form?.get('kind');
  if (!(file instanceof File) || !isUploadKind(kind)) return fail('No image was sent.', 400);
  if (file.size > MAX_UPLOAD_BYTES[kind]) return fail(`That image is too big. The limit is ${MAX_UPLOAD_BYTES[kind] / (1024 * 1024)} MB.`, 413);

  const saved = await saveUpload(g.user.id, kind, new Uint8Array(await file.arrayBuffer()));
  if ('error' in saved) return fail(saved.error, 422);
  return json(saved, 201);
}
