// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { Fragment } from 'react';

/**
 * Release notes, as GitHub hands them over: Markdown written by whoever cut the release.
 *
 * Rendered the same way a listing's description is — React elements only, never HTML — because this text comes
 * from a third party's repo rather than from the lister, and a changelog is the last place that should be able
 * to put markup on the page. It covers what release notes actually use: headings, bullets, bold, code, links,
 * and GitHub's "Full Changelog" compare line. Anything else falls through as plain text, which is the right
 * failure: an unstyled line reads fine, a broken one doesn't.
 */
export function Changelog({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="space-y-4 text-[14.5px] leading-[1.7] text-ink-2 break-words">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());

        // A fenced code block: shown as-is, since that's usually a command people are meant to copy.
        if (/^\s*```/.test(block)) {
          const code = block.replace(/^\s*```[a-z]*\n?/i, '').replace(/```\s*$/, '');
          return (
            <pre key={i} className="overflow-x-auto rounded-xl border border-line bg-raised p-4 font-mono text-[12.5px] text-ink-2">
              {code}
            </pre>
          );
        }

        const heading = lines[0].match(/^(#{1,6})\s+(.*)$/);
        if (heading && lines.length === 1) {
          return (
            <h3 key={i} className={heading[1].length <= 2 ? 'pt-2 font-display text-[16px] font-bold text-ink' : 'pt-1 text-[14.5px] font-semibold text-ink'}>
              {inline(heading[2])}
            </h3>
          );
        }

        if (lines.every((l) => /^\s*([-*+]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className={ordered ? 'min-w-4 shrink-0 text-right text-xs tabular-nums text-ink-3' : 'mt-[0.65em] size-1.5 shrink-0 rounded-full bg-accent'}>
                    {ordered ? `${j + 1}.` : ''}
                  </span>
                  <span>{inline(l.replace(/^\s*([-*+]|\d+\.)\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i}>
            {lines.map((l, j) => {
              const h = l.match(/^(#{1,6})\s+(.*)$/);
              return (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {h ? <b className="text-ink">{inline(h[2])}</b> : inline(l)}
                </Fragment>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

/** Bold, inline code, bare links and [text](url) links. Everything else stays as typed. */
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()]+)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em] text-ink-2">{part.slice(1, -1)}</code>;

    const md = part.match(/^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (md) return <Out key={i} href={md[2]}>{md[1]}</Out>;

    if (/^https?:\/\//.test(part)) {
      const url = part.replace(/[.,!?]+$/, '');
      return <Out key={i} href={url}>{url.replace(/^https?:\/\//, '')}</Out>;
    }
    return part;
  });
}

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  // https only: a changelog shouldn't be able to produce a javascript: or data: link, however it was written.
  if (!/^https:\/\//.test(href)) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="nofollow noopener noreferrer ugc" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
      {children}
    </a>
  );
}
