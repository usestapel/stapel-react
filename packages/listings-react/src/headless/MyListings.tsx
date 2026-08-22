import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  actionAvailable,
  actionBlocked,
  loadFailed,
  loadLoading,
  loadReady,
  useActiveSessionReady,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type {
  ListingCard,
  ListingPageParams,
  MyCounters,
} from "../api/types.js";
import { MY_LISTINGS_SOURCE_MISSING } from "../model/mineSource.js";
import type { MyListingsSource } from "../model/mineSource.js";
import { useMyCounters } from "../model/queries.js";
import { listingsQueryKeys, pageKey } from "../model/queryKeys.js";
import { MY_LISTINGS_TABS } from "../model/status.js";
import type { MyListingsTab } from "../model/status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { useMandateGate } from "./useMandateGate.js";

/**
 * The owner's dashboard — and the one screen in this pair whose rows the
 * backend cannot supply.
 *
 * The counters are REAL and are shown. The rows come from an injected
 * `MyListingsSource`, and when there is none `rows` lands in the `failed` arm
 * carrying a NAMED reason rather than as an empty list. `model/mineSource.ts`
 * holds the whole argument and the upstream asks; this file is the bag over
 * it.
 */

export interface MyListingsBag {
  readonly tab: MyListingsTab;
  readonly tabs: readonly MyListingsTab[];
  setTab(tab: MyListingsTab): void;
  /** The three real counts. */
  readonly counters: LoadState<MyCounters>;
  /** The rows for the current tab. `failed` with a named reason when no
   * source is wired — never an empty list. */
  readonly rows: LoadState<readonly ListingCard[]>;
  readonly page: ListingPageParams;
  readonly nextPage: ActionAvailability;
  readonly prevPage: ActionAvailability;
  goNext(): void;
  goPrev(): void;
  /** Whether the person may see this screen at all. */
  readonly gate: ActionAvailability;
  refetch(): void;
}

export interface UseMyListingsOptions {
  readonly source?: MyListingsSource;
  readonly initialTab?: MyListingsTab;
  readonly limit?: number;
}

export function useMyListings(
  options: UseMyListingsOptions = {}
): MyListingsBag {
  const gate = useMandateGate();
  const sessionReady = useActiveSessionReady();
  const [tab, setTabState] = useState<MyListingsTab>(
    options.initialTab ?? "active"
  );
  const [page, setPage] = useState<ListingPageParams>(
    options.limit !== undefined ? { limit: options.limit } : {}
  );

  const counters = useMyCounters();
  const { source } = options;

  const rowsQuery = useQuery({
    queryKey: listingsQueryKeys.mine(tab, pageKey(page)),
    queryFn: ({ signal }) =>
      (source as MyListingsSource)({ tab, page, signal }),
    enabled: source !== undefined && sessionReady && gate.available,
    retry: false,
  });

  const rows: LoadState<readonly ListingCard[]> = useMemo(() => {
    if (source === undefined) return loadFailed(MY_LISTINGS_SOURCE_MISSING);
    if (rowsQuery.status === "error") return loadFailed(rowsQuery.error);
    if (rowsQuery.data !== undefined) return loadReady(rowsQuery.data.items);
    return loadLoading();
  }, [source, rowsQuery.status, rowsQuery.error, rowsQuery.data]);

  const envelope = rowsQuery.data;

  return {
    tab,
    tabs: MY_LISTINGS_TABS,
    setTab: (next) => {
      // A cursor belongs to ONE ordered candidate set. Carried across a tab
      // change it either bounces or honestly returns page four of a
      // different list — the same property `@stapel/search-react` writes
      // down for its own keyset state.
      setPage(options.limit !== undefined ? { limit: options.limit } : {});
      setTabState(next);
    },
    counters:
      counters.status === "error"
        ? loadFailed(counters.error)
        : counters.data !== undefined
          ? loadReady(counters.data)
          : loadLoading(),
    rows,
    page,
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
      setPage((current) => ({ ...current, anchor, direction: "next" }));
    },
    goPrev: () => {
      const anchor = envelope?.prev_anchor;
      if (anchor == null) return;
      setPage((current) => ({ ...current, anchor, direction: "prev" }));
    },
    gate,
    refetch: () => {
      void counters.refetch();
      void rowsQuery.refetch();
    },
  };
}

/** Renderless: the bag, handed to a render prop. */
export function MyListings(
  props: UseMyListingsOptions & {
    children: (bag: MyListingsBag) => ReactNode;
  }
): ReactElement {
  const bag = useMyListings(props);
  return <>{props.children(bag)}</>;
}
