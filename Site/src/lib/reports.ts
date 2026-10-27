// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/** Shared by the report dialog, the API and the staff portal. */
export const ABUSE_REASONS = {
  spam: 'Spam or fake listing',
  scam: 'Scam, phishing or malware',
  nsfw: 'Adult content not marked 18+',
  hate: 'Hate, harassment or threats',
  illegal: 'Illegal content',
  impersonation: 'Impersonating someone',
  other: 'Something else',
} as const;

export const REMOVAL_REASONS = {
  owner_request: "I own this server and want it taken down",
  not_owner: "Listed by someone who doesn't run it",
  outdated: 'Server was deleted or the invite is dead',
  other: 'Something else',
} as const;

export type ReportKind = 'ABUSE' | 'REMOVAL';

/**
 * A report points at exactly one listing: a server, a bot or a client. All three boards share the queue, so
 * everything that reads a report goes through this instead of reaching for `report.server`.
 */
export type ReportTarget = {
  kind: 'server' | 'bot' | 'client';
  id: string;
  name: string;
  iconUrl: string | null;
  status: string;
  /** Whether the picture is a circle (bots are accounts) or a rounded square (servers and clients). */
  round: boolean;
  /** Where the listing lives on the public site. */
  path: string;
};

type MaybeServer = { id: string; name: string; iconUrl: string | null; status: string } | null | undefined;
type MaybeBot = { id: string; name: string; avatarUrl: string | null; status: string } | null | undefined;
type MaybeClient = { id: string; slug: string; name: string; iconUrl: string | null; status: string } | null | undefined;

export function reportTarget(report: { server?: MaybeServer; bot?: MaybeBot; client?: MaybeClient }): ReportTarget | null {
  if (report.server) {
    const s = report.server;
    return { kind: 'server', id: s.id, name: s.name, iconUrl: s.iconUrl, status: s.status, round: false, path: `/view/${s.id}` };
  }
  if (report.bot) {
    const b = report.bot;
    return { kind: 'bot', id: b.id, name: b.name, iconUrl: b.avatarUrl, status: b.status, round: true, path: `/bots/${b.id}` };
  }
  if (report.client) {
    const c = report.client;
    return { kind: 'client', id: c.id, name: c.name, iconUrl: c.iconUrl, status: c.status, round: false, path: `/clients/${c.slug}` };
  }
  // Every side cascades on delete, so this only happens in the moment between a delete and a page refresh.
  return null;
}

export const reasonLabel = (kind: string, reason: string) =>
  (kind === 'REMOVAL' ? (REMOVAL_REASONS as Record<string, string>) : (ABUSE_REASONS as Record<string, string>))[reason] ?? reason;
