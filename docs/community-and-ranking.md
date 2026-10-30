<!-- Copyright (c) 2026 Christian Relf. All rights reserved. Proprietary and confidential. -->

# Discussion, profiles and ranking

A plan for five things that are really one thing: give people a reason to come back to
YapBoard, and make the board reward the listings people actually talk about.

1. Comments and reviews on servers, bots and clients, with role badges on replies
2. Public profiles at `/profile/<userId>`
3. A ranking that counts real engagement, not just bumps
4. What YapBoard Pro buys in that ranking, and the limits on it
5. How the bot and the site pull people into the discussion

Current state it builds on: ranking is `Server.rankedAt` - the last bump, nudged forward a
few minutes per vote (`src/lib/votes.ts`). There is no comment table, no user page, no
per-listing engagement signal, and Pro buys presentation only (`src/lib/pro.ts`).

---

## The two rules everything below follows

**Money buys reach, never silence.** Pro multiplies a listing's score and labels the card
`PROMOTED`. It never lets an owner hide a review, bury a rating, or outrank a listing that
is genuinely more active. A boost that could do that would make the board worth less than
no board at all - and reviews nobody trusts bring no traffic.

**Nothing is deleted, only hidden.** The same rule the rest of the codebase already keeps
(`Vote.revokedAt`, `ProAssignment`, the lapse rules in `pro.ts`). A removed comment is
hidden and kept, so a wrong call is reversible and an audit trail is possible.

---

## 1. Comments and reviews

### One table, not two

A review (a rating plus a paragraph) and a reply to one are the same row with different
fields set. One table means one moderation queue, one report path, one badge renderer, one
rate limiter:

```prisma
/// One thing somebody wrote under a listing. A top-level row with a `rating` is a review;
/// a row with a `parentId` is a reply. Exactly one of serverId/botId/clientId is set, the
/// same shape Report and ListingManager use.
model Comment {
  id         String    @id @default(cuid())
  serverId   String?
  botId      String?
  clientId   String?
  userId     String
  /// Null for a reply. 1-5 on a top-level review.
  rating     Int?
  body       String
  /// Replies are one level deep on purpose: a thread under a review, not a forum.
  parentId   String?
  parent     Comment?  @relation("thread", fields: [parentId], references: [id], onDelete: Cascade)
  replies    Comment[] @relation("thread")
  /// Keyed hash of the writer's network, same as Vote.ipHash - for spotting rings.
  ipHash     String
  /// Set when edited, so the page can say so rather than quietly change under a reader.
  editedAt   DateTime?
  /// Hidden, never deleted. `hiddenBy` is author | owner | staff; an owner may only hide
  /// replies under their *own* comment, never criticism of their listing.
  hiddenAt   DateTime?
  hiddenBy   String?
  hiddenNote String?
  /// Does this row feed the ranking? Written once at post time by the spam rules in
  /// src/lib/engagement.ts, so a re-rank never has to re-judge old rows.
  counts     Boolean   @default(true)
  createdAt  DateTime  @default(now())

  @@index([serverId, createdAt])
  @@index([botId, createdAt])
  @@index([clientId, createdAt])
  @@index([userId, createdAt])
  @@index([parentId])
  @@index([ipHash, createdAt])
}
```

Plus: `Report` gains a nullable `commentId`, so the report dialog already on every listing
works on a comment too and the portal queue needs no new screen - only a new target kind in
`reportTarget()` (`src/lib/reports.ts`).

Aggregates live on the listing so a card never counts rows: `reviewCount Int`,
`ratingSum Int`, `commentCount Int` on `Server`, `BotListing` and `ClientListing`.

### Rules, and why each one is there

