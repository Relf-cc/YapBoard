/** Only same-site paths (or the portal) are allowed after login, so ?next= can't be an open redirect. */
export function safeNext(next: string | null | undefined, portalUrl?: string): string {
  if (!next) return '/';
  if (portalUrl && (next === portalUrl || next.startsWith(portalUrl + '/'))) return next;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\')) return '/';
  return next;
}
