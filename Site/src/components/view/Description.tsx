// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { Fragment, type ReactNode } from 'react';

/**
 * Markdown-ish description renderer. Everything is built from React elements — nothing a lister writes
 * can become raw HTML. Supported:
 *
 * Block:
 *   # H1 / ## H2 / ### H3 — headings
 *   - item / * item / • item — unordered list
 *   1. item / 2. item       — ordered list
 *   --- / *** / ___         — horizontal rule (three or more, alone on a line)
 *   ```…```                 — fenced code block (monospace; no syntax colouring)
 *   blank lines             — paragraph break
 *
 * Inline (paragraphs, list items, headings):
 *   **bold** / __bold__
 *   *italic* / _italic_
 *   `code`
 *   [text](https://…)  — named links; only https:// targets are linked
 *   https://…          — bare links
 */
export function Description({ text }: { text: string }) {
  const blocks = parseBlocks(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
  return (
    <div className="space-y-4 text-[15.5px] leading-[1.75] text-ink-2 break-words">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

// ─── block-level ──────────────────────────────────────────────────────────────

type Block =
  | { type: 'p'; lines: string[] }
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'hr' }
  | { type: 'code'; lang: string; text: string };

function parseBlocks(src: string): Block[] {
  const result: Block[] = [];
  const raw = src.split('\n');
  let i = 0;

  while (i < raw.length) {
    const line = raw[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const lines: string[] = [];
      i++;
      while (i < raw.length && !/^```/.test(raw[i])) {
        lines.push(raw[i]);
        i++;
      }
      i++; // closing ```
      result.push({ type: 'code', lang, text: lines.join('\n') });
      continue;
    }

    // Heading
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      result.push({ type: 'h', level: Math.min(hm[1].length, 3) as 1 | 2 | 3, text: hm[2] });
      i++;
      continue;
    }

    // Horizontal rule — three or more -, * or _ (optionally spaced), nothing else on the line
    if (/^(\s*[-*_]){3,}\s*$/.test(line) && /[-*_]/.test(line)) {
      result.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blank line — skip
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Unordered list — consume consecutive list lines (blank lines between items are allowed)
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < raw.length) {
        if (/^\s*[-*•]\s+/.test(raw[i])) {
          items.push(raw[i].replace(/^\s*[-*•]\s+/, ''));
          i++;
        } else if (/^\s*$/.test(raw[i]) && i + 1 < raw.length && /^\s*[-*•]\s+/.test(raw[i + 1])) {
          i++;
        } else {
          break;
        }
      }
      result.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < raw.length) {
        if (/^\s*\d+[.)]\s+/.test(raw[i])) {
          items.push(raw[i].replace(/^\s*\d+[.)]\s+/, ''));
          i++;
        } else if (/^\s*$/.test(raw[i]) && i + 1 < raw.length && /^\s*\d+[.)]\s+/.test(raw[i + 1])) {
          i++;
        } else {
          break;
        }
      }
      result.push({ type: 'ol', items });
      continue;
    }

    // Paragraph — collect until blank line or a block-level marker
    const lines: string[] = [];
    while (
      i < raw.length &&
      !/^\s*$/.test(raw[i]) &&
      !/^#{1,3}\s/.test(raw[i]) &&
      !/^(\s*[-*_]){3,}\s*$/.test(raw[i]) &&
      !/^```/.test(raw[i])
    ) {
      lines.push(raw[i]);
      i++;
    }
    if (lines.length) result.push({ type: 'p', lines });
  }

  return result;
}

function renderBlock(b: Block, key: number): ReactNode {
  switch (b.type) {
    case 'hr':
      return <hr key={key} className="border-line" />;

    case 'h': {
      const cls =
        b.level === 1
          ? 'text-[17px] font-bold text-ink leading-snug'
          : b.level === 2
            ? 'text-[15.5px] font-semibold text-ink leading-snug'
            : 'text-[13px] font-semibold text-ink-2 uppercase tracking-wide leading-snug';
      return (
        <p key={key} className={cls}>
          {inline(b.text)}
        </p>
      );
    }

    case 'code':
      return (
        <pre key={key} className="overflow-x-auto rounded-xl border border-line bg-raised px-4 py-3 text-[13px] font-mono leading-relaxed text-ink-2 whitespace-pre-wrap break-all">
          <code>{b.text}</code>
        </pre>
      );

    case 'ul':
      return (
        <ul key={key} className="space-y-1.5 pl-1">
          {b.items.map((item, j) => (
            <li key={j} className="flex gap-2.5">
              <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={key} className="list-none space-y-1.5 pl-1">
          {b.items.map((item, j) => (
            <li key={j} className="flex gap-2.5">
              <span className="mt-[0.1em] min-w-[1.5ch] shrink-0 font-mono text-[13px] tabular-nums text-ink-3">
                {j + 1}.
              </span>
              <span>{inline(item)}</span>
            </li>
          ))}
        </ol>
      );

    case 'p':
      return (
        <p key={key}>
          {b.lines.map((l, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(l)}
            </Fragment>
          ))}
        </p>
      );
  }
}

// ─── inline ───────────────────────────────────────────────────────────────────

/**
 * Inline Markdown → React nodes. Safe: no HTML is ever produced.
 *
 * The regex splits on the longest-matching pattern first (named link > bare link > bold > italic > code)
 * so that `**[text](url)**` doesn't accidentally match the `**` before checking for a link.
 */
const INLINE_RE =
  /(\[([^\]]{1,200})\]\((https:\/\/[^\s)]{1,500})\)|`[^`]{1,1000}`|\*\*[^*]{1,1000}\*\*|(?<!\*)\*(?!\*)(?:[^*]{1,500})(?<!\*)\*(?!\*)|(?<!_)_(?!_)(?:[^_]{1,500})(?<!_)_(?!_)|https:\/\/[^\s<>()[\]]{1,500})/g;

function inline(s: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;

  for (const match of s.matchAll(INLINE_RE)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(s.slice(last, start));
    last = start + match[0].length;

    const p = match[0];

    // Named link [text](https://…)
    if (p.startsWith('[')) {
      const label = match[2];
      const href = match[3];
      nodes.push(
        <a key={start} href={href} target="_blank" rel="nofollow noopener noreferrer ugc" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
          {label}
        </a>,
      );
      continue;
    }

    // Bare link
    if (p.startsWith('https://')) {
      const url = p.replace(/[.,!?;:]+$/, '');
      nodes.push(
        <a key={start} href={url} target="_blank" rel="nofollow noopener noreferrer ugc" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
          {url.replace(/^https:\/\//, '')}
        </a>,
      );
      continue;
    }

    // Bold
    if (p.startsWith('**')) {
      nodes.push(<strong key={start} className="font-semibold text-ink">{p.slice(2, -2)}</strong>);
      continue;
    }

    // Italic
    if (p.startsWith('*') || p.startsWith('_')) {
      nodes.push(<em key={start} className="italic">{p.slice(1, -1)}</em>);
      continue;
    }

    // Inline code
    if (p.startsWith('`')) {
      nodes.push(
        <code key={start} className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-[0.9em] text-ink-2">
          {p.slice(1, -1)}
        </code>,
      );
      continue;
    }

    nodes.push(p);
  }

  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}
