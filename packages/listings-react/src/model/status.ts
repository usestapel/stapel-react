/**
 * TWO AXES, BOTH ON SCREEN, NEITHER STANDING IN FOR THE OTHER.
 *
 * `status` (nine states) is the lifecycle and the ONLY thing that decides
 * whether a listing is public: `Listing.objects.published()` filters on it
 * alone, `INDEXED_STATUSES` is `{published}`, and the model says so out loud
 * ("no visibility-reads-moderation_status coupling", `models.py`).
 * `moderation_status` (four states) is the content verdict and decides
 * NOTHING about visibility.
 *
 * Since stapel-listings 0.5.0 the two genuinely diverge, and that divergence
 * is the reason this file exists:
 *
 *   first publication      status draft   → PENDING,   moderation → pending
 *                          (nothing public until a verdict arrives)
 *   editing a LIVE listing status published (UNCHANGED), moderation → pending
 *                          (the edit is visible immediately; a rejecting
 *                           verdict later lands as PUBLISHED → BLOCKED)
 *
 * A dashboard that computed "under re-review" from `status` would show
 * nothing at all for the second row — the listing looks exactly as it did —
 * and the owner would never learn their edit is being screened. A dashboard
 * that computed "visible" from `moderation_status` would tell them their live
 * listing is offline while strangers are reading it. Both mistakes are one
 * `if` away, which is why the sentence a person reads is produced HERE, from
 * BOTH fields, once.
 *
 * Everything below is pure: no React, no antd, no fetch. `test/status.test.ts`
 * asserts the whole 9 × 4 table, so a state added upstream is a red test and
 * not a bare enum value on a page.
 */
import { LISTING_STATUSES } from "../api/types.js";
import type {
  ListingLifecycleStatus,
  ListingModerationStatus,
} from "../api/types.js";
import { LISTING_TRANSITIONS } from "./transitions.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

/**
 * How a status should READ, independent of the words: neutral (nothing is
 * happening), waiting (something is in progress and needs no action), good
 * (live), warning (the owner has something to do), stopped (the listing is
 * over, by choice or by verdict).
 *
 * A tone rather than a colour: `/default` maps it to antd tags, another skin
 * maps it to whatever it maps it to, and the token layer stays the only place
 * a hex exists.
 */
export type ListingStatusTone =
  | "neutral"
  | "waiting"
  | "good"
  | "warning"
  | "stopped";

/** The lifecycle half of what a person is told. */
export interface LifecycleCaption {
  readonly status: ListingLifecycleStatus;
  readonly labelKey: string;
  readonly tone: ListingStatusTone;
  /** Is the listing readable by a stranger right now? `published` and
   * nothing else — the same predicate the queryset uses. */
  readonly publiclyVisible: boolean;
}

const LIFECYCLE: Readonly<
  Record<ListingLifecycleStatus, Omit<LifecycleCaption, "status">>
> = {
  draft: {
    labelKey: LISTINGS_I18N_KEYS.statusDraft,
    tone: "neutral",
    publiclyVisible: false,
  },
  pending: {
    labelKey: LISTINGS_I18N_KEYS.statusPending,
    tone: "waiting",
    publiclyVisible: false,
  },
  published: {
    labelKey: LISTINGS_I18N_KEYS.statusPublished,
    tone: "good",
    publiclyVisible: true,
  },
  paused: {
    labelKey: LISTINGS_I18N_KEYS.statusPaused,
    tone: "neutral",
    publiclyVisible: false,
  },
  expired: {
    labelKey: LISTINGS_I18N_KEYS.statusExpired,
    tone: "warning",
    publiclyVisible: false,
  },
  sold: {
    labelKey: LISTINGS_I18N_KEYS.statusSold,
    tone: "stopped",
    publiclyVisible: false,
  },
  rejected: {
    labelKey: LISTINGS_I18N_KEYS.statusRejected,
    tone: "warning",
    publiclyVisible: false,
  },
  blocked: {
    labelKey: LISTINGS_I18N_KEYS.statusBlocked,
    tone: "stopped",
    publiclyVisible: false,
  },
  archived: {
    labelKey: LISTINGS_I18N_KEYS.statusArchived,
    tone: "neutral",
    publiclyVisible: false,
  },
};

