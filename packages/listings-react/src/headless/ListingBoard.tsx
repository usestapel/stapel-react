import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  loadFailed,
  loadLoading,
  loadReady,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { ListingBoardParams, ListingCard } from "../api/types.js";
import { useListingCards } from "../model/queries.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

/** What {@link useListingBoard} hands a grid: one keyset page of the board. */
export interface ListingBoardBag {
  readonly rows: LoadState<readonly ListingCard[]>;
  /** Which page is on screen, 1-based (keyset paging is counted, not read). */
  readonly pageNumber: number;
  readonly nextPage: ActionAvailability;
  readonly prevPage: ActionAvailability;
  goNext(): void;
  goPrev(): void;
  refetch(): void;
}

export interface UseListingBoardOptions {
  /**
   * Narrow the board to these categories: a category page passes its own id
   * and its descendants'. Empty or absent is every category.
   */
  readonly categoryIds?: readonly string[];
  readonly limit?: number;
}

/**
 * The public board (`GET /listings/`), paged, optionally per category — the
 * grid a category page shows when the deployment has no search module.
 * Anonymous-safe: the board is `IsAuthenticatedOrReadOnly`.
 *
 * A change of categories starts again at page one: a cursor from another
 * category's board would page through rows that are not on this one.
 */
export function useListingBoard(options: UseListingBoardOptions = {}): ListingBoardBag {
  const categoryKey = (options.categoryIds ?? []).join(",");
  const [cursor, setCursor] = useState<{
    readonly categories: string;
    readonly page: ListingBoardParams;
    readonly number: number;
  }>({ categories: categoryKey, page: {}, number: 1 });
  const current =
    cursor.categories === categoryKey ? cursor : { categories: categoryKey, page: {}, number: 1 };
  const params: ListingBoardParams = {
    ...current.page,
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
    ...(options.categoryIds !== undefined && options.categoryIds.length > 0
      ? { categoryIds: options.categoryIds }
      : {}),
  };
  const query = useListingCards(params);
  const envelope = query.data;

  return {
    rows:
      query.status === "error"
        ? loadFailed(query.error)
        : envelope !== undefined
          ? loadReady(envelope.items)
          : loadLoading(),
    pageNumber: current.number,
    nextPage:
      envelope?.has_next === true && envelope.next_anchor != null
        ? actionAvailable()
        : actionBlocked(LISTINGS_I18N_KEYS.pageNext),
    prevPage:
      envelope?.has_prev === true && envelope.prev_anchor != null
        ? actionAvailable()
        : actionBlocked(LISTINGS_I18N_KEYS.pagePrev),
    goNext: () => {
      const anchor = envelope?.next_anchor;
      if (anchor == null) return;
      setCursor({
        categories: categoryKey,
        page: { anchor, direction: "next" },
        number: current.number + 1,
      });
    },
    goPrev: () => {
      const anchor = envelope?.prev_anchor;
      if (anchor == null) return;
      setCursor({
        categories: categoryKey,
        page: { anchor, direction: "prev" },
        number: Math.max(1, current.number - 1),
      });
    },
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Render-prop form of {@link useListingBoard}. */
export function ListingBoard(
  props: UseListingBoardOptions & { children: (bag: ListingBoardBag) => ReactNode }
): ReactElement {
  const bag = useListingBoard(props);
  return <>{props.children(bag)}</>;
}