| Rule | Reason |
| --- | --- |
| One top-level review per person per listing, editable forever | A rating is an opinion, not a vote tally. Editing keeps it honest when a server improves. |
| You cannot review a listing you own or co-manage | Same rule votes already have (`castVote`). You *can* reply, with a badge. |
| Replies: one level deep, no cap | A thread under a review, not a forum YapBoard has to moderate. |
| Minimum 40 characters on a review, 2 on a reply | "nice" is not a review. Short rows post fine but get `counts = false`. |
| Min account age, per-day caps, per-network caps - the `voting` Setting pattern | Reuse `src/lib/votes.ts` wholesale. Staff tune it from the portal without a deploy. |
| 15-minute edit window before `editedAt` shows | Typos are not revisions. |
| An owner may hide replies under their own comment only | Owners moderate their conversation, not their verdict. |
| Ratings display with a prior until there are 5 of them | One 5-star review must not read as "5.0". See *Showing a rating* below. |
| A banned user's rows stop counting and stop showing | Already how votes behave (`counted` in `votes.ts`). |

### Badges on a comment

Derived at render time, never stored - a stored badge goes stale the moment someone is
promoted, demoted, or sells their server, and a stale "Staff" badge is a trust problem.
Everything needed is already in the query a listing page runs:

| Badge | Source | Looks like |
| --- | --- | --- |
| `OWNER` | `comment.userId === listing.ownerId` | Accent-filled chip, "Owner" |
| `TEAM` | in `listing.managers` (`managerSelect` is already spread everywhere) | Outlined accent chip, "Team" |
| `STAFF` | `User.role === 'STAFF'` | YapBoard orange, "YapBoard Staff" |
| `ADMIN` | `User.role === 'ADMIN'` | YapBoard orange, filled, "YapBoard Admin" |
| `PRO` | `isPro` on any listing they own | The existing `ProMark` seal, small |
| `AUTHOR` | replying under their own review | Muted grey, "OP" |

New file `src/lib/comment-badges.ts`, next to `src/lib/badges.ts` and following its shape (a
definition map, a display order, one `commenterBadges(user, listing)`), rendered by a small
`<CommenterBadge>`. The listing-seal `<Badge>` component is for listings and stays that way.

The owner badge also drives one thing worth more than the chip: a review whose thread
contains an owner reply gets an **"Owner replied"** marker in the list. That is the single
strongest signal a board can give that an owner is present and worth joining, and it costs
one boolean in the query.

### Showing a rating

Never a bare average. A listing with one 5-star review must not outshine one with forty
averaging 4.6. Use a Bayesian prior toward the board mean:

```text
shown = (C * boardMean + ratingSum) / (C + reviewCount)      // C = 5
```

Below 5 reviews the page shows "3 reviews" and the stars, not a number. The same function
feeds the ranking, so the two can never disagree.

---

## 2. Profiles

`/profile/<userId>` - canonical, because ids are stable and usernames change (the schema
says so at `User`). `/@<username>` 302s to it, so a link anybody can type still works.

### What it shows

- Avatar, display name, username, "on YapBoard since <month year>", role badge
- **Listings**: servers, bots and clients they own, plus ones they co-manage, marked as
  such. Public rows only - an unlisted or hidden listing never appears on a profile.
- **Contribution counters**: bumps given, votes cast, reviews written, replies written
- **User badges** (see phase 5)
- An optional 200-character bio and one link, both moderatable, both `rel="ugc nofollow"`

### Counters

Derive, don't denormalise - for now. The profile page is four `count()` calls across `Bump`,
`BotBump`, `ClientBump` and `Vote`, each on an index that already exists
(`@@index([userId, createdAt])`). Cheap and always correct. Add a `UserStats` roll-up only
when a leaderboard needs it, and write it from the same place that writes the comment -
never from a second path that can drift.

### Privacy and control

- `User.profileHidden Boolean @default(false)` - a bare page saying the profile is private,
  plus `noindex`. The listings still show their owner on the listing page; this hides the
  aggregate, which is the part people actually object to.
- `User.bio` and `User.link`, both nullable, both reportable through the existing queue.
- Banned accounts: profile 404s to the public, stays visible to staff.