/** The lifecycle caption for one status. */
export function lifecycleCaption(
  status: ListingLifecycleStatus
): LifecycleCaption {
  return { status, ...LIFECYCLE[status] };
}

/**
 * Is this listing readable by someone who is not its owner?
 *
 * One predicate, one field, matching the server's. Exported because the
 * DETAIL read needs it and cannot get it from a 404: `GET /listings/{pk}/`
 * has no `published()` filter on its queryset, so a draft answers 200 to a
 * stranger who knows the id (upstream note in MODULE.md). The pair reports
 * the fact instead of rendering a draft as if it were a shop window.
 */
export function isPubliclyVisible(status: ListingLifecycleStatus): boolean {
  return LIFECYCLE[status].publiclyVisible;
}

/** The owner-facing note about the moderation axis, when there is one. */
export interface ModerationNotice {
  readonly moderationStatus: ListingModerationStatus;
  readonly messageKey: string;
  readonly tone: ListingStatusTone;
  /**
   * Is the listing live WHILE this verdict is pending? True only for the
   * re-moderation row — a published listing whose edit is being screened.
   * The sentence differs from a first submission's precisely here.
   */
  readonly liveDuringReview: boolean;
}

/**
 * What to say about the moderation axis, given BOTH fields.
 *
 * `undefined` means "nothing to add": an approved listing needs no note, and
 * neither does a draft nobody has submitted. Every other combination has a
 * sentence, including the ones that look contradictory — those are the ones
 * worth naming.
 */
export function moderationNotice(
  status: ListingLifecycleStatus,
  moderationStatus: ListingModerationStatus
): ModerationNotice | undefined {
  const live = status === "published";

  if (moderationStatus === "approved") {
    // A takedown keeps `approved` on the moderation axis in some flows (the
    // lifecycle moved, the verdict did not), so an approved BLOCKED listing
    // still owes its owner an explanation — and it is the lifecycle's.
    return undefined;
  }

  // NOTHING HAS BEEN SUBMITTED, so there is nothing for moderation to say.
  // The lifecycle already calls this row a draft, and a second line beside
  // that word can only add a claim the data does not support.
  if (moderationStatus === "not_submitted") return undefined;

  if (moderationStatus === "pending") {
    if (live) {
      return {
        moderationStatus,
        messageKey: LISTINGS_I18N_KEYS.moderationLiveEditPending,
        tone: "waiting",
        liveDuringReview: true,
      };
    }
    if (status === "pending") {
      return {
        moderationStatus,
        messageKey: LISTINGS_I18N_KEYS.moderationFirstReview,
        tone: "waiting",
        liveDuringReview: false,
      };
    }
    // A draft/archived/sold row carrying a pending verdict: the submission
    // was overtaken by a lifecycle move. Say that, rather than promising a
    // review that will not put it back on the shelf.
    return {
      moderationStatus,
      messageKey: LISTINGS_I18N_KEYS.moderationPendingOffline,
      tone: "neutral",
      liveDuringReview: false,
    };
  }

  if (moderationStatus === "needs_review") {
    // Same three-way split as `pending`, and for the same reason (D225): a
    // manual-review verdict is exactly as capable of being OVERTAKEN by a
    // lifecycle move as an automated one is, and this branch used to ignore
    // that — a sold/paused/archived/draft row carrying a stale
    // `needs_review` printed "a moderator is looking at this by hand" to an
    // owner whose listing had not been on offer for however long the review
    // has been sitting open.
    if (live) {
      return {
        moderationStatus,
        messageKey: LISTINGS_I18N_KEYS.moderationLiveNeedsReview,
        tone: "waiting",
        liveDuringReview: true,
      };
    }
    if (status === "pending") {
      return {
        moderationStatus,
        messageKey: LISTINGS_I18N_KEYS.moderationNeedsReview,
        tone: "waiting",
        liveDuringReview: false,
      };
    }
    return {
      moderationStatus,
      messageKey: LISTINGS_I18N_KEYS.moderationPendingOffline,
      tone: "neutral",
      liveDuringReview: false,
    };
  }

  if (moderationStatus === "rejected") {
    // …and it matters whether the lifecycle followed the verdict.
    return {
      moderationStatus,
      messageKey: live
        ? LISTINGS_I18N_KEYS.moderationRejectedStillLive
        : LISTINGS_I18N_KEYS.moderationRejected,
      tone: "warning",
      liveDuringReview: live,
    };
  }

  // AN UNKNOWN VALUE SAYS NOTHING. This used to be the `rejected` branch's
  // fallthrough, which made "not one of the three I know" mean "a moderator
  // turned this down" — and then stapel-listings 0.20.0 added a fourth value
  // and made it the DEFAULT, so every freshly created draft in the cabinet
  // was announced as "A moderator turned this listing down. Fix it and send
  // it again." to a person who had submitted nothing (D166). A row read from a
  // server newer than this pair must degrade to silence, never to a verdict:
  // the lifecycle caption beside it is still true, and an accusation is the
  // one thing a client must not invent.
  return undefined;
}

