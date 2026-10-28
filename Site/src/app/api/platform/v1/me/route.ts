// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { handle, RATE } from '@/lib/platform';

/**
 * The partner API for program members (src/lib/platform.ts). Served at api.yapboard.dev/platform/v1 in
 * production, /api/platform/v1 anywhere.
 *
 * This one answers with the app behind the key, so a bot can check its key on boot and read back what it
 * may do rather than finding out from a 403 in front of a user. It needs no scope - holding a live key is
 * the whole of the question it answers.
 */
export async function GET(req: NextRequest) {
  return handle(req, 'me', async (app) => json({ app: { id: app.id, botId: app.botId, name: app.name }, scopes: app.scopes, rate: RATE }));
}