### Why it earns its keep

Every profile is an indexable page that links to listings, and every comment on the board
becomes a link to one. For a directory that is the cheapest internal linking there is - and
a person who has a page with their name on it comes back to look at it.

---

## 3. Ranking

### Do not overload `rankedAt`

"Recently bumped" is a promise: bump your server, go to the top. Owners organise around it
and the bot's reminders are built on it. Quietly turning it into an engagement score would
break that promise. So:

- `rankedAt` stays exactly as it is, and `sort=bumped` keeps using it.
- A new `hotScore Float @default(0)` column, with a new **`sort=hot`, labelled "Active",
  which becomes the default** on `/servers`, `/bots` and `/clients`.
- `sort=members` and `sort=new` stay unboosted and unscored. A Pro boost inside a sort that
  says "most members" would be a lie.

On all three listing tables, that is one column and one index:

```prisma
hotScore  Float    @default(0)
/// Set when hotScore was last rebuilt. Not used for ordering - see "The score, exactly".
hotAt     DateTime?

@@index([status, hotScore])
```

`hotAt` exists only so the portal and the nightly rebuild can tell a stale row from a quiet
one. Nothing reads it to sort, and nothing should start to.

### Three things the score has to survive

Before any formula, the constraints - because they rule out most of the obvious designs:

1. **Ordering must be correct between recomputes.** A score that decays with time is only
   comparable against another score computed at the same instant. Store "the decayed value
   as of when I last touched this row" and two rows touched an hour apart are no longer
   comparable, so the sort is quietly wrong for everything the sweep has not reached yet.
   This is the trap, and it is the thing that decides the storage format.
2. **Activity has to be removable after the fact.** A spam review hidden on Tuesday must
   stop counting for Monday too, exactly, not approximately.
3. **A single person's enthusiasm must not be worth much.** Which means the unit of credit
   is the *actor*, not the event - and that makes the score non-incremental, because whether
   an event counts depends on what that actor already did here.

### The score, exactly

Everything is computed in `log2` space and **anchored to a fixed epoch**, which is what
solves (1):

```text
                                                     t_i = hours since RANK_EPOCH
activity = log2( Σ_i  w_i · trust_i · 2^(t_i / H) )   H   = half-life, 72h default

hotScore = activity
         + log2(diversityFactor)     // distinct counted actors, shrunk
         + log2(sizeFactor)          // members, gently
         + log2(ratingFactor)        // the Bayesian rating from §1
         + log2(proBoost)            // §4
         - penalty                   // log2 units, see below
```

The decayed score a reader would intuitively mean is `hotScore - T/H` at any time `T`. But
`T/H` is *the same for every row*, so it cannot change the order. Dropping it is what makes
`ORDER BY hotScore DESC` correct at every instant, forever, with no cron keeping it honest -
a row written a month ago still sorts correctly against one written a second ago. The sweep
then exists only to pick up changes to the *inputs* (Pro lapsing, a setting changing,
capping shifting), never to stop the ordering rotting.

Three consequences worth stating plainly:

- **The stored number grows without bound.** That is fine and it is the point. At H = 72h a
  double runs out at roughly `2^1023`, i.e. about 8.4 years past the epoch. Re-anchoring is
  one statement - `UPDATE … SET "hotScore" = "hotScore" - k` across the board, with
  `RANK_EPOCH` moved forward by `k · H` hours - and it changes no ordering at all. Put it in
  the same yearly maintenance note as anything else; do not let it be a surprise.
- **The sum is accumulated with log-sum-exp**, never by exponentiating and adding, or the
  intermediate `2^(t/H)` overflows long before the score does:
  `logsum(a, b) = max(a,b) + log2(1 + 2^(-|a-b|))`.
- **Weights are ratios, not points.** Because they sit inside a log of a sum, doubling every
  weight changes nothing. Only their relation to each other, and to the half-life, matters.

