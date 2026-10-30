// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * What a star rating is allowed to say.
 *
 * Its own file, with no database in it, because two very different things need the same answer and must
 * never disagree about it: the number drawn under a listing's name, and the `ratingFactor` the ranking
 * multiplies by (src/lib/engagement.ts). A display that flatters and a ranking that doesn't - or the other
 * way round - is the kind of inconsistency nobody finds until an owner does.
 *
 * ## Why never the plain mean
 *
 * One five-star review is not a five-star listing; it is one person. A raw average says 5.0 either way, so
 * a brand-new listing with a single friendly review would outshine one with forty reviews averaging 4.6 -
 * and the fastest way to a perfect score would be to have almost no reviews at all, which is exactly the
 * wrong thing to reward.
 *
 * So the mean is pulled toward the board's own average by a prior worth `PRIOR_WEIGHT` imaginary reviews.
 * Few reviews, and the number barely moves off the board average; enough reviews, and the prior washes out
 * and the listing's own reviews speak. Below `MIN_SHOWN` no number is printed at all - the stars and the
 * count are honest where "4.3 from two reviews" is not.
 */

/** How many imaginary board-average reviews every listing starts with. */
export const PRIOR_WEIGHT = 5;

/** Reviews needed before a listing shows a number rather than just its stars and a count. */
export const MIN_SHOWN = 5;

/** Where the board average sits before there is a board - the midpoint, so the prior pulls neither way. */
export const DEFAULT_BOARD_MEAN = 3.5;

/**
 * The rating to show, and to rank on: the listing's reviews blended with the board average.
 *
 * Returns null when there are no reviews, which callers draw as "no reviews yet" rather than as a zero -
 * a listing nobody has reviewed is not a bad listing.
 */
export function shownRating(ratingSum: number, reviewCount: number, boardMean = DEFAULT_BOARD_MEAN): number | null {
  if (reviewCount <= 0) return null;
  return (PRIOR_WEIGHT * boardMean + ratingSum) / (PRIOR_WEIGHT + reviewCount);
}

/** The same number, rounded the way it is printed, or null while there are too few reviews to print one. */
export function displayRating(ratingSum: number, reviewCount: number, boardMean = DEFAULT_BOARD_MEAN): string | null {
  if (reviewCount < MIN_SHOWN) return null;
  const r = shownRating(ratingSum, reviewCount, boardMean);
  return r === null ? null : r.toFixed(1);
}

/**
 * The ranking's rating term, clamped to 0.9 - 1.1.
 *
 * Deliberately tiny: at a 72-hour half-life the whole range is worth about a day of freshness either way
 * (src/lib/engagement.ts explains that conversion). A rating that moved listings hard would make the first
 * bad review worth fighting over, and a review section owners fight is one readers stop trusting.
 *
 * A listing with no reviews gets exactly 1.0 - neither rewarded nor punished for the silence.
 */
export function ratingFactor(ratingSum: number, reviewCount: number, boardMean = DEFAULT_BOARD_MEAN): number {
  const r = shownRating(ratingSum, reviewCount, boardMean);
  if (r === null) return 1;
  return Math.min(1.1, Math.max(0.9, 0.9 + 0.05 * (r - 3)));
}

/** 1-5, as the form and the API both need to check it. */
export const isRating = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
