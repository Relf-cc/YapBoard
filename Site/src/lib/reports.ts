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

export const reasonLabel = (kind: string, reason: string) =>
  (kind === 'REMOVAL' ? (REMOVAL_REASONS as Record<string, string>) : (ABUSE_REASONS as Record<string, string>))[reason] ?? reason;
