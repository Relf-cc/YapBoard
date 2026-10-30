'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import clsx from 'clsx';
import { EyeOff, Undo2 } from 'lucide-react';
import { hideCommentAsStaff, restoreComment } from '@/app/portal/actions';

/**
 * Hide or restore a reported comment.
 *
 * Staff are the only people who can take down a review of a listing - an owner can report one and nothing
 * more (src/lib/comments.ts) - so this is the other half of "money buys reach, never silence". Every press
 * writes an audit entry, and the row itself is kept either way.
 */
export function CommentActions({ commentId, hidden }: { commentId: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hidden ? (
        <button
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await restoreComment(commentId);
              setMsg(r.ok ? r.message : r.error);
            })
          }
        >
          <Undo2 size={14} /> Put it back
        </button>
      ) : (
        <button
          className={clsx('btn btn-danger btn-sm')}
          disabled={pending}
          onClick={() => {
            const note = window.prompt('Why is this being hidden? (kept with the row, and in the audit log)');
            if (note === null) return;
            start(async () => {
              const r = await hideCommentAsStaff({ commentId, note: note.trim() || undefined });
              setMsg(r.ok ? r.message : r.error);
            });
          }}
        >
          <EyeOff size={14} /> Hide it
        </button>
      )}
      {msg && <span className="text-[12.5px] text-ink-3">{msg}</span>}
    </div>
  );
}
