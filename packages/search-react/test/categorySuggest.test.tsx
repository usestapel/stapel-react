/**
 * The search box reaches the CATALOGUE, not only the titles.
 *
 * The owner's complaint on a live classified deployment: typing a word that
 * names a section answered listing titles and nothing else, so the search
 * field could not reach a category at all. Their navigation canon rules out
 * both usual workarounds — a picker, and a client-side typeahead over the whole
 * tree — and stapel-search 0.7.0 answers `/suggest` with neither: it sends
 * DESTINATIONS, each with its ancestor path and the number of live listings
 * behind it, which is the one thing a client-side matcher can never compute.
 *
 * Everything here is also a statement about the OTHER server: the stand was
 * redeployed mid-session, so "the key is simply absent" is a case that
 * happened rather than one imagined.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { SearchBox } from "../src/default/index.js";
import { offerableCategories, useSearchBox } from "../src/index.js";
import type { SuggestAnswer } from "../src/index.js";
import {
  legacySuggestAnswer,
  searchResponse,
  suggestAnswer,
} from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

/** Shorter than the shipped debounce, so a test is not a stopwatch. */
const FAST = 10;

/** The prefix the fixture answers for. */
const PREFIX = "шорты";

function server(body: SuggestAnswer) {
  return mockServer({
    "/query": { body: searchResponse() },
    "/suggest": { body },
  });
}

function boxWrapper(mock: ReturnType<typeof mockServer>) {
  return (props: { children: ReactNode }): ReactElement => (
    <TestHarness server={mock} initialSearch="type=listing" locale="ru">
      {props.children}
    </TestHarness>
  );
}

/** Render the box, type the prefix, and wait for the menu. */
async function openMenu(body: SuggestAnswer, locale = "en"): Promise<void> {
  render(
    <TestHarness server={server(body)} initialSearch="type=listing" locale={locale}>
      <SearchBox debounceMs={FAST} suggestDebounceMs={FAST} />
    </TestHarness>
  );
  fireEvent.change(screen.getByTestId("search-box-input"), {
    target: { value: PREFIX },
  });
  await waitFor(() => {
    expect(document.querySelector(".ant-select-dropdown")).not.toBeNull();
  });
}

