/**
 * A facet a person cannot filter by is not a chip.
 *
 * A live classified deployment's category-scoped answer carries
 * `imei: {"355971829187494": 1}` and `video_file_url: {}` beside its condition
 * and its vendor: the facet plan is built from the leaf category's feature
 * defs and the counter counts what is indexed, so an identifier that is unique
 * per document and a URL field both come back as groups. On a 390px chip row
 * a chip offering one IMEI with a count of one is not a filter — it is a chip
 * that matches exactly one listing, and it pushes the chips that DO narrow off
 * the screen.
 *
 * The verdict is the category schema's, by value TYPE, and the two honest edge
 * cases are asserted below beside the main rule:
 *
 *  - a group with NO feature def is KEPT, because `categoryFeatures` is an
 *    optional slot and silence is not a verdict — the alternative empties the
 *    row for every host that never threaded the schema through;
 *  - a slug the URL already filters on is KEPT whatever its type says, or a
 *    person is left holding a constraint with no control to remove it.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  FACETABLE_FEATURE_TYPES,
  buildFacetGroups,
  isFacetableFeature,
  parseSearchState,
} from "../src/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { SearchPage } from "../src/default/index.js";
import { PHONE_FACETS, PHONE_FEATURES, legacySearchResponse } from "./fixtures.js";
import { TestProviders, mockServer, useTestParams } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

function stateOf(search: string) {
  return parseSearchState(new URLSearchParams(search), OPTIONS).state;
}

function groupsOf(search = "type=listing"): readonly string[] {
  return buildFacetGroups({
    facets: PHONE_FACETS,
    meta: {
      approximate: false,
      candidates: 43,
      counted: Object.keys(PHONE_FACETS),
      skipped: [],
      dropped_filters: [], core_ranges: [],
    },
    state: stateOf(search),
    categoryFeatures: PHONE_FEATURES,
  }).map((group) => group.slug);
}

describe("the schema decides which counted slugs are filters", () => {
  it("drops an identifier facet the category types as free text (imei)", () => {
    expect(groupsOf()).not.toContain("imei");
  });

  it("drops a URL facet the category types as free text (video_file_url)", () => {
    expect(groupsOf()).not.toContain("video_file_url");
  });

  it("keeps the select and the vocabulary-backed groups", () => {
    // `condition` is an inline `select`, `vendor` is a `ref_select` whose
    // config is a pointer to a vocabulary. Both are bounded option sets, so
    // both are chips — the pointer is a labelling problem, not a facetability
    // one.
    expect(groupsOf()).toEqual(["condition", "vendor"]);
  });

  it("reads the vocabulary-backed half of the type list from attributes-react", () => {
    // Not a list this package invented: the ref types come from
    // `VOCABULARY_BACKED_TYPES`, so a new vocabulary-backed type becomes
    // facetable here the day it is added there.
    expect([...FACETABLE_FEATURE_TYPES].sort()).toEqual([
      "bool",
      "hierarchical_select",
      "ref_hierarchical_select",
      "ref_select",
      "select",
    ]);
  });

  it("does not drop a numeric feature into nothing — it belongs to the range half", () => {
    // `int`/`float`/`convertible_unit` are absent from the facetable list on
    // purpose: `buildRangeGroups` draws them as two bounds. A test that only
    // asserted "int is not facetable" would pass equally well for a build
    // that lost the price filter.
    expect(isFacetableFeature({ slug: "power_w", config: { type: "int" } })).toBe(
      false
    );
  });
});

describe("the two edge cases the rule has to name", () => {
  it("KEEPS a group with no feature def at all — silence is not a verdict", () => {
    // An older server, a feature retired since the write, or the very common
    // case of a host that passed no `categoryFeatures`: answering "not
    // facetable" for an absent def would blank the whole row.
    const groups = buildFacetGroups({
      facets: PHONE_FACETS,
      meta: {
        approximate: false,
        candidates: 43,
        counted: Object.keys(PHONE_FACETS),
        skipped: [],
        dropped_filters: [], core_ranges: [],
      },
      state: stateOf("type=listing"),
    });
    expect(groups.map((g) => g.slug)).toEqual([
      "condition",
      "vendor",
      "imei",
      "video_file_url",
    ]);
    expect(isFacetableFeature(undefined)).toBe(true);
  });

  it("KEEPS an untyped feature def, for the same reason", () => {
    expect(isFacetableFeature({ slug: "mystery", config: {} })).toBe(true);
  });

  it("KEEPS a slug the URL already filters on, whatever its type says", () => {
    // Otherwise the link narrows the search and nothing on screen widens it.
    const slugs = groupsOf("type=listing&f.imei=355971829187494");
    expect(slugs).toContain("imei");
    const groups = buildFacetGroups({
      facets: PHONE_FACETS,
      meta: {
        approximate: false,
        candidates: 43,
        counted: Object.keys(PHONE_FACETS),
        skipped: [],
        dropped_filters: [], core_ranges: [],
      },
      state: stateOf("type=listing&f.imei=355971829187494"),
      categoryFeatures: PHONE_FEATURES,
    });
    expect(
      groups.find((g) => g.slug === "imei")?.options[0]?.selected
    ).toBe(true);
  });

  it("drops the same slug again once the filter is cleared", () => {
    expect(groupsOf("type=listing&f.imei=")).not.toContain("imei");
  });
});

describe("the chip row on the deployed (pre-0.4.0) server", () => {
  function Page(): ReactElement {
    const adapter: SearchParamsAdapter = useTestParams(
      "type=listing&category=elektronika/mobilnye-telefony"
    );
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        filtersLayout="sheet"
        categoryFeatures={PHONE_FEATURES}
      />
    );
  }

  it("draws chips for the filters and none for the identifier or the URL field", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/query": { body: legacySearchResponse() },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
      >
        <Page />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByTestId("search-chip-condition")).toBeTruthy();
    });
    expect(screen.getByTestId("search-chip-vendor")).toBeTruthy();
    expect(screen.queryByTestId("search-chip-imei")).toBeNull();
    expect(screen.queryByTestId("search-chip-video_file_url")).toBeNull();
  });
});
