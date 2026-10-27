// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

/**
 * Sorting release files into platforms, so a client's page can say "Windows" above the .exe and "Linux" above
 * the .deb instead of listing nine filenames in upload order.
 *
 * It is all guesswork from the filename, because that is all a GitHub release gives us. The extension decides
 * where it can (an .msi is Windows, an .apk is Android); archives say nothing on their own, so those fall back
 * to words in the name, and anything still unclear lands in "Other" rather than being guessed wrong. The lister
 * can override every row on their manage page, which is the real answer to a bad guess.
 */

export const PLATFORMS = {
  windows: { label: 'Windows', hint: 'Windows 10 and 11' },
  mac: { label: 'macOS', hint: 'Apple silicon and Intel' },
  linux: { label: 'Linux', hint: 'Debian, Fedora, Arch and friends' },
  android: { label: 'Android', hint: 'Sideloaded APK' },
  ios: { label: 'iOS', hint: 'iPhone and iPad' },
  web: { label: 'Web', hint: 'Runs in the browser' },
  other: { label: 'Other', hint: 'Everything else' },
} as const;

export type Platform = keyof typeof PLATFORMS;

/** The order platforms are shown in, and the order a client's "runs on" row reads. */
export const PLATFORM_ORDER: Platform[] = ['windows', 'mac', 'linux', 'android', 'ios', 'web', 'other'];

export const isPlatform = (v: unknown): v is Platform => typeof v === 'string' && v in PLATFORMS;

export const platformLabel = (p: string) => (isPlatform(p) ? PLATFORMS[p].label : 'Other');

/** Extensions that settle it on their own. Longest first, so ".tar.gz" wins over ".gz". */
const BY_EXTENSION: [string, Platform][] = [
  ['.appinstaller', 'windows'],
  ['.msixbundle', 'windows'],
  ['.appxbundle', 'windows'],
  ['.msix', 'windows'],
  ['.appx', 'windows'],
  ['.msi', 'windows'],
  ['.exe', 'windows'],
  ['.dmg', 'mac'],
  ['.pkg', 'mac'],
  ['.appimage', 'linux'],
  ['.flatpak', 'linux'],
  ['.snap', 'linux'],
  ['.deb', 'linux'],
  ['.rpm', 'linux'],
  ['.pacman', 'linux'],
  ['.apk', 'android'],
  ['.aab', 'android'],
  ['.ipa', 'ios'],
];

/** Archives and loose files: the extension says nothing, so the rest of the name has to. */
const BY_WORD: [RegExp, Platform][] = [
  [/\b(win(dows)?(32|64)?|w(in)?64|w(in)?32)\b/, 'windows'],
  // "mas" is the Mac App Store build, which Electron-based projects publish alongside the plain darwin one.
  [/\b(mac(os)?|osx|darwin|apple|silicon|mas)\b/, 'mac'],
  [/\b(linux|ubuntu|debian|fedora|arch)\b/, 'linux'],
  [/\b(android)\b/, 'android'],
  [/\b(ios|iphone|ipad)\b/, 'ios'],
];

const ARCHS: [RegExp, string][] = [
  [/\b(universal|universal2|fat)\b/, 'universal'],
  [/\b(arm64|aarch64|apple[-_]?silicon|m1|m2|m3)\b/, 'arm64'],
  [/\b(armv7l?|armhf|arm)\b/, 'arm'],
  [/\b(x86[-_]?64|x64|amd64|win64)\b/, 'x64'],
  [/\b(x86|i[36]86|ia32|win32)\b/, 'x86'],
];

/** "YapinPlus-1.4.2-arm64.dmg" → ".dmg". Handles the two-part ones (.tar.gz) too. */
export function extensionOf(name: string): string {
  const n = name.toLowerCase().split(/[?#]/)[0];
  const two = n.match(/(\.tar\.(gz|xz|bz2|zst))$/);
  if (two) return two[1];
  const one = n.match(/(\.[a-z0-9]{1,13})$/);
  return one ? one[1] : '';
}

/** What a release file is, as far as its name gives it away. */
export type Classified = { platform: Platform; kind: string; arch: string };

export function classifyAsset(name: string): Classified {
  // "/" and "_" aren't word boundaries to a regex, so the words get separated before anything is matched.
  const n = name.toLowerCase().replace(/[_/\\]+/g, '-');
  const ext = extensionOf(n);
  const kind = ext.replace(/^\./, '');
  const arch = ARCHS.find(([re]) => re.test(n))?.[1] ?? '';

  const byExt = BY_EXTENSION.find(([e]) => n.endsWith(e));
  if (byExt) return { platform: byExt[1], kind, arch };

  const byWord = BY_WORD.find(([re]) => re.test(n));
  if (byWord) return { platform: byWord[1], kind, arch };

  // A tarball that hasn't said otherwise by now is a Linux build in practice — "atom-amd64.tar.gz" and its
  // kind. Checked after the words, so "something-mac.tar.gz" has already been read correctly.
  if (/^tar\./.test(kind) || kind === 'tgz') return { platform: 'linux', kind, arch };

  return { platform: 'other', kind, arch };
}

/**
 * Release files nobody wants to click.
 *
 * Two kinds. Checksums, signatures and update manifests, which every release tool adds; and the debug side of a
 * build — symbol bundles, PDBs, dSYMs, source maps and type definitions — which a project shipping proper
 * installers also publishes, and which would otherwise outnumber them three to one on the page. The test is the
 * name alone, so it stays a general rule rather than a list of particular projects.
 *
 * Nothing is deleted: the release page still has all of it, and it's a link away from every client's page.
 */
const NOISE_EXTENSION = /\.(sha\d*|sha\d*sums?|md5|sig|asc|pem|blockmap|sbom|json|yml|yaml|txt|nupkg|map|d\.ts)$/i;
const NOISE_NAME = /^(latest|release|checksums|sha256sums)/i;
/**
 * Debug and build artefacts, by the words projects conventionally mark them with. Only counted at the end of
 * the name, where a build tool puts them ("app-win32-x64-symbols.zip"), so a product that happens to be called
 * something like "Symbols Pack Installer" isn't thrown away.
 */
const NOISE_ARTEFACT = /[-_.](dsym|dsyms|pdb|symbols|debug|debuginfo|sourcemap|sources|toolchain-profile)([-_.]snapshot)?$/i;

export const isNoise = (name: string) => {
  const n = name.toLowerCase().trim();
  // Strip the extension before looking for artefact words, so "…-symbols.zip" is caught but "symbols.exe" isn't.
  const stem = n.replace(/(\.tar)?\.[a-z0-9]{1,13}$/, '');
  return NOISE_EXTENSION.test(n) || NOISE_NAME.test(n) || NOISE_ARTEFACT.test(stem);
};

/** "148.2 MB". Release sizes are in bytes and always whole files, so no need for bits or decimals under a MB. */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** The arch as people read it, for a button that already says the platform. */
export const archLabel = (arch: string) =>
  ({ x64: '64-bit', x86: '32-bit', arm64: 'ARM64', arm: 'ARM', universal: 'Universal' })[arch] ?? '';
