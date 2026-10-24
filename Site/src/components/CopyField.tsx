'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import clsx from 'clsx';

export function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={clsx('flex items-center gap-2 rounded-[10px] border border-line-strong bg-raised pl-3.5 pr-1.5 h-11', className)}>
      <code className="flex-1 truncate font-mono text-sm text-ink-2">{value}</code>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
