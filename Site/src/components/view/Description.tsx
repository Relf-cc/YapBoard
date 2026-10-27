// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { Fragment } from 'react';

/**
 * Plain-text description with a little formatting: blank lines make paragraphs, "- " lines make lists,
 * **bold**, and https links. Built from React elements only, so nothing a lister writes becomes HTML.
 */
export function Description({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="space-y-4 text-[15.5px] leading-[1.75] text-ink-2 break-words">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{inline(l.replace(/^\s*[-•*]\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|https:\/\/[^\s<>()]+)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (/^https:\/\//.test(part)) {
      const url = part.replace(/[.,!?]+$/, '');
      return (
        <a key={i} href={url} target="_blank" rel="nofollow noopener noreferrer ugc" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
          {url.replace(/^https:\/\//, '')}
        </a>
      );
    }
    return part;
  });
}
