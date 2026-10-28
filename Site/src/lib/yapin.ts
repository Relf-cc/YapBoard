// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import 'server-only';
import { env } from './env';

/* ---------------- Login with Yapin' (OAuth2, scope identify) ---------------- */

const AUTHORIZE = 'https://www.yapin.gg/oauth/authorize';
const TOKEN = 'https://www.yapin.gg/api/oauth/token';
const ME = 'https://www.yapin.gg/api/oauth/me';

export const redirectUri = () => `${env.siteUrl}/api/auth/callback`;

export function authorizeUrl(state: string, codeChallenge: string) {
  const q = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'identify',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE}?${q}`;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code_verifier: codeVerifier,
    }),
    cache: 'no-store',
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.access_token) throw new Error(out.error_description || out.error || `token exchange failed (${res.status})`);
  return out.access_token as string;
}

export type YapinProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null };

export async function fetchProfile(accessToken: string): Promise<YapinProfile> {
  const res = await fetch(ME, { headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const out = await res.json().catch(() => ({}));
  // Some responses wrap the user; accept both shapes.
  const u = out.user ?? out;
  if (!res.ok || !u.id) throw new Error(out.error || `profile fetch failed (${res.status})`);
  return { id: String(u.id), username: String(u.username), display_name: u.display_name ?? null, avatar_url: u.avatar_url ?? null };
}

/* ---------------- Bot API (read-only, used to verify server managers) ---------------- */

const BOT_BASE = 'https://www.yapin.gg/api/bot/v1';

async function botGet<T = Record<string, unknown>>(path: string): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(BOT_BASE + path, {
    headers: { authorization: `Bot ${env.botToken}`, 'user-agent': 'yapboard-site/1' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** Endpoints return paths; this turns one into a full URL (docs: "Image and CDN URL formats"). */
export function fileUrl(kind: 'icons' | 'avatars' | 'banners', path: unknown): string | null {
  if (typeof path !== 'string' || !path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/')) return `https://www.yapin.gg${path}`;
  return `https://files.yapper.website/${kind}/${path}`;
}

export type YapinServer = { id: string; name: string; iconUrl: string | null; bannerUrl: string | null; ownerId: string | null; memberCount: number | null };

export async function fetchServer(serverId: string): Promise<YapinServer | null> {
  const r = await botGet<{ server?: Record<string, unknown> }>(`/servers/${encodeURIComponent(serverId)}`);
  if (!r.ok || !r.data.server) return null;
  const s = r.data.server;
  return {
    id: String(s.id ?? serverId),
    name: String(s.name ?? 'Unnamed server'),
    iconUrl: fileUrl('icons', s.icon_path ?? s.icon),
    bannerUrl: fileUrl('banners', s.banner_path ?? s.banner),
    ownerId: s.owner_id != null ? String(s.owner_id) : null,
    memberCount: Number.isSafeInteger(s.member_count) && (s.member_count as number) >= 0 ? (s.member_count as number) : null,
  };
}

/**
 * Yapin's OpenAPI spec (www.yapin.gg/openapi.json, schema Role): `manage_server` is a boolean on the role, and
 * other permissions are in `perms`, where an admin flag counts too. Only an explicit `true` counts; anything
 * missing or unexpected means no.
 */
const roleCanManage = (role: Record<string, unknown>) => {
  const perms = role.perms && typeof role.perms === 'object' ? (role.perms as Record<string, unknown>) : {};
  return role.manage_server === true || perms.administrator === true || perms.admin === true;
};

/**
 * Yapin' has no "is a bot" marker: GET /users/{id} returns id, username, display_name, avatar_path, badges,
 * banner_path, created_at, bio and pronouns, and nothing else (openapi.json, schema User). So a listing can't
 * be refused for naming a human account - don't add a `bot` field here and check it, it would always be false
 * and would refuse every listing. What we can check is that the account is in the support server: isMember.
 */
export type YapinUser = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

/** A Yapin' account by id. Used to fill in a bot listing's name and avatar from the id people paste. */
export async function fetchUser(userId: string): Promise<YapinUser | null> {
  const r = await botGet<{ user?: Record<string, unknown> }>(`/users/${encodeURIComponent(userId)}`);
  if (!r.ok || !r.data.user) return null;
  const u = r.data.user;
  return {
    id: String(u.id ?? userId),
    username: String(u.username ?? 'unknown'),
    displayName: u.display_name != null ? String(u.display_name) : null,
    avatarUrl: fileUrl('avatars', u.avatar_url ?? u.avatar_path ?? u.avatar),
  };
}

export type ManageCheck =
  | { ok: true; server: YapinServer }
  | { ok: false; reason: 'bot_missing' | 'not_member' | 'no_permission' | 'unavailable' };

/** Can `userId` manage `serverId`? Owner always can; otherwise a role with admin / manage server. */
export async function checkManager(serverId: string, userId: string): Promise<ManageCheck> {
  try {
    const server = await fetchServer(serverId);
    if (!server) return { ok: false, reason: 'bot_missing' };
    if (server.ownerId && server.ownerId === userId) return { ok: true, server };

    const m = await botGet<{ member?: { roles?: unknown[] } }>(`/servers/${encodeURIComponent(serverId)}/members/${encodeURIComponent(userId)}`);
    if (!m.ok || !m.data.member) return { ok: false, reason: 'not_member' };
    // Spec (Member.roles): an array of role ids.
    const mine = new Set((m.data.member.roles ?? []).filter((r): r is string => typeof r === 'string'));

    const r = await botGet<{ roles?: Record<string, unknown>[] }>(`/servers/${encodeURIComponent(serverId)}/roles`);
    if (!r.ok) return { ok: false, reason: 'unavailable' };
    const roles = r.data.roles ?? [];
    if (roles.some((role) => mine.has(String(role.id)) && roleCanManage(role))) return { ok: true, server };
    return { ok: false, reason: 'no_permission' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * Is `userId` in `serverId`? `null` means Yapin' wouldn't say, which callers treat as "don't block": this backs up
 * the ownership check rather than being it, so a blip here shouldn't refuse a listing.
 */
export async function isMember(serverId: string, userId: string): Promise<boolean | null> {
  try {
    const m = await botGet<{ member?: unknown }>(`/servers/${encodeURIComponent(serverId)}/members/${encodeURIComponent(userId)}`);
    if (m.status === 404) return false;
    if (!m.ok) return null;
    return !!m.data.member;
  } catch {
    return null;
  }
}

export const MANAGE_ERRORS: Record<Exclude<ManageCheck, { ok: true }>['reason'], string> = {
  bot_missing: "YapBoard's bot isn't in that server yet. Add it first, then try again.",
  not_member: "You're not a member of that server.",
  no_permission: 'Only the server’s owner or an admin (a role with Manage Server) can add it.',
  unavailable: "Couldn't reach Yapin' right now. Try again in a minute.",
};