/** Both halves at once — what a dashboard row and a detail header render. */
export interface ListingStatusView {
  readonly lifecycle: LifecycleCaption;
  readonly moderation: ModerationNotice | undefined;
  /** True when the two axes disagree in the way 0.5.0 made possible: live to
   * the public, under review for its owner. The one combination a host is
   * most likely to get wrong, so it is a named boolean and not an inference
   * a caller repeats. */
  readonly liveUnderReview: boolean;
  /** What the owner can do next, in lifecycle terms — see
   * {@link LISTING_TRANSITIONS}. */
  readonly allowedTransitions: readonly ListingLifecycleStatus[];
}

export function listingStatusView(
  status: ListingLifecycleStatus,
  moderationStatus: ListingModerationStatus
): ListingStatusView {
  const moderation = moderationNotice(status, moderationStatus);
  return {
    lifecycle: lifecycleCaption(status),
    moderation,
    liveUnderReview: moderation?.liveDuringReview === true,
    allowedTransitions: LISTING_TRANSITIONS[status],
  };
}

/**
 * The three tabs whose ROWS come off a keyset page, and the statuses each one
 * folds together.
 *
 * The grouping is the SERVER's (`views.my_counters`), copied here so a tab's
 * caption and its count cannot describe different sets: `active` includes
 * PENDING beside PUBLISHED, and `drafts` includes REJECTED beside DRAFT —
 * both because a listing in those states is something the owner is still
 * working on. A client that grouped them its own way would show "3 active"
 * over two rows.
 *
 * The name is about the SOURCE, not about the counter: `MyCountersResponse`
 * carries four integers since stapel-listings 0.22.4 (`blocked` joined the
 * three), and this is still the set a {@link MyListingsCountedTab} —
 * `MyListingsSource`'s whole parameter type — may name. The removed tab reads
 * its rows off `?status=blocked` directly and unpaged, so a host that
 * implemented the seam before the fourth tab existed is never handed it.
 */
export const MY_LISTINGS_COUNTED_TABS = ["active", "drafts", "archived"] as const;

/** One of the three tabs a `MyListingsSource` is asked for. */
export type MyListingsCountedTab = (typeof MY_LISTINGS_COUNTED_TABS)[number];

const COUNTED_TAB_STATUSES: Readonly<
  Record<MyListingsCountedTab, readonly ListingLifecycleStatus[]>
> = {
  active: ["published", "pending"],
  drafts: ["draft", "rejected"],
  archived: ["archived", "paused", "expired", "sold"],
};

/** Which of the three keyset-paged tabs a status belongs to, or `undefined`
 * for one none of them folds in — `blocked`, today, which has a tab and a
 * counter of its own and a different row source under it. */
export function countedTabOf(
  status: ListingLifecycleStatus
): MyListingsCountedTab | undefined {
  for (const tab of MY_LISTINGS_COUNTED_TABS) {
    if (COUNTED_TAB_STATUSES[tab].includes(status)) return tab;
  }
  return undefined;
}

