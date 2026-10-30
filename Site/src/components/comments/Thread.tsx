'use client';
// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownRight, EyeOff, Flag, MessageSquare, Pencil, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../Avatar';
import { OwnerMark } from '../Badge';
import { Modal, ModalDone } from '../Modal';
import { CommenterBadges } from './CommenterBadge';
import { StarPicker, Stars } from './Stars';
import { commenterBadges } from '@/lib/comment-badges';
import { MAX_BODY, MIN_REVIEW_BODY, type Thread as ThreadData, type ThreadComment } from '@/lib/comment-fields';
import { timeAgo } from '@/lib/format';
import { ABUSE_REASONS } from '@/lib/reports';
import { displayRating, shownRating } from '@/lib/ratings';

type Viewer = { id: string; role: string } | null;
type Listing = { ownerId: string; managerIds: string[] };

type Props = {
  kind: 'server' | 'bot' | 'client';
  listingId: string;
  thread: ThreadData;
  viewer: Viewer;
  listing: Listing;
  /** Stars are on for the board. Off: replies only, and the column keeps every rating already given. */
  ratings: boolean;
  /** Why this reader can't write a review, if they can't. */
  blocked: 'login' | 'own' | 'closed' | null;
  accent?: string;
};

const noun = { server: 'server', bot: 'bot', client: 'client' } as const;

