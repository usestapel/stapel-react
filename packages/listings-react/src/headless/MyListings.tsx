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
import { browserAddress, tabFromSearch } from "../model/tabAddress.js";
import type { MyListingsAddress } from "../model/tabAddress.js";
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
  /** The three real counts, as the server reports them. */
  readonly counters: LoadState<MyCounters>;
  /**
   * The number to DRAW on each tab — the server's counter, raised to what is
   * actually on screen.
   *
   * D407: a moderator-rejected listing was on the Drafts tab under a badge
   * reading `0`. The two sets are grouped in two places — `my/counters`
   * aggregates server-side, `MY_LISTINGS_TAB_STATUSES` decides which statuses
   * a tab ASKS for — and any disagreement between them (a deployment running
   * an older counter, a status added upstream, a grouping changed on one side)
   * lands as a badge contradicting the rows underneath it.
   *
   * A count smaller than what a person can see is not a count, so the loaded
   * rows are treated as evidence: for the OPEN tab the number is never below
   * `rows.length`. It is a floor and not a replacement — the rows are one
   * keyset page and the counter is the whole set, so the counter still wins
   * whenever it is the larger of the two.
   */
  readonly tabCounts: LoadState<Readonly<Record<MyListingsTab, number>>>;
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
  /**
   * Which tab to open when the ADDRESS names none. `?tab=drafts` wins over it
   * — an address is a person's own statement about what they want to see, and
   * a default cannot outrank one.
   */
  readonly initialTab?: MyListingsTab;
  readonly limit?: number;
  /**
   * Where the open tab is kept. Default: the browser's own query string
   * (`?tab=`), which is what makes `/account/listings?tab=drafts` open drafts
   * and survive a reload — see `model/tabAddress.ts`.
   *
   * A host with a router passes its own binding. `NO_ADDRESS` opts out
   * entirely, for a surface that mounts this hook somewhere the address is not
   * about it (two dashboards on one page, a preview inside a modal).
   */
  readonly address?: MyListingsAddress;
}

export function useMyListings(
  options: UseMyListingsOptions = {}
): MyListingsBag {
  const gate = useMandateGate();
  const sessionReady = useActiveSessionReady();
  // The address is read ONCE, at mount, and written on every change: this is
  // the initial value of a control the person then operates, not a controlled
  // input fed by the URL. (A host that navigates its own router to a different
  // `?tab=` remounts the pane, which is the same thing.)
  const address = options.address ?? browserAddress();
  const [tab, setTabState] = useState<MyListingsTab>(
    () => tabFromSearch(address.search) ?? options.initialTab ?? "active"
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

  // D407, the floor: never a number smaller than the rows on screen. See
  // `MyListingsBag.tabCounts`.
  const tabCounts: LoadState<Readonly<Record<MyListingsTab, number>>> =
    useMemo(() => {
      if (counters.status === "error") return loadFailed(counters.error);
      if (counters.data === undefined) return loadLoading();
      const server = counters.data;
      const visible = rows.status === "ready" ? rows.data.length : 0;
      return loadReady(
        Object.fromEntries(
          MY_LISTINGS_TABS.map((one) => [
            one,
            one === tab ? Math.max(server[one], visible) : server[one],
          ])
        ) as Readonly<Record<MyListingsTab, number>>
      );
    }, [counters.status, counters.error, counters.data, rows, tab]);

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
      // …and the address says which list is on screen, so a reload, a
      // bookmark and a shared link all land on it.
      (options.address ?? browserAddress()).setTab(next);
    },
    counters:
      counters.status === "error"
        ? loadFailed(counters.error)
        : counters.data !== undefined
          ? loadReady(counters.data)
          : loadLoading(),
    tabCounts,
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
