import { useCallback } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  loadFailed,
  loadLoading,
  loadReady,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { Review, ReviewOwner, ReviewTarget } from "../api/types.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { isModeratedOut, reviewsFromPages } from "../model/list.js";
import { useOwnerReviews, useReviewList } from "../model/queries.js";
import type {
  ReviewListQueryResult,
  UseReviewListOptions,
} from "../model/queries.js";

/**
 * Everything a review window hands its render prop that does not depend on
 * HOW the window was addressed — which is everything except the address.
 *
 * `<ReviewList>` adds `target`, `<ReviewOwnerList>` adds `owner`, and a skin
 * that renders rows reads only this, which is why both components share one
 * row renderer instead of growing two that drift.
 */
export interface ReviewWindowBag {
  /**
   * The rows, newest first — `loading` / `ready` / `failed`, never a
   * defaulted empty array. An empty READY list is the only honest way to say
   * "nothing here has been reviewed".
   */
  readonly state: LoadState<readonly Review[]>;
  /** Ask for the next (older) page. */
  readonly loadMore: () => void;
  /** Whether there is another page, and if not, why the control is off. */
  readonly more: ActionAvailability;
  /** A next page is in flight (the rows already on screen stay on screen). */
  readonly loadingMore: boolean;
  /** Re-read the first page. */
  readonly refresh: () => void;
  /**
   * The scope actually requested. `"all"` means pending/hidden rows were
   * ASKED for — the server grants them only to a moderator/owner and narrows
   * everyone else silently, so this is never a promise that they are here.
   */
  readonly include: "all" | undefined;
  /** What was asked for, and what arrived. See {@link ReviewListScope}. */
  readonly scope: ReviewListScope;
}

/** What `<ReviewList>` hands its render prop: the window, plus the target. */
export interface ReviewListBag extends ReviewWindowBag {
  readonly target: ReviewTarget;
}

/** What `<ReviewOwnerList>` hands its render prop: the window, plus the owner. */
export interface ReviewOwnerListBag extends ReviewWindowBag {
  readonly owner: ReviewOwner;
}

/**
 * The one place `include=all`'s silent narrowing is made visible.
 *
 * `ReviewListCreateView` acts on the literal `"all"` and, for a caller its
 * `can_moderate` callback rejects, quietly serves published rows instead — no
 * error, no flag in the body, no way to tell the answer apart from a target
 * that genuinely has nothing hidden. Offered to every host as a bare prop,
 * that is a control that promises something it usually cannot deliver.
 *
 * So the bag reports the two facts separately and never guesses between them:
 *
 * - `requested` — what this component asked the server for.
 * - `granted` — what can be VOUCHED for. `"all"` only when a non-published row
 *   is actually on screen, which is proof the grant happened; `"unknown"` when
 *   `all` was asked for and no such row arrived, because a granted request
 *   against a fully-published target looks exactly like a narrowed one.
 * - `narrowed` — the display decision: say the sentence. True when `all` was
 *   asked for, the load is READY, nothing proves the grant, and the host has
 *   not declared the viewer a moderator.
 */
export interface ReviewListScope {
  readonly requested: "all" | "published";
  readonly granted: "all" | "published" | "unknown";
  readonly narrowed: boolean;
}

/** The props both list components share — everything but the address. */
interface ReviewWindowProps {
  /**
   * Does the HOST believe this viewer sees more than the public does? Read
   * ONLY to decide whether the narrowing sentence is worth showing: a
   * declared moderator whose list happens to have no hidden rows is not being
   * narrowed, they are seeing everything there is.
   *
   * The server's answer to that question differs by addressing — the target
   * type's `can_moderate` callback for one target, core's staff predicate for
   * a whole owner — but the client's half is the same either way, so it is
   * one prop and not two.
   */
  readonly canModerate?: boolean;
}

export interface ReviewListProps extends UseReviewListOptions, ReviewWindowProps {
  readonly target: ReviewTarget;
  readonly children: (bag: ReviewListBag) => ReactNode;
}