### Reading the weights as time

The useful way to sanity-check any weight is to convert it to age, since that is the only
other thing in the sum. Two contributions are equal when
`Δt = H · log2(w₁ / w₂)`.

| Signal | Weight | Per actor, per window | Why |
| --- | --- | --- | --- |
| Review (40+ chars, `counts = true`) | 14 | 1 | The hardest thing to fake, the most use to a reader |
| Bump | 10 | 4 | Already capped to one per 2h by the cooldown |
| Vote | 6 | 2 | Already rate-limited and network-capped by `votes.ts` |
| Reply | 5 | 3 | Cheaper than a review, so worth less |
| Listing created | 8 | 1 | One-off, so a day-one listing is not invisible |
| Join click | 1 | 1 | Easy to fake, so near-nothing, and deduped by `ipHash` |
| View | 0 | - | Never rank on views. A view is a counter, not a signal. |

So at the defaults: **a reply posted now is worth a review posted four and a half days ago**
(`72 · log2(14/5) = 107h`). A bump now is worth a review from a day and a half ago. If those
sentences sound wrong, the weights are wrong - that is the test, and it is a far better one
than staring at the numbers.

Weights are **per board**, because the boards do not offer the same signals: a client listing
cannot be voted on and a bot listing has no join click. One table per kind in the setting,
rather than pretending the missing signal is a zero - otherwise clients are structurally
ranked below servers for a reason that has nothing to do with them.

### Per-actor capping, and why bumps are the interesting case

The "per actor, per window" column above is the whole anti-spam core. For each
`(actor, listing, kind)` only the N most recent events enter the sum; the rest are dropped at
recompute time, not at write time, so changing N re-ranks the past correctly.

The case that matters: **a bump counts whoever makes it, including the owner.** Bumping is
the owner's job, the bot's reminders are built on it, and zeroing owner bumps would break the
loop the whole product runs on. But four bumps is all one person can contribute, and then the
diversity factor below takes over. The practical effect is the one asked for:

> A server where only the owner bumps still ranks. A server where twenty members bump, vote
> and talk ranks far above it.

That is also the main **migration risk**: owners who have been self-bumping a quiet server to
the top of `sort=bumped` will drop under `sort=hot`. That is the intended behaviour and it is
exactly the kind of change that needs the `Announcement` rather than a silent flip.

### diversityFactor - the single-fan problem

```text
diversityFactor = actors / (actors + K)        // K = 2
```

| Counted actors | Factor | Worth, in age |
| --- | --- | --- |
| 1 | 0.33 | −4.6 days |
| 3 | 0.60 | −2.1 days |
| 10 | 0.83 | −0.8 days |
| 50 | 0.96 | −0.2 days |

Shrinkage rather than a cliff, and the same shape as the rating prior in §1, so there is one
idea in the codebase instead of two. One devoted friend cannot carry a listing; fifty people
barely pay the tax.

### actorTrust

Per actor, per listing, resolved at recompute:

| Condition | trust |
| --- | --- |
| Banned, or a comment hidden as abuse | 0 |
| Under the minimum account age | 0.25 |
| An upheld abuse report against them in the last 90 days | 0.5 |
| Their network (`ipHash`) already counted on this listing inside the cooldown | 0 |
| Otherwise | 1.0 |

One thing deliberately absent: **whether the actor is on Pro.** An owner's plan buys reach
for their own listing (§4); it must never make their vote or their review weigh more on
somebody else's, because that is pay-to-vote and it is the line between a boost and a rigged
board.

### sizeFactor and ratingFactor

```text
sizeFactor   = 1 + 0.08 · log10(memberCount + 1)      // 1k members: +22h.  100k: +35h
ratingFactor = clamp(0.9, 1.1, 0.9 + 0.05 · (shownRating - 3))
```

