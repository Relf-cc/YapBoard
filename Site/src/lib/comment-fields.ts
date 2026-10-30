// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * The parts of a comment the browser needs too: the length limits, the shape of a post, and the shape of a
 * thread as the page receives it.
 *
 * Split out of comments.ts for the same reason pro-fields.ts is split out of pro.ts - that file is
 * 'server-only', and the form has to know the same character limit the route validates against or the two
 * disagree, which shows up as a textarea that happily accepts text the server then refuses.
 *
 * Nothing here touches the database, and nothing here decides anything. The rules live in comments.ts.
 */
import { z } from 'zod';
import { LISTING_KINDS, type ListingKind } from './pro-fields';

export const MAX_BODY = 2000;
/** Short enough that "nice" is impossible, long enough that one honest sentence is fine. */
export const MIN_REVIEW_BODY = 40;
export const MIN_REPLY_BODY = 2;

export const isCommentKind = (v: unknown): v is ListingKind => (LISTING_KINDS as readonly string[]).includes(v as string);

export const postSchema = z.object({
  kind: z.string().refine(isCommentKind, 'Unknown board'),
  listingId: z.string().min(1).max(64),
  body: z.string().trim().min(1, 'Write something first').max(MAX_BODY, `Keep it under ${MAX_BODY} characters`),
  /** 1-5 on a review, null or absent on a reply. */
  rating: z.number().int().min(1).max(5).nullish(),
  parentId: z
    .string()
    .max(64)
    .nullish()
    .transform((v) => v || null),
});

export type PostInput = z.infer<typeof postSchema>;

export const editSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(MAX_BODY, `Keep it under ${MAX_BODY} characters`),
  rating: z.number().int().min(1).max(5).nullish(),
});

export type EditInput = z.infer<typeof editSchema>;

export type ThreadWriter = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  /** Holds a YapBoard Pro plan. About the person, not about this listing (src/lib/pro.ts `proUsers`). */
  pro: boolean;
  /** Owns YapBoard itself. Resolved on the server, so the owner id stays off the wire. */
  siteOwner: boolean;
};

export type ThreadComment = {
  id: string;
  rating: number | null;
  body: string;
  edited: boolean;
  createdAt: string;
  writer: ThreadWriter;
  /** Only ever set for staff and for the person who wrote it - everyone else is served the row left out. */
  hidden: { as: string | null } | null;
  replies: ThreadComment[];
  /** The thread holds a reply from the owner or a co-manager. Only meaningful on a top-level review. */
  answered: boolean;
};

export type Thread = {
  reviews: ThreadComment[];
  /** The reader's own review, if they have one, so the form opens filled in rather than blank. */
  mine: { id: string; rating: number | null; body: string } | null;
  reviewCount: number;
  ratingSum: number;
  commentCount: number;
  /** The board average every listing's own rating is shrunk toward (src/lib/ratings.ts). */
  boardMean: number;
};
