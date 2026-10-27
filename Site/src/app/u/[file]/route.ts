// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';

/**
 * Serve an uploaded image by id. URLs are /u/<id>.<ext> — the extension is cosmetic (browsers read the
 * Content-Type header) but it makes the path look like a file to link previewers and image hotlink checkers.
 *
 * Cache-Control is long: the content of a given id never changes, and an id is never reused.
 */

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { file } = await params;
  // Strip the extension and reject obviously-wrong ids before touching the database.
  const id = file.replace(/\.[^.]+$/, '');
  if (!/^[a-z0-9]{8,40}$/.test(id)) return new Response(null, { status: 404 });

  const row = await db.upload.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!row) return new Response(null, { status: 404 });

  return new Response(row.data, {
    status: 200,
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
