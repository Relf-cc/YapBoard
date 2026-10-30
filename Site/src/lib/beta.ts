// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
/**
 * beta.yapboard.dev: the same app, on its own stack, over a **copy** of the real database.
 *
 * One variable turns it on and names the build, because two variables would eventually disagree and the
 * way they disagree is that a beta forgets it is one. `NEXT_PUBLIC_BETA_VERSION="v1.10"` is both "this is
 * the beta" and "this is which beta"; empty is production.
 *
 * No 'server-only': the badge in the navbar renders on the client, and `NEXT_PUBLIC_*` is inlined at build
 * time, so both sides read the same value from the same place.
 *
 * ## What "beta" changes, and why each one
 *
 * The data is real people's servers, copied. That is what makes the beta worth anything - an empty board
 * tests nothing - and it is also the whole of the risk, because every row names somebody who never asked
 * to be in a test. So beta mode is not a cosmetic flag. It is the set of interlocks that stop a copy of
 * the board from acting like the board:
 *
 * - **Nothing reaches a stranger.** The beta bot has a token of its own, so it *could* DM any of the real
 *   accounts in the copy. DM delivery is therefore limited to staff (`BETA_DM_STAFF_ONLY`), and broadcasts
 *   are refused outright. A review written on beta must never turn into a message to somebody who cannot
 *   see the thing it is about.
 * - **Nothing takes money.** Stripe is left unconfigured, so `billingEnabled()` is false and every billing
 *   route answers 503 (src/lib/env.ts). The copied subscription rows still grant Pro, which is exactly
 *   what makes the ranking boost testable.
 * - **Nothing is shared with production.** Separate database, separate session secret, and - the one that
 *   is easy to get wrong and silent when you do - **no cookie domain**. A `.yapboard.dev` cookie on beta
 *   is sent to production too, which would make the two sites one site. `checkBetaConfig` refuses to let
 *   that start.
 * - **Nobody is misled.** Every page says it is a copy, because an owner who finds a review of their
 *   server here needs to know it does not exist on the real board.
 */

/** The build, e.g. "v1.10". Empty in production - that is what makes production production. */
export const BETA_VERSION = (process.env.NEXT_PUBLIC_BETA_VERSION || '').trim();

export const IS_BETA = BETA_VERSION.length > 0;

/**
 * On beta the bot only ever DMs staff.
 *
 * The recipients in a copied `BotDm` queue are real Yapin' accounts who have no idea the beta exists. A
 * separate bot token makes reaching them possible, so this is what makes it not happen - while still
 * leaving the whole path testable, because a staff member can post a review on their own listing and get
 * the DM for real.
 */
export const BETA_DM_STAFF_ONLY = true;

/** Said on every page, and in the portal. Short, because it goes in a bar nobody should have to read twice. */
export const BETA_NOTICE = 'This is the YapBoard beta, running on a copy of the real board. Anything you write here stays here.';
