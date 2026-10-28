// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * Facts the Terms, Privacy and Guidelines pages all quote, so they can't drift apart.
 * Placeholder values: fill these in and have someone qualified review the pages before launch.
 */
export const LEGAL = {
  /** Bump this whenever any of the three pages change in substance. */
  updated: '24 October 2026',
  /**
   * The developer platform's terms have their own date: they change when the API does, which is on a
   * different clock from the site's terms (src/app/platform/(open)/program).
   */
  platformUpdated: '28 October 2026',
  /** Who runs YapBoard. UK GDPR requires the controller's identity: a person's or company's name. */
  operator: 'YapBoard',
  /** Must be a real, monitored inbox. Rights requests, copyright notices and appeals all point here. */
  email: 'support@yapboard.dev',
  law: 'England and Wales',
  /** Yapin's own terms. Client listers accept these alongside ours before submitting (src/lib/clients.ts). */
  yapinTerms: 'https://www.yapin.gg/terms',
  minAge: 13,
  /** Profiles with no listings that haven't logged in or bumped for this long get deleted. */
  inactiveMonths: 24,
  /** Longest a deleted record can survive in database backups. */
  backupDays: 30,
} as const;
