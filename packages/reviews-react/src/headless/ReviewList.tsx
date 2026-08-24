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
import type { Review, ReviewTarget } from "../api/types.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { isModeratedOut, reviewsFromPages } from "../model/list.js";
import { useReviewList } from "../model/queries.js";
import type { UseReviewListOptions } from "../model/queries.js";

/** What `<ReviewList>` hands its render prop. */
export interface ReviewListBag {
  readonly target: ReviewTarget;
  /**
   * The rows, newest first — `loading` / `ready` / `failed`, never a
   * defaulted empty array. An empty READY list is the only honest way to say
   * "this target has no reviews".
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

export interface ReviewListProps extends UseReviewListOptions {
  readonly target: ReviewTarget;
  /**
   * Does the HOST believe this viewer moderates this target? Read ONLY to
   * decide whether the narrowing sentence is worth showing: a declared
   * moderator whose target happens to have no hidden rows is not being
   * narrowed, they are seeing everything there is.
   */
  readonly canModerate?: boolean;
  readonly children: (bag: ReviewListBag) => ReactNode;
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
  const query = useReviewList(target, options);
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

  const requested = options.include === "all" ? "all" : "published";
  // A non-published row on screen is PROOF the server granted `include=all`;
  // its absence proves nothing either way (see ReviewListScope).
  const proven = rows !== undefined && rows.some(isModeratedOut);
  const granted: ReviewListScope["granted"] =
    requested === "published" ? "published" : proven ? "all" : "unknown";
  const scope: ReviewListScope = {
    requested,
    granted,
    narrowed:
      requested === "all" &&
      granted !== "all" &&
      !canModerate &&
      state.status === "ready",
  };

  return (
    <>
      {children({
        target,
        state,
        loadMore,
        more,
        loadingMore: query.isFetchingNextPage,
        refresh,
        include: options.include,
        scope,
      })}
    </>
  );
}