describe("destinations lead the menu", () => {
  it("renders the categories ABOVE the term suggestions", async () => {
    // A classified's box is a navigation control before it is a text filter:
    // the person who typed a section's name wants the section, and the titles
    // that happen to contain the word are the fallback.
    await openMenu(suggestAnswer());
    const dropdown = document.querySelector(".ant-select-dropdown");
    expect(dropdown).not.toBeNull();
    const text = dropdown?.textContent ?? "";
    expect(text.indexOf("Sections")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Sections")).toBeLessThan(text.indexOf("Suggestions"));
    // And the first destination is the one the SERVER ranked first, by live
    // listing count — the client never re-ranks.
    expect(text.indexOf("Мужская одежда")).toBeLessThan(
      text.indexOf("Женская одежда")
    );
  });

  it("prints the whole ancestor path, not the leaf name", async () => {
    // Three catalogues have a section by this name; the path is the only
    // thing that says which one a row is.
    await openMenu(suggestAnswer());
    expect(
      screen.getByTestId("search-box-category-10/41").textContent
    ).toContain("Мужская одежда / Шорты");
  });

  it("draws no category group at all when the server sends no key", async () => {
    // A pre-0.7.0 answer. The box must behave exactly as it did: terms only,
    // no heading, nothing thrown reaching for an absent key.
    await openMenu(legacySuggestAnswer());
    expect(screen.queryByTestId("search-box-categories-heading")).toBeNull();
    expect(screen.queryByTestId("search-box-terms-heading")).toBeNull();
    const text = document.querySelector(".ant-select-dropdown")?.textContent ?? "";
    expect(text).toContain("шорты adidas");
  });
});

describe("following a destination", () => {
  it("narrows the SERP with the SERVER's own category string", async () => {
    // The server joins the ancestry itself precisely so a client cannot invent
    // a different join and silently miss, so the URL must carry `10/41`
    // verbatim — never a path the client rebuilt from names or slugs.
    let search = "";
    render(
      <TestHarness
        server={server(suggestAnswer())}
        initialSearch="type=listing"
        onAdapter={(adapter) => {
          search = adapter.search;
        }}
      >
        <SearchBox debounceMs={FAST} suggestDebounceMs={FAST} />
      </TestHarness>
    );
    fireEvent.change(screen.getByTestId("search-box-input"), {
      target: { value: PREFIX },
    });
    await waitFor(() => {
      expect(screen.getByTestId("search-box-category-10/41")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-box-category-10/41"));
    await waitFor(() => {
      expect(new URLSearchParams(search).get("category")).toBe("10/41");
    });
  });

  it("clears the typed text, so the SERP shows the count the row promised", async () => {
    // The row quoted a section's count. Keeping `q` would land the person on
    // the section intersected with a title search for the word that found it —
    // strictly fewer results than the number they just tapped.
    const mock = server(suggestAnswer());
    const { result } = renderHook(
      () => useSearchBox({ debounceMs: FAST, suggestDebounceMs: FAST }),
      { wrapper: boxWrapper(mock) }
    );
    act(() => {
      result.current.setDraft(PREFIX);
    });
    await waitFor(() => {
      expect(result.current.categories.length).toBeGreaterThan(0);
    });
    const first = result.current.categories[0];
    expect(first).toBeDefined();
    act(() => {
      if (first !== undefined) result.current.chooseCategory(first);
    });
    await waitFor(() => {
      expect(result.current.committed).toBe("");
    });
    expect(result.current.draft).toBe("");
  });
});

describe("the count is a counted sentence", () => {
  it("pluralizes in English", async () => {
    await openMenu(suggestAnswer());
    expect(
      screen.getByTestId("search-box-category-10/41").textContent
    ).toContain("1240 listings");
  });

  it("pluralizes in Russian, where one ending is wrong for most numbers", async () => {
    // Russian selects a different ending for 1 and for 3, and a single string
    // would have been right only for 5-20 — the defect the results count
    // already closed. Two counts, two endings, one family.
    await openMenu(
      suggestAnswer({
        categories: [
          {
            id: 41,
            slug: "shorty",
            name: "Шорты",
            path: ["Мужская одежда", "Шорты"],
            category: "10/41",
            count: 1,
            depth: 2,
            match: "prefix",
          },
          {
            id: 52,
            slug: "shorty",
            name: "Шорты",
            path: ["Женская одежда", "Шорты"],
            category: "11/52",
            count: 3,
            depth: 2,
            match: "prefix",
          },
        ],
      }),
      "ru"
    );
    expect(
      screen.getByTestId("search-box-category-10/41").textContent
    ).toContain("1 объявление");
    expect(
      screen.getByTestId("search-box-category-11/52").textContent
    ).toContain("3 объявления");
  });
});

describe("what the answer could not do is not a claim about the catalogue", () => {
  it("draws NO group when the server had no category provider", async () => {
    // `categories: []` with `degraded: ["category_suggestions"]`. An empty
    // group under a heading would be the box saying the catalogue has no
    // section by that name, which this answer never said.
    await openMenu(
      suggestAnswer({ categories: [], degraded: ["category_suggestions"] })
    );
    expect(screen.queryByTestId("search-box-categories-heading")).toBeNull();
    // And the terms half still answers, so the menu is not empty either.
    const text = document.querySelector(".ant-select-dropdown")?.textContent ?? "";
    expect(text).toContain("шорты adidas");
  });

  it("reports the shortfall on the bag rather than as a banner", async () => {
    // The reader is mid-word and a provider being down is the operator's
    // business — the same ruling the engine shortfalls already get. A skin
    // that wants to say more can, from here.
    const mock = server(
      suggestAnswer({ categories: [], degraded: ["category_suggestions"] })
    );
    const { result } = renderHook(
      () => useSearchBox({ debounceMs: FAST, suggestDebounceMs: FAST }),
      { wrapper: boxWrapper(mock) }
    );
    act(() => {
      result.current.setDraft(PREFIX);
    });
    await waitFor(() => {
      expect(result.current.categoriesUnavailable).toBe(true);
    });
    expect(result.current.categories).toEqual([]);
    expect(result.current.suggestions.length).toBeGreaterThan(0);
  });

  it("keeps the rows but drops the numbers when the ancestry never arrived", async () => {
    // `category_rollup` means every count reads 0 for a mechanical reason.
    // Filtering on the count there would delete the whole group for a reason
    // that has nothing to do with what is in the catalogue.
    const rolled = suggestAnswer({
      degraded: ["category_rollup"],
      categories: (suggestAnswer().categories ?? []).map((category) => ({
        ...category,
        count: 0,
      })),
    });
    await openMenu(rolled);
    const row = screen.getByTestId("search-box-category-10/41");
    expect(row.textContent).toContain("Мужская одежда / Шорты");
    expect(row.textContent).not.toContain("listing");
    expect(offerableCategories(rolled)).toHaveLength(3);
  });
});

describe("an empty section is still a place, and it says it is empty", () => {
  it("offers a zero-count category and prints the zero", async () => {
    // Measured on a live board: 3036 leaves, ~100 listings, so 2924 leaves
    // read zero. Dropping them made three everyday words produce
    // NO PANEL AT ALL — the type-ahead reporting that six real sections of
    // the catalogue do not exist. An honest "0 listings" is a fact a
    // person can act on; a missing panel is not.
    await openMenu(suggestAnswer());
    expect(screen.getByTestId("search-box-category-10/41")).toBeTruthy();
    const empty = screen.getByTestId("search-box-category-12/63");
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain("0");
  });

  it("is decided in the model, so both surfaces agree", () => {
    expect(offerableCategories(suggestAnswer()).map((c) => c.category)).toEqual([
      "10/41",
      "11/52",
      "12/63",
    ]);
    expect(offerableCategories(legacySuggestAnswer())).toEqual([]);
    expect(offerableCategories(undefined)).toEqual([]);
  });

  it("keeps the server's order — it already ranks stock first", () => {
    // The ranking is `stapel-search`'s (stock, then match quality, then
    // count): this side must not re-sort, or the two disagree about which
    // destination is best while only one of them has the counts.
    const answer = suggestAnswer();
    expect(offerableCategories(answer)).toEqual(answer.categories);
  });
});
