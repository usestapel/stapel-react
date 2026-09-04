/**
 * "Search in other categories" — one line, from the answer that drew the
 * cards.
 *
 * The defect this pack closes was measured on a live SERP: a full-width block
 * of one row per category appeared under the results a beat AFTER them,
 * pushing the page, and it came from a second request to `/suggest` for
 * information `/query` had already sent as `facet_meta.categories`.
 *
 * So the assertions are about the WIRE as much as about the pixels: with
 * results on screen no `/suggest` call may exist at all, and the line has to
 * be in the document in the same commit as the first card.
 */
import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  OTHER_CATEGORIES_CLASS,
  SearchResultsPane,
  otherCategoriesCss,
} from "../src/default/index.js";
import {
  OTHER_CATEGORIES_LIMIT,
  OTHER_CATEGORIES_PHONE_LIMIT,
} from "../src/index.js";
import type { SuggestAnswer } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestHarness,
  mockServer,
  setViewport,
} from "./harness.js";

/** `{path, count}` exactly as `facet_meta.categories` sends it. */
function metaCategories(
  rows: readonly (readonly [string, number])[]
): readonly { category: string; count: number }[] {
  return rows.map(([category, count]) => ({ category, count }));
}

const CARS = metaCategories([
  ["cars", 12],
  ["buses", 3],
  ["motorhomes", 1],
]);

function suggestAnswer(
  categories: readonly { category: string; name: string; count: number }[]
): SuggestAnswer {
  return {
    backend: "postgres",
    terms: [],
    categories: categories.map((row, index) => ({
      id: index + 1,
      slug: row.category,
      name: row.name,
      path: [row.name],
      category: row.category,
      count: row.count,
      depth: 1,
      match: "prefix" as const,
    })),
  };
}

function serverWith(
  response: ReturnType<typeof searchResponse>,
  suggest?: SuggestAnswer
) {
  return mockServer({
    "/query": { body: response },
    "/suggest": { body: suggest ?? { backend: "postgres", categories: [] } },
  });
}

function paneWith(
  server: ReturnType<typeof mockServer>,
  extra: { categoryName?: (category: string) => string | undefined } = {}
): ReactElement {
  return (
    <TestHarness server={server} initialSearch="type=listing&q=auto">
      <SearchResultsPane otherCategories {...extra} />
    </TestHarness>
  );
}

function suggestCalls(server: ReturnType<typeof mockServer>): readonly string[] {
  return server.calls.filter((call) => call.url.includes("/suggest")).map((c) => c.url);
}

describe("the line comes out of the search response, not a second request", () => {
  it("asks /suggest for nothing while there are results", async () => {
    const response = searchResponse({
      facet_meta: { ...searchResponse().facet_meta, categories: CARS },
    });
    const server = serverWith(response);
    render(paneWith(server));

    await screen.findByTestId("search-other-categories");
    // A turn for anything the render scheduled to actually fire.
    await act(async () => {
      await Promise.resolve();
    });
    expect(suggestCalls(server)).toHaveLength(0);
    // …and exactly one search: the line reads the pane's own query, keyed the
    // same, so it shares the cache entry rather than opening a second one.
    expect(server.calls.filter((call) => call.url.includes("/query"))).toHaveLength(1);
  });

  it("is on screen in the same commit as the first card — nothing pops in later", async () => {
    const response = searchResponse({
      facet_meta: { ...searchResponse().facet_meta, categories: CARS },
    });
    const server = serverWith(response);
    render(paneWith(server));

    // The results arriving IS the line arriving: one await, both present.
    await screen.findByTestId("search-results");
    expect(screen.getByTestId("search-other-categories")).toBeTruthy();
    expect(screen.getByTestId("search-other-categories").dataset["source"]).toBe(
      "results"
    );
    // And no height held back for a request that is never made.
    expect(
      screen.getByTestId("search-other-categories").dataset["reserved"]
    ).toBeUndefined();
  });

  it("prints the answer's own counts, busiest first, and narrows the search on press", async () => {
    const response = searchResponse({
      facet_meta: {
        ...searchResponse().facet_meta,
        categories: metaCategories([
          ["buses", 3],
          ["cars", 12],
        ]),
      },
    });
    const server = serverWith(response);
    let search = "";
    render(
      <TestHarness
        server={server}
        initialSearch="type=listing&q=auto"
        onAdapter={(adapter) => {
          search = adapter.search;
        }}
      >
        <SearchResultsPane otherCategories />
      </TestHarness>
    );

    await screen.findByTestId("search-other-categories");
    const entries = screen.getAllByTestId("search-other-category");
    expect(entries.map((node) => node.dataset["category"])).toEqual(["cars", "buses"]);
    expect(entries[0]?.textContent).toContain("12");

    fireEvent.click(entries[0] as HTMLElement);
    await waitFor(() => {
      expect(new URLSearchParams(search).get("category")).toBe("cars");
    });
    // The query is KEPT: the count beside the name was scoped to it, and a
    // press that dropped the word would land on a different number.
    expect(new URLSearchParams(search).get("q")).toBe("auto");
  });

  it("drops a row nothing can name rather than printing an id at a person", async () => {
    const response = searchResponse({
      facet_meta: {
        ...searchResponse().facet_meta,
        categories: metaCategories([
          ["140/145", 9],
          ["buses", 3],
        ]),
      },
    });
    const server = serverWith(response);
    render(paneWith(server));

    await screen.findByTestId("search-other-categories");
    const entries = screen.getAllByTestId("search-other-category");
    expect(entries.map((node) => node.dataset["category"])).toEqual(["buses"]);
  });

  it("names an id path when the host can", async () => {
    const response = searchResponse({
      facet_meta: {
        ...searchResponse().facet_meta,
        categories: metaCategories([["140/145", 9]]),
      },
    });
    const server = serverWith(response);
    render(
      paneWith(server, {
        categoryName: (category) => (category === "140/145" ? "Cars" : undefined),
      })
    );

    await screen.findByTestId("search-other-categories");
    expect(screen.getByTestId("search-other-category").textContent).toContain("Cars");
  });

  it("leaves out the section the search is already in", async () => {
    const response = searchResponse({
      facet_meta: {
        ...searchResponse().facet_meta,
        categories: metaCategories([
          ["cars", 12],
          ["buses", 3],
        ]),
      },
    });
    const server = serverWith(response);
    render(
      <TestHarness server={server} initialSearch="type=listing&q=auto&category=cars">
        <SearchResultsPane otherCategories />
      </TestHarness>
    );

    await screen.findByTestId("search-other-categories");
    const entries = screen.getAllByTestId("search-other-category");
    expect(entries.map((node) => node.dataset["category"])).toEqual(["buses"]);
  });
});