export function Thread({ kind, listingId, thread, viewer, listing, ratings, blocked, accent }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const refresh = () => start(() => router.refresh());
  const asListing = { ownerId: listing.ownerId, managers: listing.managerIds.map((userId) => ({ userId })) };

  const rating = shownRating(thread.ratingSum, thread.reviewCount, thread.boardMean);
  const shown = displayRating(thread.ratingSum, thread.reviewCount, thread.boardMean);

  return (
    <section id="reviews" className="mt-12 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 className="text-lg font-bold">
          {thread.reviewCount === 0 ? 'Reviews' : `${thread.reviewCount} review${thread.reviewCount === 1 ? '' : 's'}`}
        </h2>
        {rating !== null && (
          <div className="flex items-center gap-2.5">
            <Stars value={rating} size={16} />
            {shown ? (
              <span className="font-display text-lg font-bold tabular-nums">{shown}</span>
            ) : (
              /*
                Under MIN_SHOWN reviews no number is printed. "4.3 from two reviews" reads as a measurement
                and isn't one - the stars and the count say exactly as much as is actually known.
              */
              <span className="text-[13px] text-ink-3">too few to score yet</span>
            )}
          </div>
        )}
      </div>

      {blocked !== 'closed' && (
        <ReviewForm
          kind={kind}
          listingId={listingId}
          mine={thread.mine}
          ratings={ratings}
          blocked={blocked}
          onDone={refresh}
          accent={accent}
        />
      )}

      <div className="mt-7 space-y-5">
        {thread.reviews.length === 0 && (
          <p className="text-[14px] text-ink-3">
            Nobody has reviewed this {noun[kind]} yet.{blocked === null && ' Be the first - say what it’s actually like in there.'}
          </p>
        )}
        {thread.reviews.map((r) => (
          <Review key={r.id} comment={r} listing={asListing} viewer={viewer} kind={kind} listingId={listingId} onDone={refresh} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ one review and its thread */

function Review({
  comment,
  listing,
  viewer,
  kind,
  listingId,
  onDone,
}: {
  comment: ThreadComment;
  listing: { ownerId: string; managers: { userId: string }[] };
  viewer: Viewer;
  kind: Props['kind'];
  listingId: string;
  onDone: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const runsIt = !!viewer && (viewer.id === listing.ownerId || listing.managers.some((m) => m.userId === viewer.id));

  return (
    <article className={clsx('card p-5', comment.hidden && 'opacity-55')}>
      <Body comment={comment} listing={listing} viewer={viewer} onDone={onDone} />

      {comment.answered && !comment.replies.some((r) => r.writer.id === listing.ownerId) && (
        <p className="mt-3 text-[12.5px] font-semibold text-accent">Answered by the team</p>
      )}

      {(comment.replies.length > 0 || replying) && (
        <div className="mt-4 space-y-4 border-l-2 border-line pl-4 sm:pl-5">
          {comment.replies.map((r) => (
            <Body key={r.id} comment={r} listing={listing} viewer={viewer} onDone={onDone} parentAuthorId={comment.writer.id} reply />
          ))}
          {replying && (
            <ReplyForm
              kind={kind}
              listingId={listingId}
              parentId={comment.id}
              onDone={() => {
                setReplying(false);
                onDone();
              }}
              onCancel={() => setReplying(false)}
            />
          )}
        </div>
      )}

      {!comment.hidden && viewer && !replying && (
        <button onClick={() => setReplying(true)} className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 transition-colors hover:text-accent">
          <CornerDownRight size={14} />
          {runsIt ? 'Reply as the owner' : 'Reply'}
        </button>
      )}
    </article>
  );
}

/** One comment's head, body and controls - the same for a review and for a reply. */
function Body({
  comment,
  listing,
  viewer,
  onDone,
  parentAuthorId,
  reply,
}: {
  comment: ThreadComment;
  listing: { ownerId: string; managers: { userId: string }[] };
  viewer: Viewer;
  onDone: () => void;
  parentAuthorId?: string;
  reply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const badges = commenterBadges(comment.writer, listing, parentAuthorId);
  const mine = viewer?.id === comment.writer.id;
  const staff = viewer?.role === 'STAFF' || viewer?.role === 'ADMIN';
  /**
   * An owner may hide a reply under their own comment, and nothing else. A review of their listing is not
   * theirs to remove at any price - that goes through Report and a staff decision. Mirrors `hidePower` in
   * src/lib/comments.ts, which is where it is actually enforced; this only decides what to draw.
   */
  const ownerMayHide = !!viewer && !!reply && (viewer.id === listing.ownerId || listing.managers.some((m) => m.userId === viewer.id)) && parentAuthorId === viewer.id;
  const canHide = !comment.hidden && (mine || staff || ownerMayHide);
  const canUnhide = !!comment.hidden && (staff || (mine && comment.hidden.as === 'author'));

  async function act(method: 'DELETE' | 'POST') {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/comments/${comment.id}`, { method }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) return onDone();
    setError(out.error || 'Couldn’t do that just now.');
  }

  if (editing) {
    return (
      <ReviewFields
        initialBody={comment.body}
        initialRating={comment.rating}
        ratings={comment.rating !== null}
        submitLabel="Save"
        minBody={comment.rating !== null ? MIN_REVIEW_BODY : 1}
        onCancel={() => setEditing(false)}
        send={async (body, rating) => {
          const res = await fetch(`/api/comments/${comment.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ body, rating }),
          }).catch(() => null);
          const out = res ? await res.json().catch(() => ({})) : {};
          if (!res?.ok) return out.error || 'Couldn’t save that.';
          setEditing(false);
          onDone();
          return null;
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <Link href={`/profile/${comment.writer.id}`} className="shrink-0">
          <Avatar src={comment.writer.avatarUrl} name={comment.writer.name} id={comment.writer.id} size={reply ? 30 : 38} round />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/profile/${comment.writer.id}`} className="truncate text-[14px] font-semibold hover:text-accent transition-colors">
              {comment.writer.name}
            </Link>
            {/* Outside the chip row, the way ProMark sits outside BadgeRow on a listing page. */}
            {comment.writer.siteOwner && <OwnerMark size={16} seed={comment.writer.id} />}
            <CommenterBadges kinds={badges} />
            <span className="text-[12px] text-ink-3">
              {timeAgo(comment.createdAt)}
              {comment.edited && ' · edited'}
            </span>
          </div>
          {comment.rating !== null && <Stars value={comment.rating} size={13} className="mt-1.5" />}
        </div>
      </div>

      {comment.hidden && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[12px] text-ink-3">
          <EyeOff size={12} />
          Hidden{comment.hidden.as === 'staff' ? ' by YapBoard staff' : comment.hidden.as === 'owner' ? ' by the listing owner' : ''} - only you and staff see this.
        </p>
      )}

      <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2">{comment.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-3">
        {mine && !comment.hidden && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 transition-colors hover:text-ink-2">
            <Pencil size={12} /> Edit
          </button>
        )}
        {canHide && (
          <button disabled={busy} onClick={() => act('DELETE')} className="inline-flex items-center gap-1 transition-colors hover:text-danger">
            <EyeOff size={12} /> Hide
          </button>
        )}
        {canUnhide && (
          <button disabled={busy} onClick={() => act('POST')} className="inline-flex items-center gap-1 transition-colors hover:text-ok">
            <Undo2 size={12} /> Put back
          </button>
        )}
        {viewer && !mine && !comment.hidden && (
          <button onClick={() => setReporting(true)} className="inline-flex items-center gap-1 transition-colors hover:text-danger">
            <Flag size={12} /> Report
          </button>
        )}
        {error && <span className="text-danger">{error}</span>}
      </div>

      <AnimatePresence>{reporting && <ReportDialog commentId={comment.id} onClose={() => setReporting(false)} />}</AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

function ReviewForm({
  kind,
  listingId,
  mine,
  ratings,
  blocked,
  onDone,
  accent,
}: {
  kind: Props['kind'];
  listingId: string;
  mine: ThreadData['mine'];
  ratings: boolean;
  blocked: Props['blocked'];
  onDone: () => void;
  accent?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  if (blocked === 'login') {
    return (
      <Link href={`/login?next=${encodeURIComponent(`${path}#reviews`)}`} className="mt-5 inline-flex btn btn-secondary btn-sm">
        <MessageSquare size={15} /> Log in to review
      </Link>
    );
  }
  if (blocked === 'own') {
    // Not an error, and worth saying why: an owner reviewing their own listing is the first thing a review
    // section loses its credibility to.
    return <p className="mt-5 text-[13px] text-ink-3">You run this {noun[kind]}, so you can’t review it - but you can reply to anybody who does.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-5 btn btn-secondary btn-sm" style={accent ? { borderColor: `color-mix(in srgb, ${accent} 35%, transparent)` } : undefined}>
        <MessageSquare size={15} />
        {mine ? 'Edit your review' : 'Write a review'}
      </button>
    );
  }

  return (
    <div className="mt-5 card p-5">
      <ReviewFields
        initialBody={mine?.body ?? ''}
        initialRating={mine?.rating ?? null}
        ratings={ratings}
        minBody={MIN_REVIEW_BODY}
        submitLabel={mine ? 'Save review' : 'Post review'}
        onCancel={() => setOpen(false)}
        send={async (body, rating) => {
          const res = await fetch(mine ? `/api/comments/${mine.id}` : '/api/comments', {
            method: mine ? 'PATCH' : 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(mine ? { body, rating } : { kind, listingId, body, rating }),
          }).catch(() => null);
          const out = res ? await res.json().catch(() => ({})) : {};
          if (!res?.ok) return out.error || 'Couldn’t post that just now.';
          setOpen(false);
          onDone();
          return null;
        }}
      />
    </div>
  );
}

/** The fields, shared by writing a review and editing one. `send` returns an error message, or null. */
function ReviewFields({
  initialBody,
  initialRating,
  ratings,
  minBody,
  submitLabel,
  onCancel,
  send,
}: {
  initialBody: string;
  initialRating: number | null;
  ratings: boolean;
  minBody: number;
  submitLabel: string;
  onCancel: () => void;
  send: (body: string, rating: number | null) => Promise<string | null>;
}) {
  const [body, setBody] = useState(initialBody);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const short = body.trim().length < minBody;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        setError('');
        const err = await send(body, ratings ? rating : null);
        setSending(false);
        if (err) setError(err);
      }}
    >
      {ratings && (
        <div className="mb-4">
          <span className="label">Your rating</span>
          <StarPicker value={rating} onChange={setRating} disabled={sending} />
        </div>
      )}
      <label className="block">
        <span className="flex items-baseline justify-between">
          <span className="label">What’s it like?</span>
          <span className={clsx('text-xs tabular-nums', short ? 'text-ink-3' : 'text-ink-3')}>
            {body.trim().length}/{MAX_BODY}
          </span>
        </span>
        <textarea
          className="field resize-none"
          rows={4}
          maxLength={MAX_BODY}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What goes on in there, who it suits, what you'd change."
        />
      </label>
      {short && minBody > 1 && <p className="mt-1.5 text-xs text-ink-3">{minBody - body.trim().length} more characters - a line or two is plenty.</p>}
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={sending || short || (ratings && !rating)} className="btn btn-primary btn-sm">
          {sending ? 'Posting…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ReplyForm({ kind, listingId, parentId, onDone, onCancel }: { kind: Props['kind']; listingId: string; parentId: string; onDone: () => void; onCancel: () => void }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        setError('');
        const res = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind, listingId, parentId, body }),
        }).catch(() => null);
        const out = res ? await res.json().catch(() => ({})) : {};
        setSending(false);
        if (res?.ok) return onDone();
        setError(out.error || 'Couldn’t post that just now.');
      }}
    >
      <textarea
        className="field resize-none text-[14px]"
        rows={2}
        maxLength={MAX_BODY}
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Reply…"
      />
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={sending || !body.trim()} className="btn btn-primary btn-sm">
          {sending ? 'Posting…' : 'Reply'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Reporting a comment rather than a listing. Same queue, same staff screen (src/lib/reports.ts). */
function ReportDialog({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  if (state === 'done') {
    return (
      <Modal onClose={onClose}>
        <ModalDone title="Thanks, we’ve got it" onClose={onClose}>
          Staff read every report. Nothing is hidden automatically - a person decides.
        </ModalDone>
      </Modal>
    );
  }

  return (
    <Modal title="Report this comment" sub="Only YapBoard staff see reports." onClose={onClose}>
      <form
        className="mt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setState('sending');
          setError('');
          const res = await fetch(`/api/comments/${commentId}/report`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reason, details }),
          }).catch(() => null);
          const out = res ? await res.json().catch(() => ({})) : {};
          if (!res?.ok) {
            setError(out.error || 'Something went wrong. Try again.');
            setState('idle');
            return;
          }
          setState('done');
        }}
      >
        <fieldset>
          <legend className="label">What’s wrong?</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ABUSE_REASONS).map(([k, label]) => (
              <label
                key={k}
                className={clsx(
                  'cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50',
                  reason === k ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:border-line-strong',
                )}
              >
                <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 block">
          <span className="flex items-baseline justify-between">
            <span className="label">Details</span>
            <span className="text-xs tabular-nums text-ink-3">{details.length}/1500</span>
          </span>
          <textarea className="field resize-none" rows={3} maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What's wrong with it?" />
        </label>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={!reason || details.trim().length < 10 || state === 'sending'} className="btn btn-primary btn-sm">
            {state === 'sending' ? 'Sending…' : 'Send report'}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
