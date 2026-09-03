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
    return {
      moderationStatus,
      messageKey: live
        ? LISTINGS_I18N_KEYS.moderationLiveNeedsReview
        : LISTINGS_I18N_KEYS.moderationNeedsReview,
      tone: "waiting",
      liveDuringReview: live,
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
 * The dashboard tabs, and the statuses each one folds together.
 *
 * The grouping is the SERVER's (`views.my_counters`), copied here so a tab's
 * caption and its count cannot describe different sets: `active` includes
 * PENDING beside PUBLISHED, and `drafts` includes REJECTED beside DRAFT —
 * both because a listing in those states is something the owner is still
 * working on. A client that grouped them its own way would show "3 active"
 * over two rows.
 */
export const MY_LISTINGS_TABS = ["active", "drafts", "archived"] as const;

export type MyListingsTab = (typeof MY_LISTINGS_TABS)[number];

export const MY_LISTINGS_TAB_STATUSES: Readonly<
  Record<MyListingsTab, readonly ListingLifecycleStatus[]>
> = {
  active: ["published", "pending"],
  drafts: ["draft", "rejected"],
  archived: ["archived", "paused", "expired", "sold"],
};

/** Which tab a listing belongs to, or `undefined` for BLOCKED — the one
 * status `my/counters` counts in no tab at all. A dashboard that silently
 * dropped it would hide exactly the listing whose owner most needs to know. */
export function tabOf(
  status: ListingLifecycleStatus
): MyListingsTab | undefined {
  for (const tab of MY_LISTINGS_TABS) {
    if (MY_LISTINGS_TAB_STATUSES[tab].includes(status)) return tab;
  }
  return undefined;
}

/**
 * The statuses no tab folds in — `blocked`, and nothing else today.
 *
 * DERIVED, not written down a second time: a status added upstream and left
 * out of the counter groupings lands here automatically and gets shown, which
 * is the opposite of what a hardcoded `["blocked"]` would do the day it goes
 * stale. The dashboard renders these rows OUTSIDE the tabs (see
 * `default/MyListingsPane.tsx`) rather than folding them into one, because a
 * tab's rows and its `my/counters` badge have to describe the same set — and
 * `my/counters` counts a takedown in no tab at all.
 */
export const MY_LISTINGS_UNTABBED_STATUSES: readonly ListingLifecycleStatus[] =
  LISTING_STATUSES.filter((status) => tabOf(status) === undefined);