Both are intentionally worth about a day at most. Size is a weak prior that a bigger server
is a safer click, not a reason for the board to be a list of the biggest servers - `sort=members`
already exists for people who want that. Rating nudges; it does not rank. A rating that moved
listings hard would turn every review into a weapon and make the first bad one worth
fighting, which is the opposite of what a review section is for.

`shownRating` is the Bayesian value from §1, not the raw mean, so a single angry review
cannot move it - the same function, so display and ranking cannot disagree.

### Penalties

Subtracted in `log2` units, which means they are multiplicative: **−1.0 halves the score**,
and is worth three days of age.

| Event | Penalty | Decay |
| --- | --- | --- |
| Upheld abuse report | 1.0 each, capped at 3.0 | Linear to zero over 90 days |
| Comment hidden as abuse | 0.25 each, capped at 1.0 | Over 30 days |
| Invite found dead on sync | 2.0 | Until it works again |
| Staff `votingOff` equivalent for hot | Score floored at 0 | While set |

Decay matters: a listing that was cleaned up a month ago should recover on its own, without
a staff member having to remember to forgive it.

### The window is a cost decision, not a semantic one

At a 72-hour half-life, an event 30 days old contributes `2^-10` - under a tenth of a
percent. So the recompute window is 30 days because that is where the arithmetic stops
mattering, and it can be shortened for speed without changing any result anybody would
notice. Nothing about correctness depends on it, which is worth knowing before somebody
"optimises" it to 7 days and wonders why veteran listings moved.

### When it recomputes

One function, `refreshHot(kind, listingId, cfg?, tx?)`, called from exactly the places
`refreshRank()` is called from today plus the new ones:

| Trigger | Where |
| --- | --- |
| Bump | `bumpServer`, `bumpBot`, `bumpClient` |
| Vote cast or revoked | `castVote`, the portal's revoke/restore |
| Comment posted, edited, hidden, unhidden | the comment routes and the portal |
| Report upheld or reversed | `src/app/portal/reports` |
| Pro assigned, moved, or lapsed | `src/app/api/billing/slots`, the Stripe webhook, the lapse sweep |
| Listing created, hidden, removed, restored | the listing routes and the portal |
| Member count changed on sync | `api/servers/[serverId]/sync` - debounced, this one is noisy |
| `ranking` setting saved | `refreshAllHot()`, mirroring `refreshAllRanks()` |

Plus one nightly rebuild of everything, as the backstop: any drift, any missed call site, any
bug in an incremental path is gone by morning, and the fact that a full rebuild is affordable
at all is a property worth keeping.

**Batching.** A naive recompute is five queries per listing. `refreshAllHot()` instead pulls
the window's events for a batch of a few hundred listings at a time - one query per signal
per batch - and does the capping and the sum in memory. The `Pro` lookup is already batched
this way by `proSet()`, so the pattern is in the codebase.

### The `ranking` setting

Same shape as `votingSchema` in `src/lib/votes.ts`, including the two switches that made
voting safe to ship:

```ts
export const rankingSchema = z.object({
  /** Off: hotScore is not computed and "Active" is hidden from the sort menu. */
  enabled: z.boolean(),
  /** Off: scores are computed and shown in the portal, but do not sort anything. */
  affectsRanking: z.boolean(),
  halfLifeHours: z.number().int().min(6).max(720),
  windowDays: z.number().int().min(3).max(90),
  diversityK: z.number().min(0).max(20),
  sizeCoefficient: z.number().min(0).max(0.5),
  proBoost: z.number().min(1).max(2),
  /** Per board, per signal: weight and the per-actor cap. */
  weights: z.record(z.string(), z.record(z.string(), z.object({ w: z.number(), cap: z.number().int() }))),
  minAccountAgeHours: z.number().int().min(0).max(720),
  /** Phase 3b. 0 disables it. */
  ringDamping: z.number().min(0).max(1),
});
```

`affectsRanking: false` is how this ships. Compute for a week, look at it, then turn it on -
the same way voting was derisked, and the reason that switch exists at all.

