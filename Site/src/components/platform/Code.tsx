'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import clsx from 'clsx';

/**
 * Code on the platform's pages: a block with a copy button, and tabs for the same thing in two languages.
 *
 * Highlighting is a small tokeniser rather than a syntax library, because the only code here is written by
 * us, in four shapes (JSON bodies, JS, Python, shell), and a highlighter would be a dependency and a bundle
 * for the sake of a few hundred static lines. It emits React elements, never raw HTML, so a mistake in it
 * shows up as plain text rather than as injected markup.
 *
 * It colours comments, strings, numbers, literals and keywords, and nothing else. Anything it doesn't
 * recognise stays the default ink, which is the right failure: unstyled, still readable.
 */

export type Lang = 'json' | 'js' | 'py' | 'bash' | 'http' | 'text';

const KEYWORDS: Record<string, string[]> = {
  js: ['const', 'let', 'var', 'async', 'await', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'new', 'try', 'catch', 'throw', 'export', 'import', 'from', 'class', 'this', 'typeof', 'default'],
  py: ['def', 'async', 'await', 'return', 'if', 'elif', 'else', 'for', 'in', 'not', 'and', 'or', 'raise', 'try', 'except', 'with', 'as', 'import', 'from', 'class', 'self', 'pass', 'lambda'],
  bash: ['curl', 'export', 'echo', 'if', 'then', 'fi'],
  http: [],
  json: [],
  text: [],
};
const LITERALS = ['true', 'false', 'null', 'None', 'True', 'False', 'undefined'];

const CLS = {
  comment: 'text-ink-3 italic',
  string: 'text-ok',
  number: 'text-warn',
  literal: 'text-warn',
  keyword: 'text-accent',
  key: 'text-ink',
  method: 'text-accent font-semibold',
};

type Piece = { text: string; cls?: string };

/** One line, split into coloured pieces. Comments win, then strings, then the rest. */
function tokenize(line: string, lang: Lang): Piece[] {
  const words = KEYWORDS[lang] ?? [];
  const commentStart = lang === 'py' || lang === 'bash' ? '#' : '//';
  const out: Piece[] = [];
  let rest = line;

  // A comment marker inside a string isn't a comment, so strings are matched in the same pass.
  const re = new RegExp(
    [
      `(${commentStart.replace('/', '\\/')}.*$)`, // 1 comment
      '("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)', // 2 string
      '\\b(\\d+(?:\\.\\d+)?)\\b', // 3 number
      `\\b(${[...LITERALS, ...words].join('|')})\\b`, // 4 word
    ].join('|'),
    'g',
  );

  let last = 0;
  for (const m of rest.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: rest.slice(last, at) });
    const [whole, comment, str, num, word] = m;
    if (comment) out.push({ text: whole, cls: CLS.comment });
    else if (str) {
      // In an object body, "name": is a key and "value" is a value — colour them apart.
      const after = rest.slice(at + whole.length).match(/^\s*:/);
      out.push({ text: whole, cls: after ? CLS.key : CLS.string });
    } else if (num) out.push({ text: whole, cls: CLS.number });
    else if (word) out.push({ text: whole, cls: LITERALS.includes(word) ? CLS.literal : CLS.keyword });
    last = at + whole.length;
  }
  if (last < rest.length) out.push({ text: rest.slice(last) });
  return out.length ? out : [{ text: line }];
}

function Highlighted({ code, lang }: { code: string; lang: Lang }) {
  return (
    <>
      {code.split('\n').map((line, i) => (
        <span key={i} className="block">
          {tokenize(line, lang).map((p, j) => (
            <span key={j} className={p.cls}>
              {p.text}
            </span>
          ))}
          {'\n'}
        </span>
      ))}
    </>
  );
}

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      className={clsx('btn btn-secondary btn-sm', className)}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function CodeBlock({ code, lang = 'text', label, className }: { code: string; lang?: Lang; label?: string; className?: string }) {
  return (
    <div className={clsx('overflow-hidden rounded-[10px] border border-line-strong bg-raised', className)}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{label ?? lang}</span>
        <CopyButton value={code} className="ml-auto" />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">
        <code>
          <Highlighted code={code} lang={lang} />
        </code>
      </pre>
    </div>
  );
}

export type Tab = { label: string; lang?: Lang; code: string };

/** The same thing in several forms — JS and Python, or request and response. Remembers nothing; it's a view. */
export function CodeTabs({ tabs, className }: { tabs: Tab[]; className?: string }) {
  const [at, setAt] = useState(0);
  const tab = tabs[at] ?? tabs[0];
  if (!tab) return null;

  return (
    <div className={clsx('overflow-hidden rounded-[10px] border border-line-strong bg-raised', className)}>
      <div role="tablist" className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            type="button"
            aria-selected={i === at}
            onClick={() => setAt(i)}
            className={clsx(
              'inline-flex h-7 items-center rounded-md px-2.5 text-[12.5px] font-semibold transition-colors',
              i === at ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {t.label}
          </button>
        ))}
        <CopyButton value={tab.code} className="ml-auto" />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">
        <code>
          <Highlighted code={tab.code} lang={tab.lang ?? 'text'} />
        </code>
      </pre>
    </div>
  );
}

/** `GET` `/search/servers` as one copyable line, for an endpoint's header. */
export function EndpointLine({ method, path, base }: { method: string; path: string; base: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className={clsx('inline-flex h-6 shrink-0 items-center rounded-md px-2 font-mono text-[11px] font-bold', method === 'POST' ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2')}>{method}</span>
      <code className="min-w-0 truncate font-mono text-sm text-ink">{path}</code>
      <CopyButton value={`${base}${path}`} className="ml-auto shrink-0" />
    </div>
  );
}
