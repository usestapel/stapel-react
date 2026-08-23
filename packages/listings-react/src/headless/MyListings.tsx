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
  MyListingCard,
  MyListingsParams,
  MyCounters,
} from "../api/types.js";
import { defaultMyListingsSource } from "../model/mineSource.js";
import type { MyListingsSource } from "../model/mineSource.js";
import { useListingsApi } from "../model/context.js";
import { useMyCounters } from "../model/queries.js";
import { listingsQueryKeys, pageKey } from "../model/queryKeys.js";
import { MY_LISTINGS_TABS, MY_LISTINGS_UNTABBED_STATUSES } from "../model/status.js";
import type { MyListingsTab } from "../model/status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { useMandateGate } from "./useMandateGate.js";

/**
 * The owner's dashboard.
 *
 * Three counts and the rows behind them, both owner-scoped reads of
 * stapel-listings: `my/counters` and — since 0.7.0 — `my/listings`. Until
 * that release the rows had no route at all and this hook failed them with a
 * named reason rather than rendering an empty grid; `model/mineSource.ts`
 * keeps the argument and the seam that came out of it.
 *
 * TWO reads, not one, and the second one is the point of this file's shape:
 * the three tabs are the SERVER's status groupings, and `blocked` — a
 * moderation takedown — is in none of them, because `my/counters` counts it
 * in none of them. A dashboard that only ever asked for a tab's statuses
 * would hide exactly the listing whose owner most needs to know. So
 * `blockedRows` is fetched beside them, off the same route, narrowed to
 * whatever `MY_LISTINGS_UNTABBED_STATUSES` derives.
 */

export interface MyListingsBag {
  readonly tab: MyListingsTab;
  readonly tabs: readonly MyListingsTab[];
  setTab(tab: MyListingsTab): void;
  /** The three real counts. */
  readonly counters: LoadState<MyCounters>;
  /** The rows for the current tab. */
  readonly rows: LoadState<readonly MyListingCard[]>;
  /**
   * The rows no tab folds in — a moderation takedown, today. Empty for
   * almost every seller; when it is not, it is the most important thing on
   * the screen. Never `failed` in a way that hides the tabs: this read is
   * independent of `rows` and a skin renders it beside them.
   */
  readonly blockedRows: LoadState<readonly MyListingCard[]>;
  readonly page: MyListingsParams;
  readonly nextPage: ActionAvailability;
  readonly prevPage: ActionAvailability;
  goNext(): void;
  goPrev(): void;
  /** Whether the person may see this screen at all. */
  readonly gate: ActionAvailability;
  refetch(): void;
}

export interface UseMyListingsOptions {
  /** Replace the contract's own `my/listings` read — a deployment that keeps
   * its sellers' rows somewhere else. Absent: {@link defaultMyListingsSource}. */
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
  const [page, setPage] = useState<MyListingsParams>(
    options.limit !== undefined ? { limit: options.limit } : {}
  );

  const counters = useMyCounters();
  const api = useListingsApi();
  const injected = options.source;
  const source = useMemo(
    () => injected ?? defaultMyListingsSource(api),
    [injected, api]
  );
  const ready = sessionReady && gate.available;

  const rowsQuery = useQuery({
    queryKey: listingsQueryKeys.mine(tab, pageKey(page)),
    queryFn: ({ signal }) => source({ tab, page, signal }),
    enabled: ready,
    retry: false,
  });

  // The takedowns, off the same route and deliberately NOT paged: a seller
  // with a page of blocked listings has a problem no "next" button improves,
  // and this sits above a dashboard rather than being one.
  const blockedQuery = useQuery({
    queryKey: listingsQueryKeys.mineUntabbed(),
    queryFn: ({ signal }) =>
      api.myListings({ status: MY_LISTINGS_UNTABBED_STATUSES }, { signal }),
    enabled: ready && MY_LISTINGS_UNTABBED_STATUSES.length > 0,
    retry: false,
  });

  const rows: LoadState<readonly MyListingCard[]> = useMemo(() => {
    if (rowsQuery.status === "error") return loadFailed(rowsQuery.error);
    if (rowsQuery.data !== undefined) return loadReady(rowsQuery.data.items);
    return loadLoading();
  }, [rowsQuery.status, rowsQuery.error, rowsQuery.data]);

  const blockedRows: LoadState<readonly MyListingCard[]> = useMemo(() => {
    if (MY_LISTINGS_UNTABBED_STATUSES.length === 0) return loadReady([]);
    if (blockedQuery.status === "error") return loadFailed(blockedQuery.error);
    if (blockedQuery.data !== undefined) return loadReady(blockedQuery.data.items);
    return loadLoading();
  }, [blockedQuery.status, blockedQuery.error, blockedQuery.data]);

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
    blockedRows,
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
      void blockedQuery.refetch();
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