export interface ReviewOwnerListProps
  extends UseReviewListOptions,
    ReviewWindowProps {
  /** The address. `targetType` lives INSIDE it — narrowing is part of the
   * address's shape, not a separate prop, so the two cannot be given
   * different values. */
  readonly owner: ReviewOwner;
  readonly children: (bag: ReviewOwnerListBag) => ReactNode;
}

/**
 * The window bag, built from a query result — one implementation for both
 * addressings, so the cursor, the blocked reasons and the scope split cannot
 * differ between a target's reviews and an owner's.
 */
function useReviewWindowBag(
  query: ReviewListQueryResult,
  include: "all" | undefined,
  canModerate: boolean
): ReviewWindowBag {
  const { fetchNextPage, refetch } = query;

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const rows = reviewsFromPages(query.data);
  const state: LoadState<readonly Review[]> =
    query.status === "error"
      ? loadFailed(query.error)
      : rows === undefined
        ? loadLoading()
        : loadReady(rows);

  const more: ActionAvailability = query.hasNextPage
    ? query.isFetchingNextPage
      ? actionBlocked(REVIEWS_I18N_KEYS.moreBlockedPending)
      : actionAvailable()
    : actionBlocked(REVIEWS_I18N_KEYS.moreBlockedEnd);

  const requested = include === "all" ? "all" : "published";
  // A non-published row on screen is PROOF the server granted `include=all`;
  // its absence proves nothing either way (see ReviewListScope).
  const proven = rows !== undefined && rows.some(isModeratedOut);
  const granted: ReviewListScope["granted"] =
    requested === "published" ? "published" : proven ? "all" : "unknown";

  return {
    state,
    loadMore,
    more,
    loadingMore: query.isFetchingNextPage,
    refresh,
    include,
    scope: {
      requested,
      granted,
      narrowed:
        requested === "all" &&
        granted !== "all" &&
        !canModerate &&
        state.status === "ready",
    },
  };
}

/**
 * The headless review list: anchor-paginated, newest first, over one opaque
 * `(target_type, target_key)`, readable by anyone.
 *
 * There is no `signInRequired` here: since stapel-reviews 0.3.0 the list is
 * `IsAuthenticatedOrReadOnly`, so a guest gets the published rows. An empty
 * READY list therefore means what it says — nobody has reviewed this target —
 * and it is a state a signed-out visitor can legitimately reach.
 *
 * No markup, no strings — a render prop and a bag (frontend-standard §2). The
 * antd rendering of the same bag is `@stapel/reviews-react/default`'s
 * `<ReviewListPanel>`.
 */
export function ReviewList(props: ReviewListProps): ReactElement {
  const { target, children, canModerate = false, ...options } = props;
  const bag = useReviewWindowBag(
    useReviewList(target, options),
    options.include,
    canModerate
  );
  return <>{children({ target, ...bag })}</>;
}

/**
 * The same list, addressed by OWNER (stapel-reviews 0.7.0): every review of
 * everything one owner owns, over the same window and the same rows.
 *
 * Two things a host should not read into this component, because the module
 * does not claim either:
 *
 * - **It is not a seller.** `ownerKey` is an opaque host string, stamped on
 *   each review by the target type's `owner_key_for` resolver. A deployment
 *   that registers none gets an empty list here, which is the same thing on
 *   the wire as an owner nobody has reviewed.
 * - **The rows are not all about one thing.** Each row carries its OWN
 *   `target_type`/`target_key`, so a skin that wants to name what was
 *   reviewed reads the row rather than the address — which is exactly why
 *   `<ReviewListPanel>` can render both addressings with one row renderer.
 */
export function ReviewOwnerList(props: ReviewOwnerListProps): ReactElement {
  const { owner, children, canModerate = false, ...options } = props;
  const bag = useReviewWindowBag(
    useOwnerReviews(owner.ownerKey, {
      ...options,
      ...(owner.targetType !== undefined
        ? { targetType: owner.targetType }
        : {}),
    }),
    options.include,
    canModerate
  );
  return <>{children({ owner, ...bag })}</>;
}
