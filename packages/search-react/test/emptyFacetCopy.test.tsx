/**
 * ONE CAUSE, ONE SENTENCE (census/nedvizhimost.md).
 *
 * The census walked five real-estate leaves and found the rail explaining the
 * same thing two different ways: "this search offers no filters" on three of
 * them, and "24 more filters apply to too few of these results" on a fourth —
 * two texts for one cause (few listings, so few filter values), and nothing on
 * either page saying why a reader got one rather than the other.
 *
 * The second sentence is gone (`search.facets.withheld` and its plural family
 * were deleted from every locale, and the withheld case now says NOTHING —
 * the reference leaves thin filters visible and explains nothing either). What
 * was never pinned is the part that made the drift possible in the first
 * place: that the ONE remaining sentence is one key, that both of the pair's
 * layouts reach it, and that they print the same string when they do.
 *
 * So this file asserts the unification rather than the fix:
 *
 *  1. the desktop COLUMN and the phone SHEET — two layouts, two mounts of the
 *     panel, one empty arm — render the same text for the same answer;
 *  2. it comes from `search.facets.empty`, and every locale the pair ships
 *     carries exactly that one sentence for the case;
 *  3. no second "no filters" key exists in any bundle to drift back into.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { SearchPage } from "../src/default/index.js";
import {
  SEARCH_I18N_KEYS,
  searchI18nBundleEn,
} from "../src/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchI18nBundleRu } from "../src/i18n/ru.js";
import { searchI18nBundleEs } from "../src/i18n/es.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

/** The width this page draws the rail at, and the one it draws the sheet at. */
const RAIL_WIDTH = 1024;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

/**
 * The answer the census's own pages produce: results, and an axis plan with
 * nothing in it. No withheld groups, no skipped ones, no core range — the one
 * case the sentence is still allowed to be printed for.
 */
function barrenServer(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        count: 0,
        facets: {},
        facet_meta: {
          approximate: false,
          candidates: 0,
          counted: [],
          skipped: [],
          dropped_filters: [],
          core_ranges: [],
          plan: "category",
          withheld: [],
          categories: [],
        },
      }),
    },
  });
}

function Page(props: { readonly openSheet?: boolean }): ReactElement {
  /* A CATEGORY in the address, which is what the census's own pages are
     (`/c/komnaty`, `/c/zemelnye-uchastki`): the page keeps the filters column
     open for the leaf a reader walked into, and the panel inside it is the one
     with nothing to draw. */
  const adapter: SearchParamsAdapter = useTestParams(
    "type=listing&category=141/151"
  );
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      /* The phone keeps the panel behind a chip, so the sheet has to be open
         for its arm to be on screen at all — the state a reader reaches by
         pressing «Filters», and the only way the second code path renders. */
      {...(props.openSheet === true ? { defaultFiltersOpen: true } : {})}
    />
  );
}

/** Mount the page at one width and read back the empty arm's sentence. */
async function emptyText(width: number): Promise<string> {
  setViewport(width);
  render(
    <TestProviders server={barrenServer()}>
      <Page {...(width < RAIL_WIDTH ? { openSheet: true } : {})} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("facets-empty")).toBeTruthy();
  });
  return screen.getByTestId("facets-empty").textContent ?? "";
}

describe("the two layouts say the same thing about an empty rail", () => {
  it("renders one identical sentence in the column and in the sheet", async () => {
    const column = await emptyText(RAIL_WIDTH);
    expect(column).not.toBe("");
    cleanup();
    const sheet = await emptyText(PHONE_WIDTH);
    /* The layouts differ in every other way — a 280px column beside the
       results versus a bottom sheet behind a chip — and the sentence they
       print for the same answer may not. */
    expect(sheet).toBe(column);
    /* …and it is the key's own copy, not a second string that happens to read
       like it. `toContain` rather than `toBe`: the shared `EmptyState` draws
       an `aria-hidden` illustration whose SVG carries a `<title>`, which jsdom
       counts as text and a reader never hears. */
    expect(column).toContain(searchI18nBundleEn[SEARCH_I18N_KEYS.facetsEmpty]);
  });
});

describe("one key, in every locale, with nothing to drift back into", () => {
  const BUNDLES = [
    ["en", searchI18nBundleEn],
    ["ru", searchI18nBundleRu],
    ["es", searchI18nBundleEs],
  ] as const;

  it("carries exactly one sentence for the case in en, ru and es", () => {
    for (const [locale, bundle] of BUNDLES) {
      const copy = bundle[SEARCH_I18N_KEYS.facetsEmpty];
      expect(copy, `${locale} has no copy for the empty rail`).toBeTruthy();
      // One sentence: the arm is a caption on an empty state, not a paragraph
      // explaining the search plan.
      expect((copy ?? "").split(". ").length).toBe(1);
    }
  });

  it("ships no SECOND explanation of the same cause", () => {
    /* `search.facets.withheld` was the other half of the census finding —
       "N filters apply to too few of these results", printed for an answer
       whose rail was thin for the same reason. It is deleted, and the
       withheld case says nothing at all now (`data-withheld` is a test hook
       with no text). A bundle that grows it back re-opens the defect. */
    for (const [locale, bundle] of BUNDLES) {
      const strays = Object.keys(bundle).filter((key) =>
        key.startsWith("search.facets.withheld")
      );
      expect(strays, `${locale} grew a second empty-rail sentence`).toEqual([]);
    }
  });
});