/**
 * The statuses none of the three paged tabs folds in — `blocked`, and nothing
 * else today.
 *
 * DERIVED, not written down a second time: a status added upstream and left
 * out of the tab groupings lands here automatically and gets shown, which is
 * the opposite of what a hardcoded `["blocked"]` would do the day it goes
 * stale. That the server now has a `blocked` COUNTER for the same set does not
 * make the derivation redundant: the counter names one status and this names
 * whatever the three groupings leave over, which is the set the fourth tab
 * must ASK for.
 */
export const MY_LISTINGS_UNTABBED_STATUSES: readonly ListingLifecycleStatus[] =
  LISTING_STATUSES.filter((status) => countedTabOf(status) === undefined);

/**
 * The fourth tab: the rows `my/counters` counts in NO tab at all.
 *
 * ── What was on screen (D407) ────────────────────────────────────────────
 *
 * A listing pulled by moderation showed "Taken down by a moderator" over a
 * counter row reading "Active 0 · Drafts 0 · Archived 0", beside the active
 * tab's own "nothing of yours is live". The object was on the page and in no
 * tab and in no number — three statements, and the two loudest of them said
 * the seller had nothing.
 *
 * The takedowns had a home before this (a block above the tabs) and that was
 * the half that was wrong: a row outside the tab strip is a row the counters
 * do not describe, and a person reads the counters. So they get a TAB, with a
 * count, like every other state a listing can be in.
 *
 * ── Why a fourth tab and not the archive ─────────────────────────────────
 *
 * Folding `blocked` into `archived` is the other shape this could take, and
 * it cost the count: when D407 was written `my/counters` had three integers
 * and no fourth, so an archive tab holding takedowns would have read the
 * server's `archived` number — `0` — until the tab was opened and its rows
 * could raise it. The fourth tab was counted from its OWN read
 * (`?status=blocked`, unpaged) so that the number was right while the seller
 * was looking at a different tab, which is exactly the moment D407 was
 * measured at. stapel-listings 0.22.4 puts `blocked` in the counter, so the
 * number is the server's now and that read is only the tab's rows — but the
 * property it was there to defend is the same one, and it is now defended by
 * the wire instead of by a page.
 *
 * The archive keeps its meaning too, which is not nothing: "I put this away"
 * and "a moderator took this down" are not the same sentence and a tab that
 * said one over rows that meant the other would be the D407 defect wearing a
 * label.
 */
export const MY_LISTINGS_REMOVED_TAB = "removed";

/**
 * Every tab the dashboard can show: the server's three, then the removed one.
 *
 * The removed tab is DRAWN only where there is something in it (see
 * `headless/MyListings.tsx`) — an empty "Taken down" tab is a scare — but it
 * is in this list unconditionally, because `?tab=removed` must parse and a
 * host must be able to name it.
 */
export const MY_LISTINGS_TABS: readonly [
  ...typeof MY_LISTINGS_COUNTED_TABS,
  typeof MY_LISTINGS_REMOVED_TAB,
] = [...MY_LISTINGS_COUNTED_TABS, MY_LISTINGS_REMOVED_TAB];

export type MyListingsTab = (typeof MY_LISTINGS_TABS)[number];

export const MY_LISTINGS_TAB_STATUSES: Readonly<
  Record<MyListingsTab, readonly ListingLifecycleStatus[]>
> = {
  ...COUNTED_TAB_STATUSES,
  [MY_LISTINGS_REMOVED_TAB]: MY_LISTINGS_UNTABBED_STATUSES,
};

/** Which tab a listing belongs to. Every status has one: the three counted
 * groupings, and the removed tab for whatever they leave out. `undefined` is
 * unreachable today and stays in the signature so a status this build has
 * never heard of cannot be filed under a tab by accident. */
export function tabOf(
  status: ListingLifecycleStatus
): MyListingsTab | undefined {
  for (const tab of MY_LISTINGS_TABS) {
    if (MY_LISTINGS_TAB_STATUSES[tab].includes(status)) return tab;
  }
  return undefined;
}
