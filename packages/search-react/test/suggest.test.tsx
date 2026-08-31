/**
 * The typeahead — `GET /suggest`, which was typed and unreachable for three
 * releases.
 *
 * Two facts about the endpoint drive everything here. It answers title
 * prefixes out of the INDEX (stapel-search keeps no query log, which is a
 * privacy decision before it is a product one), so every suggestion is a
 * search that has results. And it is THROTTLED per client, so a request per
 * keystroke is how a person earns a 429 for typing quickly.
 *
 * Hence: a floor on the prefix length, a debounce shorter than the search's,
 * and a menu that stays shut on an empty answer rather than growing an empty
 * popover under a half-typed word.
 */
import { describe, expect, it } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { SearchBox } from "../src/default/index.js";
import {
  SUGGEST_MAX_LIMIT,
  SUGGEST_MIN_CHARS,
  useSearchBox,
  useSuggest,
} from "../src/index.js";
import type { SuggestAnswer } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, TestProviders, mockServer } from "./harness.js";

const FAST = 10;
const ITEMS = ["bosch drill", "bosch saw"];

// `SuggestAnswer`, not the generated `SuggestResponse`: every body here is
// what a server OLDER than stapel-search 0.7.0 sends, and the generated type
// declares 0.7.0's five new fields required.
function suggestServer(body: SuggestAnswer | undefined, status = 200) {
  return mockServer({
    "/query": { body: searchResponse() },
    "/suggest": { status, body: body ?? { items: [], backend: "postgres" } },
  });
}

function suggestCalls(server: ReturnType<typeof mockServer>): readonly string[] {
  return server.calls.filter((c) => c.url.includes("/suggest")).map((c) => c.url);
}

function providersWrapper(server: ReturnType<typeof mockServer>) {
  return (props: { children: ReactNode }): ReactElement => (
    <TestProviders server={server}>{props.children}</TestProviders>
  );
}

