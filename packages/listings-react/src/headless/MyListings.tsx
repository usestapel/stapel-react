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
import {
  MY_LISTINGS_COUNTED_TABS,
  MY_LISTINGS_REMOVED_TAB,
  MY_LISTINGS_TABS,
  MY_LISTINGS_UNTABBED_STATUSES,
} from "../model/status.js";
import type { MyListingsCountedTab, MyListingsTab } from "../model/status.js";
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
 * the three counted tabs are the SERVER's status groupings, and `blocked` — a
 * moderation takedown — is in none of them, because `my/counters` counts it
 * in none of them. A dashboard that only ever asked for a tab's statuses
 * would hide exactly the listing whose owner most needs to know. So
 * `blockedRows` is fetched beside them, off the same route, narrowed to
 * whatever `MY_LISTINGS_UNTABBED_STATUSES` derives.
 *
 * That second read is also the fourth tab's COUNT (D407). `my/counters` has
 * three integers and no fourth, so the removed tab is counted from the rows it
 * holds — which is honest exactly because that read is unpaged and runs
 * whichever tab is open. The one thing it cannot describe is a page cap: a
 * seller with more takedowns than one page of `my/listings` would see the page
 * count and not the total, and there is no counter on the wire to check it
 * against (see `MyListingsBag.tabCounts`).
 */

export interface MyListingsBag {
  readonly tab: MyListingsTab;
  /**
   * The tabs to DRAW, in order.
   *
   * The server's three always; the removed one only where there is something
   * in it or the person asked for it by address. An empty "Taken down" tab is
   * a scare, and the seller it would scare is the one it has nothing to tell.
   */
  readonly tabs: readonly MyListingsTab[];
  setTab(tab: MyListingsTab): void;
  /** The three real counts, as the server reports them. */
  readonly counters: LoadState<MyCounters>;
  /**
   * The number to DRAW on each tab — the server's counter, raised to what is
   * actually on screen, plus the fourth tab's own.
   *
   * D407, twice over. The first half: a moderator-rejected listing was on the
   * Drafts tab under a badge reading `0`. The two sets are grouped in two
   * places — `my/counters` aggregates server-side, `MY_LISTINGS_TAB_STATUSES`
   * decides which statuses a tab ASKS for — and any disagreement between them
   * (a deployment running an older counter, a status added upstream, a
   * grouping changed on one side) lands as a badge contradicting the rows
   * underneath it. A count smaller than what a person can see is not a count,
   * so the loaded rows are treated as evidence: for the OPEN tab the number is
   * never below `rows.length`. It is a floor and not a replacement — the rows
   * are one keyset page and the counter is the whole set, so the counter still
   * wins whenever it is the larger of the two.
   *
   * The second half: a takedown was in no tab and therefore in no number, so
   * a cabinet holding one read "Active 0 · Drafts 0 · Archived 0" over it.
   * `removed` is counted from `blockedRows` — there is no server counter to
   * read, and the rows are the only evidence on the wire.
   */
  readonly tabCounts: LoadState<Readonly<Record<MyListingsTab, number>>>;
  /** The rows for the current tab — {@link MyListingsBag.blockedRows} while
   * the removed tab is open, and the tab's own keyset page otherwise. */
  readonly rows: LoadState<readonly MyListingCard[]>;
  /**
   * The rows the server's own counter folds into no tab — a moderation
   * takedown, today; the removed tab's whole contents and its count. Empty
   * for almost every seller; when it is not, it is the most important thing
   * on the screen. Never `failed` in a way that hides the tabs: this read is
   * independent of the tab's own and a skin renders it beside them.
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
  // The fourth tab is served by `blockedQuery` below, not by the host's
  // source: `MyListingsSource` is typed for the three counted tabs and a host
  // that implemented it before D407 has no answer for a fourth.
  const removed = tab === MY_LISTINGS_REMOVED_TAB;
  const countedTab: MyListingsCountedTab = removed
    ? MY_LISTINGS_COUNTED_TABS[0]
    : (tab as MyListingsCountedTab);

  const rowsQuery = useQuery({
    queryKey: listingsQueryKeys.mine(countedTab, pageKey(page)),
    queryFn: ({ signal }) => source({ tab: countedTab, page, signal }),
    enabled: ready && !removed,
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

  const blockedRows: LoadState<readonly MyListingCard[]> = useMemo(() => {
    if (MY_LISTINGS_UNTABBED_STATUSES.length === 0) return loadReady([]);
    if (blockedQuery.status === "error") return loadFailed(blockedQuery.error);
    if (blockedQuery.data !== undefined) return loadReady(blockedQuery.data.items);
    return loadLoading();
  }, [blockedQuery.status, blockedQuery.error, blockedQuery.data]);

  const tabRows: LoadState<readonly MyListingCard[]> = useMemo(() => {
    if (rowsQuery.status === "error") return loadFailed(rowsQuery.error);
    if (rowsQuery.data !== undefined) return loadReady(rowsQuery.data.items);
    return loadLoading();
  }, [rowsQuery.status, rowsQuery.error, rowsQuery.data]);

  const rows = removed ? blockedRows : tabRows;

  // The takedown count, when it is known. Not a `0` while the read is in
  // flight: the tab strip is drawn off this number and a tab that appeared a
  // beat after the page settled would move the three beside it.
  const blockedCount =
    blockedRows.status === "ready" ? blockedRows.data.length : undefined;

  // Paging belongs to the tab's own keyset read. The takedowns are fetched
  // unpaged on purpose, so the removed tab has nowhere to go and says so.
  const envelope = removed ? undefined : rowsQuery.data;

  // D407, the floor: never a number smaller than the rows on screen — and a
  // number for the fourth tab, which the server counts nowhere. See
  // `MyListingsBag.tabCounts`.
  const tabCounts: LoadState<Readonly<Record<MyListingsTab, number>>> =
    useMemo(() => {
      if (counters.status === "error") return loadFailed(counters.error);
      if (counters.data === undefined) return loadLoading();
      const server = counters.data;
      const visible = rows.status === "ready" ? rows.data.length : 0;
      return loadReady({
        ...(Object.fromEntries(
          MY_LISTINGS_COUNTED_TABS.map((one) => [
            one,
            one === tab ? Math.max(server[one], visible) : server[one],
          ])
        ) as Readonly<Record<MyListingsCountedTab, number>>),
        [MY_LISTINGS_REMOVED_TAB]: blockedCount ?? 0,
      });
    }, [counters.status, counters.error, counters.data, rows, tab, blockedCount]);

  // The removed tab is drawn where it has something to say — or where the
  // address named it, so `?tab=removed` opens a real (if empty) tab rather
  // than an activeKey pointing at nothing.
  const tabs: readonly MyListingsTab[] =
    removed || (blockedCount ?? 0) > 0 ? MY_LISTINGS_TABS : MY_LISTINGS_COUNTED_TABS;

  return {
    tab,
    tabs,
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
