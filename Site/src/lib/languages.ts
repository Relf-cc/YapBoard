// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
export const LANGUAGES: Record<string, string> = {
  en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano',
  nl: 'Nederlands', pl: 'Polski', tr: 'Türkçe', ru: 'Русский', uk: 'Українська', ar: 'العربية',
  hi: 'हिन्दी', ja: '日本語', ko: '한국어', zh: '中文', id: 'Bahasa Indonesia', vi: 'Tiếng Việt',
  th: 'ไทย', sv: 'Svenska', other: 'Other',
};

export const languageName = (code: string) => LANGUAGES[code] ?? code;
