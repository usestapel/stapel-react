/**
 * A SEARCH QUERY REACHING A CATEGORY.
 *
 * The gap this closes is narrow and was real: the search field could land a
 * person in results and never in a category, so the one word they knew about
 * what they wanted was good for nothing else. What is asserted here is the
 * ranking (the answer they meant, first), the folding (what they can type on
 * the keyboard they have), the cap (a list of links, not a typeahead over the
 * whole tree) and — the property that makes it usable at all — that typing
 * costs no request.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import type { LinkComponent } from "@stapel/core";
import {
  CATEGORY_SEARCH_LIMIT,
  buildCategoryTree,
  flattenCategoryNodes,
  foldForSearch,
  rankCategoryMatches,
  useCategorySearch,
} from "../src/index.js";
import type { CategorySearchHit } from "../src/index.js";
import { CategorySearchHits } from "../src/default/index.js";
import { TestProviders, mockServer, testStore } from "./harness.js";
import { ROWS, categoryRow, page } from "./fixtures.js";

/**
 * A catalogue whose names are LITERALS, so the pure tests read as a person
 * sees them. The wire's names are translation keys and the hook tests below
 * exercise that half through a translator.
 */
const LITERAL_ROWS = [
  categoryRow(20, "phones", "Phones", null, "", "", { translatable: false }),
  categoryRow(21, "phone-cases", "Phone cases", null, "", "", {
    translatable: false,
  }),
  categoryRow(22, "smartphones", "Smartphones", null, "", "", {
    translatable: false,
  }),
  categoryRow(23, "moviles", "Móviles", null, "", "", { translatable: false }),
  categoryRow(24, "audio", "Audio", null, "", "", { translatable: false }),
  categoryRow(25, "phone", "Phone", null, "", "", { translatable: false }),
];

/**
 * A row whose CAPTION shares nothing with its key or its slug — the only
 * shape that can prove matching runs on what a person reads.
 */
const KEYED_TV = categoryRow(26, "tv", "category.tv", null, "", "");

const LITERAL_NODES = flattenCategoryNodes(buildCategoryTree(LITERAL_ROWS).roots);

function slugsFor(query: string, limit?: number): readonly string[] {
  return rankCategoryMatches(LITERAL_NODES, query, {
    ...(limit !== undefined ? { limit } : {}),
  }).map((hit) => hit.node.category.slug);
}

describe("rankCategoryMatches", () => {
  it("ranks an exact name first, then a prefix, then a substring", () => {
    expect(slugsFor("phone")).toEqual([
      // "Phone" is the name typed, verbatim.
      "phone",
      // "Phones" and "Phone cases" begin with it — in the catalogue's own
      // display order, so two equally good hits do not swap between renders.
      "phones",
      "phone-cases",
      // "Smartphones" merely contains it.
      "smartphones",
    ]);
  });

  it("says WHY each hit matched, rather than scoring it", () => {
    const hits = rankCategoryMatches(LITERAL_NODES, "phone");
    expect(hits.map((hit) => hit.match)).toEqual([
      "exact",
      "prefix",
      "prefix",
      "substring",
    ]);
  });

  it("ignores case and diacritics in both directions", () => {
    expect(foldForSearch("Móviles")).toBe("moviles");
    expect(slugsFor("MOVILES")).toEqual(["moviles"]);
    expect(slugsFor("móvil")).toEqual(["moviles"]);
  });

  it("matches the slug too — the string a URL and a bookmark carry", () => {
    expect(slugsFor("phone-cases")).toEqual(["phone-cases"]);
  });

  it("caps the answer, because a catalogue can match almost anything", () => {
    expect(CATEGORY_SEARCH_LIMIT).toBeGreaterThan(0);
    expect(slugsFor("o", 2)).toHaveLength(2);
    expect(slugsFor("o").length).toBeLessThanOrEqual(CATEGORY_SEARCH_LIMIT);
  });

  it("answers a blank query with nothing, not with the whole catalogue", () => {
    // "Nobody has asked yet" and "everything matched" are different things,
    // and only the first one is true here.
    expect(slugsFor("")).toEqual([]);
    expect(slugsFor("   ")).toEqual([]);
  });

  it("builds the hit's href off basePath, like every other link in the pair", () => {
    const [hit] = rankCategoryMatches(LITERAL_NODES, "audio", {
      basePath: "/catalogue",
    });
    expect(hit?.href).toBe("/catalogue/audio");
  });

  it("matches the CAPTION a translator produces, not the raw key", () => {
    // Names arrive as translation keys, so a person typing what they SEE
    // matches nothing until the host's translator is wired in.
    const keyed = flattenCategoryNodes(buildCategoryTree([KEYED_TV]).roots);
    expect(rankCategoryMatches(keyed, "television")).toHaveLength(0);
    const hits = rankCategoryMatches(keyed, "television", {
      translate: (key) => (key === "category.tv" ? "Television" : key),
    });
    expect(hits.map((hit) => hit.caption)).toEqual(["Television"]);
    expect(hits[0]?.match).toBe("exact");
  });

  it("still matches the raw key when no translator is wired — the honest fallback", () => {
    const keyed = flattenCategoryNodes(buildCategoryTree([KEYED_TV]).roots);
    expect(rankCategoryMatches(keyed, "category.tv")).toHaveLength(1);
  });
});

