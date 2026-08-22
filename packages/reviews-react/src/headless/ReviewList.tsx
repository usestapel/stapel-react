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
import { reviewsFromPages } from "../model/list.js";
import { useReviewList } from "../model/queries.js";
import type { UseReviewListOptions } from "../model/queries.js";
import { isSignInRequired } from "../model/refusals.js";

/** What `<ReviewList>` hands its render prop. */
export interface ReviewListBag {
  readonly target: ReviewTarget;
  /**
   * The rows, newest first — `loading` / `ready` / `failed`, never a
   * defaulted empty array. An empty READY list is the only honest way to say
   * "this target has no reviews".
   */
  readonly state: LoadState<readonly Review[]>;
  /**
   * The load failed because the caller is not signed in. Split out of
   * `state.failed` because it is the ONE failure whose copy must not be an
   * error banner: every stapel-reviews endpoint is `IsAuthenticated`, so this
   * is what a visitor to a public listing page sees, and "sign in to read the
   * reviews" is the true sentence. Rendering the empty state here would tell
   * that visitor the seller has never been reviewed.
   */
  readonly signInRequired: boolean;
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
}

export interface ReviewListProps extends UseReviewListOptions {
  readonly target: ReviewTarget;
  readonly children: (bag: ReviewListBag) => ReactNode;
}

/**
 * The headless review list: anchor-paginated, newest first, over one opaque
 * `(target_type, target_key)`.
 *
 * No markup, no strings — a render prop and a bag (frontend-standard §2). The
 * antd rendering of the same bag is `@stapel/reviews-react/default`'s
 * `<ReviewListPanel>`.
 */
export function ReviewList(props: ReviewListProps): ReactElement {
  const { target, children, ...options } = props;
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

  return (
    <>
      {children({
        target,
        state,
        signInRequired:
          query.status === "error" && isSignInRequired(query.error),
        loadMore,
        more,
        loadingMore: query.isFetchingNextPage,
        refresh,
        include: options.include,
      })}
    </>
  );
}