describe("the index is asked only about a prefix that means something", () => {
  it("does not ask at all below the minimum prefix", async () => {
    const server = suggestServer({ items: ITEMS, backend: "postgres" });
    renderHook(() => useSuggest({ type: "listing", q: "bo" }), {
      wrapper: providersWrapper(server),
    });
    // Nothing to wait FOR — so give the query a turn to prove it stays idle.
    await act(async () => {
      await Promise.resolve();
    });
    expect(suggestCalls(server)).toHaveLength(0);
    expect(SUGGEST_MIN_CHARS).toBe(3);
  });

  it("asks once the prefix is long enough, and sends it trimmed", async () => {
    const server = suggestServer({ items: ITEMS, backend: "postgres" });
    const { result } = renderHook(
      () => useSuggest({ type: "listing", q: "  bos  " }),
      { wrapper: providersWrapper(server) }
    );
    await waitFor(() => {
      expect(result.current.data?.items).toEqual(ITEMS);
    });
    const query = server.lastQuery("/suggest");
    expect(query?.get("q")).toBe("bos");
    expect(query?.get("type")).toBe("listing");
  });

  it("never sends a limit the server would have to clamp", async () => {
    const server = suggestServer({ items: ITEMS, backend: "postgres" });
    const { result } = renderHook(
      () => useSuggest({ type: "listing", q: "bosch", limit: 500 }),
      { wrapper: providersWrapper(server) }
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(server.lastQuery("/suggest")?.get("limit")).toBe(String(SUGGEST_MAX_LIMIT));
  });

  it("obeys `enabled` — a host that wants no typeahead makes no request", async () => {
    const server = suggestServer({ items: ITEMS, backend: "postgres" });
    renderHook(() => useSuggest({ type: "listing", q: "bosch", enabled: false }), {
      wrapper: providersWrapper(server),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(suggestCalls(server)).toHaveLength(0);
  });
});

describe("the box's suggestions", () => {
  function boxWrapper(server: ReturnType<typeof mockServer>) {
    return (props: { children: ReactNode }): ReactElement => (
      <TestHarness server={server} initialSearch="type=listing">
        {props.children}
      </TestHarness>
    );
  }

  it("arrive for the SETTLED prefix, not for every keystroke", async () => {
    const server = suggestServer({ items: ITEMS, backend: "postgres" });
    const { result } = renderHook(
      () => useSearchBox({ debounceMs: FAST, suggestDebounceMs: FAST }),
      { wrapper: boxWrapper(server) }
    );

    for (const draft of ["b", "bo", "bos"]) {
      act(() => {
        result.current.setDraft(draft);
      });
    }
    await waitFor(() => {
      expect(result.current.suggestions).toEqual(ITEMS);
    });
    // One settled prefix, one request — the two shorter ones were below the
    // floor and the debounce collapsed the rest.
    expect(suggestCalls(server)).toHaveLength(1);
  });

  it("stays typeable when the endpoint refuses — a failed suggest shows nothing", async () => {
    const server = suggestServer(undefined, 503);
    const { result } = renderHook(
      () => useSearchBox({ debounceMs: FAST, suggestDebounceMs: FAST }),
      { wrapper: boxWrapper(server) }
    );
    act(() => {
      result.current.setDraft("bosch");
    });
    await waitFor(() => {
      expect(result.current.suggestState.status).toBe("failed");
    });
    // A typeahead has no surface for "we could not fetch suggestions", and the
    // person is mid-word: the box keeps working and says nothing.
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.draft).toBe("bosch");
  });

  it("costs nothing to backspace to a prefix already asked about", async () => {
    const server = suggestServer({ items: ITEMS, backend: "postgres" });
    const { result } = renderHook(
      () => useSearchBox({ debounceMs: FAST, suggestDebounceMs: FAST }),
      { wrapper: boxWrapper(server) }
    );
    act(() => {
      result.current.setDraft("bos");
    });
    await waitFor(() => {
      expect(result.current.suggestions).toEqual(ITEMS);
    });
    act(() => {
      result.current.setDraft("bosc");
    });
    await waitFor(() => {
      expect(suggestCalls(server)).toHaveLength(2);
    });
    act(() => {
      result.current.setDraft("bos");
    });
    await act(async () => {
      await Promise.resolve();
    });
    // The prefix is keyed and still fresh (staleTime is a minute — the index
    // changes when something is published, not between two letters).
    expect(suggestCalls(server)).toHaveLength(2);
  });
});

describe("the menu never opens on an empty answer", () => {
  it("shows no listbox when the index has nothing for the prefix", async () => {
    const server = suggestServer({ items: [], backend: "postgres" });
    render(
      <TestHarness server={server} initialSearch="type=listing">
        <SearchBox debounceMs={FAST} suggestDebounceMs={FAST} />
      </TestHarness>
    );
    fireEvent.change(screen.getByTestId("search-box-input"), {
      target: { value: "zzzz" },
    });
    await waitFor(() => {
      expect(suggestCalls(server)).toHaveLength(1);
    });
    // An empty popover under a half-typed word says "there is nothing" about a
    // search that has not run.
    expect(document.querySelector(".ant-select-dropdown")).toBeNull();
  });

  it("opens with the answers when there ARE any", async () => {
    const server = suggestServer({ items: ITEMS, backend: "postgres" });
    render(
      <TestHarness server={server} initialSearch="type=listing">
        <SearchBox debounceMs={FAST} suggestDebounceMs={FAST} />
      </TestHarness>
    );
    fireEvent.change(screen.getByTestId("search-box-input"), {
      target: { value: "bos" },
    });
    await waitFor(() => {
      expect(document.querySelector(".ant-select-dropdown")).not.toBeNull();
    });
    expect(screen.getAllByText(ITEMS[0] as string).length).toBeGreaterThan(0);
  });
});