### How to tell whether it worked

The reason for `affectsRanking: false` is that "the order looks better to me" is not evidence,
and this is the one change in the plan that can quietly make the board worse. Four numbers,
all derivable from rows that already exist:

| Measure | From | What a win looks like |
| --- | --- | --- |
| Join-click rate on page 1 | `Server.joins` against impressions | Up. The board is putting better things first. |
| Review and reply rate per listing view | `Comment` against `Server.views` | Up. People find something worth talking about. |
| Impression concentration across listings | the top 10% of listings' share of page-1 slots | **Down.** A ranking that rewards activity should spread attention, not concentrate it. |
| Page-2 depth | pagination hits | Down is fine. Nobody should need page 2. |

The third is the one that matters most and the one most easily forgotten. An engagement
ranking has a natural rich-get-richer failure: the listings on page 1 get the activity that
keeps them on page 1. If concentration climbs after the switch, the half-life is too long
(old activity is holding position) or `sizeFactor` is too strong - and those are the two
dials to reach for, in that order.

Run it as a 10% split for a fortnight rather than a flip: the pool pre-sort and the sort are
both server-side and keyed on nothing but the sort parameter, so a cohort is a cookie and a
branch, not an architecture.

### Phase 3b: ring damping, properly

The one abuse pattern that scales is reciprocity - "review mine and I'll review yours" -
and no amount of per-actor capping touches it, because every actor is distinct and every
review is real.

Measure it as overlap between the counted-actor sets of two listings, nightly, only for pairs
sharing three or more actors:

```text
J(a, b) = |actors(a) ∩ actors(b)| / |actors(a) ∪ actors(b)|
```

A legitimate pair of popular servers in the same scene shares some audience, so overlap alone
is not guilt. What is damning is overlap that is also **mutual and concentrated**: the shared
actors have most of their board-wide activity on just these listings. So:

```text
suspicion(a,b) = J(a,b) · concentration(shared actors)
damping(a)     = ringDamping · max over b of suspicion(a,b)      // subtracted, log2 units
```

Ship it at `ringDamping: 0` with the computed values visible in the portal. Look at what it
flags for a month before letting it subtract anything - the first version of this will flag
innocent people, and finding that out with a report rather than with a ranking drop is the
entire reason to build it in that order.

### Explaining a score

A `/portal/ranking/<kind>/<id>` screen that prints the terms - the activity sum, each
signal's contribution, counted actors and who they were, every factor and penalty, and the
resulting score - plus "where this would sit on page 1".

This is not a nicety. It is the answer to "why did my server drop", which is the support
ticket this whole phase generates, and it is the only practical way to tune the weights:
pick ten listings whose order you already have an opinion about, and read why the board
disagrees with you.

### How hot folds into search

`score()` in `src/lib/search.ts` works in roughly 10-30 raw points. `hotScore` is in log2
units on a completely different scale, so it cannot be added in directly - it would swamp
relevance and turn every search into the hot list.

Add it as a **bounded tiebreaker**:

```ts
total += Math.max(-2, Math.min(6, 0.4 * (hot - boardMedianHot)));
```

Capped at six points, which is worth less than a name-word match (12) and about the same as a
tag hit (7). A search for "minecraft" must return the best minecraft servers, not the busiest
servers that mention it. The existing bump and badge tie-breakers in `score()` get folded into
this - they are measuring the same thing twice, badly - and the `RELEVANCE_POOL` pre-sort
switches from `rankedAt` to `hotScore` so the pool holds the right 400 candidates to begin with.

### What this does not fix

Worth writing down so nobody expects it to:

- **A brand-new good listing still starts at nothing.** The score cannot know. That is what
  `sort=new` is for, plus a "New this week" rail on `/servers` - reserved placement, which is
  honest, rather than a fudge factor in the score, which is not.