const TRANSLATIONS: Readonly<Record<string, string>> = {
  "category.electronics": "Electronics",
  "category.phones": "Phones",
  "category.laptops": "Laptops",
  "category.used_phones": "Used phones",
  "category.vehicles": "Vehicles",
};

/** Stable identity, so a re-render cannot be mistaken for a changed input. */
function translate(key: string): string {
  return TRANSLATIONS[key] ?? key;
}

/**
 * Types `queries` one entry at a time, in ONE mount — the shape a person's
 * keystrokes have. Re-rendering the provider tree instead would build a fresh
 * QueryClient per keystroke and prove nothing about caching.
 */
function SearchProbe(props: {
  readonly queries: readonly string[];
}): ReactElement {
  const [typed, setTyped] = useState(0);
  const [store] = useState(testStore);
  const query = props.queries[typed] ?? "";
  const hits = useCategorySearch(query, { store, translate });
  return (
    <div>
      <button
        type="button"
        data-testid="keystroke"
        onClick={() => {
          setTyped((n) => Math.min(n + 1, props.queries.length - 1));
        }}
      >
        {query}
      </button>
      <span data-testid="hits">
        {hits.map((hit) => hit.node.category.slug).join(",")}
      </span>
    </div>
  );
}

describe("useCategorySearch", () => {
  it("finds a category in the tree that is already loaded", async () => {
    render(
      <TestProviders server={mockServer({ "/categories/": { body: page(ROWS) } })}>
        <SearchProbe queries={["phones"]} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("hits").textContent).toBe(
        "phones,used-phones"
      );
    });
  });

  it("issues NO request per keystroke", async () => {
    // The whole reason this is a hook over the synced catalogue rather than an
    // endpoint: six characters cost six passes over an in-memory array.
    const server = mockServer({ "/categories/": { body: page(ROWS) } });
    render(
      <TestProviders server={server}>
        <SearchProbe queries={["p", "ph", "pho", "phon", "phone", "phones"]} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("hits").textContent).not.toBe("");
    });
    const before = server.queries("/categories/").length;
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByTestId("keystroke"));
    }
    await waitFor(() => {
      expect(screen.getByTestId("hits").textContent).toBe(
        "phones,used-phones"
      );
    });
    expect(server.queries("/categories/")).toHaveLength(before);
  });

  it("cannot reach a row the browse projection hides", async () => {
    // `retired` is `active: false`. Search that surfaced it would be a second,
    // contradictory catalogue beside the tiles.
    render(
      <TestProviders server={mockServer({ "/categories/": { body: page(ROWS) } })}>
        <SearchProbe queries={["retired"]} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("hits")).toBeTruthy();
    });
    expect(screen.getByTestId("hits").textContent).toBe("");
  });
});

/** A container's router adapter — the one line a host writes. */
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <span role="link" data-router-to={href} {...rest}>
    {children}
  </span>
);

const HITS: readonly CategorySearchHit[] = rankCategoryMatches(
  LITERAL_NODES,
  "phone"
);

describe("<CategorySearchHits>", () => {
  it("prints NOTHING when there are none", () => {
    const { container } = render(
      <TestProviders server={mockServer({})}>
        <CategorySearchHits query="nothing" hits={[]} />
      </TestProviders>
    );
    expect(container.querySelector("[data-testid]")).toBeNull();
  });

  it("renders one link per hit, in the ranked order", () => {
    render(
      <TestProviders server={mockServer({})}>
        <CategorySearchHits query="phone" hits={HITS} />
      </TestProviders>
    );
    const links = [
      ...screen.getByTestId("categories-search-hits").querySelectorAll("a"),
    ];
    expect(links).toHaveLength(HITS.length);
    // The exact match leads, as `rankCategoryMatches` ordered it.
    expect(links[0]?.getAttribute("href")).toBe("/c/phone");
    expect(links[0]?.getAttribute("data-category-slug")).toBe("phone");
  });

  it("says what the list is FOR, with the words that produced it", () => {
    render(
      <TestProviders server={mockServer({})}>
        <CategorySearchHits query="phone" hits={HITS} />
      </TestProviders>
    );
    expect(
      screen.getByTestId("categories-search-hits").textContent
    ).toContain("phone");
  });

  it("routes through the host's link component, not a full page load", () => {
    render(
      <TestProviders server={mockServer({})}>
        <CategorySearchHits
          query="phone"
          hits={HITS}
          linkComponent={RouterLink}
        />
      </TestProviders>
    );
    const routed = [
      ...screen
        .getByTestId("categories-search-hits")
        .querySelectorAll("[data-router-to]"),
    ];
    expect(routed).toHaveLength(HITS.length);
    expect(
      screen.getByTestId("categories-search-hits").querySelectorAll("a[href]")
    ).toHaveLength(0);
  });
});