describe("the tail is folded, and the fold says how much of it there is", () => {
  const MANY = metaCategories(
    Array.from({ length: 12 }, (_, i) => [`c${String(i)}`, 100 - i] as const)
  );

  it("prints the first N on a desktop and folds the rest", async () => {
    setViewport(DESKTOP_WIDTH);
    const response = searchResponse({
      facet_meta: { ...searchResponse().facet_meta, categories: MANY },
    });
    render(paneWith(serverWith(response)));

    await screen.findByTestId("search-other-categories");
    expect(screen.getAllByTestId("search-other-category")).toHaveLength(
      OTHER_CATEGORIES_LIMIT
    );
    const more = screen.getByTestId("search-other-categories-more");
    expect(more.textContent).toContain(String(12 - OTHER_CATEGORIES_LIMIT));

    fireEvent.click(more);
    await waitFor(() => {
      expect(screen.getAllByTestId("search-other-category")).toHaveLength(12);
    });
    expect(screen.queryByTestId("search-other-categories-more")).toBeNull();
  });

  it("halves the cap on a phone and clamps the collapsed line to two rows", async () => {
    setViewport(PHONE_WIDTH);
    const response = searchResponse({
      facet_meta: { ...searchResponse().facet_meta, categories: MANY },
    });
    render(paneWith(serverWith(response)));

    const line = await screen.findByTestId("search-other-categories");
    expect(within(line).getAllByTestId("search-other-category")).toHaveLength(
      OTHER_CATEGORIES_PHONE_LIMIT
    );
    // A cap counts entries; the clamp is what holds the line to two rows when
    // the names are long.
    // A CLASS and a hoisted sheet, not an inline style: a vendor property set
    // through the DOM style object is dropped by anything that does not
    // already know it, which is a clamp that silently stops clamping.
    expect(line.className).toContain(`${OTHER_CATEGORIES_CLASS}--clamped`);
    expect(otherCategoriesCss()).toContain("-webkit-line-clamp:2");
    expect(otherCategoriesCss()).toContain("-webkit-box-orient:vertical");
    setViewport(DESKTOP_WIDTH);
  });
});

describe("an empty result is the only page that earns a request", () => {
  const EMPTY = searchResponse({
    items: [],
    count: 0,
    has_next: false,
    facet_meta: { ...searchResponse().facet_meta, categories: [] },
  });

  it("asks /suggest, and holds the row's height from the first frame", async () => {
    const server = serverWith(
      EMPTY,
      suggestAnswer([
        { category: "cars", name: "Cars", count: 12 },
        { category: "buses", name: "Buses", count: 3 },
      ])
    );
    render(paneWith(server));

    // The slot exists BEFORE the answer does — that is the whole point of it.
    const slot = await screen.findByTestId("search-other-categories");
    expect(slot.dataset["reserved"]).toBe("on");
    expect(slot.style.minBlockSize).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByTestId("search-other-category")).toHaveLength(2);
    });
    const line = screen.getByTestId("search-other-categories");
    expect(line.dataset["source"]).toBe("suggest");
    // Still reserved once filled: the height was never allowed to change.
    expect(line.dataset["reserved"]).toBe("on");
    expect(line.style.minBlockSize).toBeTruthy();
    expect(suggestCalls(server)).toHaveLength(1);
  });

  it("keeps the reserved height when the suggest answer names nothing", async () => {
    const server = serverWith(EMPTY, { backend: "postgres", categories: [] });
    render(paneWith(server));

    const slot = await screen.findByTestId("search-other-categories");
    await act(async () => {
      await Promise.resolve();
    });
    expect(slot.dataset["reserved"]).toBe("on");
    expect(screen.queryAllByTestId("search-other-category")).toHaveLength(0);
  });
});

describe("the line is off unless a surface asks for it", () => {
  it("draws nothing — and asks nothing — without the prop", async () => {
    const response = searchResponse({
      facet_meta: { ...searchResponse().facet_meta, categories: CARS },
    });
    const server = serverWith(response);
    render(
      <TestHarness server={server} initialSearch="type=listing&q=auto">
        <SearchResultsPane />
      </TestHarness>
    );

    await screen.findByTestId("search-results");
    expect(screen.queryByTestId("search-other-categories")).toBeNull();
    expect(suggestCalls(server)).toHaveLength(0);
  });
});