- **A large, dead server still ranks above a tiny, lively one** at the extremes, because
  `sizeFactor` is a prior and priors are sometimes wrong.
- **It cannot tell a good server from a popular one.** Nothing can. It measures whether people
  are here and doing things, which is the only thing a board can honestly measure.
- **Paid-for engagement** - somebody buying reviews outright - is a moderation problem, not a
  ranking one, and the ranking should not pretend to solve it.

---

## 4. What Pro buys, and the limits

### The boost

**A 1.25x multiplier on the activity term, and nothing else** - which in the log2 space of §3
is `+0.322` added to `hotScore`. Multiplicative, deliberately:

> A Pro listing with no activity still loses to an active free one.

That single property is what makes the whole thing defensible. 1.25x of a small number is
still a small number; it is a thumb on the scale between close rivals, not a bypass. An
*additive* boost would do the opposite - float dead paid listings above live free ones,
which is exactly how a directory dies.

Converted to age the way §3 converts every other weight, `72 · log2(1.25)`:

> **Pro is worth 23 hours of freshness.** It is the difference between a listing's activity
> happening today and the same activity happening yesterday.

That is the sentence to put in front of anybody who asks whether the board is for sale -
including yourself, in a year, when the temptation is to raise it. It is checkable, it is
small, and it is the same unit everything else in the ranking is measured in. If the boost
ever needs to be bigger than "about a day" to sell plans, the problem is the plan, not the
multiplier.

The number lives in the `ranking` setting (`proBoost`, bounded 1 - 2 by the schema), so it is
tunable without a deploy and visible in the portal next to everything else. It is not
hard-coded in the scorer, and it is not a different number for different owners - there is no
mechanism for a bigger boost, which is the point.

Hard limits on top:

- Applies to `sort=hot` and to relevance search only. Never to bumped, members or new.
- Never applies to a listing's rating, review count, or whether its reviews show.
- At most one promoted card in any three consecutive results on page 1; surplus slides down.
  Cheap insurance against the day Pro sells well.

The spacing rule is a stable demotion pass over the already-sorted page, not a re-sort: walk
the list, and when a promoted card would land within two places of the previous one, swap it
with the next unpromoted card below it. Order among promoted cards is preserved, order among
free cards is preserved, and nothing is removed - it degrades to a no-op when Pro listings are
sparse, which is the case today. It runs after the page slice, on at most 23 rows, so it costs
nothing and needs no query.

One thing to watch once Pro sells: the share of page-1 impressions going to promoted cards.
Put it on the portal next to the ranking numbers. If it drifts above roughly a fifth, the
spacing rule is doing the work the multiplier should be doing, and the multiplier is too high.

### The `PROMOTED` banner

The card treatment in the mock - gold pill, top right, on the banner - ships as part of this,
and it is the honest half of the deal. Paid placement has to be labelled: for a marketplace
that ranks on payment it is a legal requirement in the EU and UK, and the `PROMOTED` label
plus a line in `/pro` and the guidelines is what satisfies it.

Implementation is small: `ServerCard` already receives `server.pro` from `markPro()`, and the
banner work landed with `BannerEditor`. The pill is a conditional span; the disclosure is a
tooltip on it reading *"On a YapBoard Pro plan. Pro listings get a small ranking boost."*

`ProMark` (the purple seal) stays as the quiet "this listing is on Pro" mark on listing pages
and non-ranked contexts. `PROMOTED` is specifically for a card appearing in a ranked list
because it was boosted there. Two marks, two jobs, no ambiguity.

---

## 5. Making discussion happen

A comment box nobody finds is a comment box nobody uses. The plumbing to fix that is already
in the repo - `BotDm` and `Broadcast` both exist and both work.

### On the site

- **Listing page**: reviews above the fold, not in a tab. "Be the first to review" when empty,
  with the rating control inline so posting is one click plus typing.
