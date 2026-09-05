/**
 * The dashboard's open tab, IN THE ADDRESS.
 *
 * `<MyListingsPane>` kept its tab in component state, which is the same as
 * keeping it nowhere: `/account/listings?tab=drafts` opened Active, a reload
 * threw the tab away, and a seller who wanted to send somebody (or themselves,
 * tomorrow) to their drafts had no address that meant "drafts". "Which of my
 * three lists am I looking at" is exactly the kind of state a URL is for —
 * `@stapel/search-react` says the same thing at length about its filters.
 *
 * ── Why this module and not a router ─────────────────────────────────────
 *
 * This pair carries no router and must not grow one: a package that reached
 * for `react-router` would be unusable in a Next.js app and vice versa. So the
 * address is read and written through the two DOM APIs every browser has, and
 * the whole of that contact is here — three pure functions plus one guarded
 * read/write pair, so a test can exercise the rules without a window and a
 * host with its own router can pass {@link MyListingsAddress} instead.
 *
 * ── replace, not push ────────────────────────────────────────────────────
 *
 * Switching tab is a READ of your own dashboard, not a step in a flow. A
 * `pushState` per tab would make Back walk Archive → Drafts → Active before it
 * left the dashboard at all, which is the history churn `@stapel/search-react`
 * documents for its own "a filter is a read" decision. `replaceState` keeps
 * the address shareable and reloadable, which is the whole point, and leaves
 * Back meaning "the page before this one".
 */
import { MY_LISTINGS_TABS } from "./status.js";
import type { MyListingsTab } from "./status.js";

/** The query parameter the tab lives in. */
export const MY_LISTINGS_TAB_PARAM = "tab";

/**
 * The tab a query string names, or `undefined`.
 *
 * An unknown value is `undefined` and NOT an error: a link written by hand, a
 * tab this build has dropped, or a `?tab=` some other component on the page
 * owns must all fall back to the host's `initialTab` rather than throwing or
 * opening an empty list.
 */
export function tabFromSearch(search: string): MyListingsTab | undefined {
  const value = new URLSearchParams(search).get(MY_LISTINGS_TAB_PARAM);
  if (value === null) return undefined;
  return MY_LISTINGS_TABS.find((tab) => tab === value);
}

/**
 * The same query string with the tab written into it.
 *
 * Every other parameter is preserved verbatim and in place: the dashboard is
 * one component on somebody's page, and rewriting an address it does not own
 * would drop whatever else is in it.
 */
export function searchWithTab(search: string, tab: MyListingsTab): string {
  const params = new URLSearchParams(search);
  params.set(MY_LISTINGS_TAB_PARAM, tab);
  const next = params.toString();
  return next.length > 0 ? `?${next}` : "";
}

/**
 * The address binding. A host with a router passes its own; absent, the
 * browser's is used and a non-DOM environment gets one that does nothing.
 */
export interface MyListingsAddress {
  /** The current query string, `?`-prefixed or not — both parse. */
  readonly search: string;
  /** Write the tab. See the module note for why this replaces. */
  setTab(tab: MyListingsTab): void;
}

/** An address that carries nothing and remembers nothing — SSR, and a host
 * that opts out. */
export const NO_ADDRESS: MyListingsAddress = {
  search: "",
  setTab: () => undefined,
};

/**
 * The browser's own address, or {@link NO_ADDRESS} where there is no document.
 *
 * Read fresh on every call rather than captured: the host's router may have
 * navigated since this component mounted, and a stale copy would write back
 * an address that is no longer on screen.
 */
export function browserAddress(): MyListingsAddress {
  if (typeof window === "undefined" || typeof window.history === "undefined") {
    return NO_ADDRESS;
  }
  return {
    search: window.location.search,
    setTab: (tab) => {
      const next = searchWithTab(window.location.search, tab);
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${next}${window.location.hash}`
      );
    },
  };
}