- **`/activity`** - the board's newest reviews and replies across all three boards. One page
  that changes every time anybody writes anything: a reason to return, and a stream of fresh
  indexable content pointing at listings and profiles.
- **Cards** show a review count next to the member count once there is one. A listing with
  reviews looks alive; that pulls clicks, which pulls reviews.
- **User badges** - a `UserBadge` table mirroring `ServerBadge` exactly, so the existing
  grant/revoke portal screen works with a changed target. Auto-granted from counters,
  staff-grantable on top:

  | Badge | Earned by |
  |---|---|
  | `OG` | Among the first N accounts |
  | `REVIEWER` | 10 reviews that still count |
  | `CRITIC` | 50 |
  | `BUMPER` | 100 bumps |
  | `HELPER` | Staff grant - consistently useful replies |
  | `STAFF` / `ADMIN` | Role |

  Badges are the cheapest incentive there is: they cost nothing, they show up next to every
  comment the person writes, and they are visible on a page with their name on it.

### Through the bot

- **The bump reminder already fires** (`Bot/lib/reminders.js`). Append one line: *"2 new
  reviews since your last bump"* with a link. The person is already being pinged; the extra
  line costs nothing and lands on exactly the person who cares.
- **`/bump`'s reply card** shows the newest review and a Reply link, so every bump becomes an
  invitation back to the site.
- **A DM to the owner on a new review** - `BotDm` already queues, delivers and reports back,
  and already carries bot-listing decisions. One new DM kind. This is the highest-leverage
  item on the list: a notification that reaches a Yapin' user where they already are and
  sends them to a page on yapboard.dev.
- **`/reviews <server>`** posts the top three plus the rating, with a link. Reading in chat,
  writing on the site - which is the right split, because a rating control does not fit in a
  chat message.
- **A weekly broadcast** (`Broadcast` exists and already skips opted-out servers) with the
  week's most-discussed listings.
- **Platform API**: `GET /platform/v1/servers/<id>/reviews` on the existing scoped-key
  machinery, so program members' bots surface YapBoard reviews inside their own servers.
  Distribution for free, and `PlatformOutcome` already measures whether it is used.

---

## Order of work

| Phase | What | Notes |
| --- | --- | --- |
| **0** | `Comment` model, listing aggregate columns, `Report.commentId`, migration | SQLite dev / Postgres prod - keep to types both support, per the schema header |
| **1** | Reviews and replies end to end: API, listing-page UI, badges, report path, portal moderation | The thing that was asked for first. Ships on its own and is worth shipping on its own. |
| **2** | Profiles, `/@username`, user counters, privacy toggle, bio | Needs phase 1 to have something to link from |
| **3** | `src/lib/engagement.ts`, `hotScore`, the sweep, the `ranking` Setting and its portal screen, "Active" as the default sort | Ships behind the setting at weight 0, so it can be watched before it bites |
| **3b** | Ring damping | Only once there is data to tune against |
| **4** | Pro 1.25x, `PROMOTED` pill, the page-1 cap, disclosure copy in `/pro` and the guidelines | Deliberately after phase 3: boost a score that has been watched working, not a fresh one |
| **5** | `UserBadge`, `/activity`, bot DM on new review, reminder line, `/reviews`, weekly broadcast, platform endpoint | The traffic phase. Each item is independent and shippable alone. |

Phases 1, 2 and 5 are what bring people back. Phase 3 is what makes the board honest, and
phase 4 only works because phase 3 came first.

## Things to decide before phase 0

1. **Ratings at all, or comments only?** A rating makes the board a review site and gives
   readers a reason to trust it; it also gives owners something to be angry about. The plan
   assumes ratings, with the prior and the never-hide rule as the mitigations.
2. **Bots and clients too, from day one?** The table supports all three for the cost of two
   nullable columns, and bot listings especially benefit. Recommend yes.
3. **Default sort switching to "Active"** changes what every existing owner sees. Worth an
   announcement (the `Announcement` model exists) rather than a silent change.
