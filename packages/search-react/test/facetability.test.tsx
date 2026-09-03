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
 *
 * The second half of the file is the other way a group can fail to be a
 * filter: the type is right and the RESULT SET is empty of it. See
 * `keepsAnAxisOpen`.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import type { FeatureDef } from "@stapel/attributes-react";
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
      dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
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
        dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      state: stateOf("type=listing"),
    });
    // `video_file_url` counted to `{}` and is dropped by the COVERAGE rule
    // below, not by the type rule — with no def there is no type to judge it
    // by. What this test is about is the three that survive: an absent def
    // never decides a group away.
    expect(groups.map((g) => g.slug)).toEqual(["condition", "vendor", "imei"]);
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
        dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
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

describe("a counted axis nothing in the result set carries is not a filter", () => {
  // The coverage floor stops at the queried category's own schema, on the
  // server: `FACET_MIN_COVERAGE` governs only the slugs an evidence plan
  // borrowed from sibling leaves. On the deployed phones leaf that leaves
  // `sim_config`, `device_history` and `set` — authored `select` features no
  // listing fills — arriving counted, zero-filled by `fill_zero_options`,
  // complete and dead: a heading in the rail and a chip on a 390px row for
  // three checkboxes each guaranteed to return nothing.
  const DEAD_FEATURES: readonly FeatureDef[] = [
    ...PHONE_FEATURES,
    {
      slug: "sim_config",
      name: "test.feature.sim",
      config: {
        type: "select",
        translatable_options: false,
        options: [
          { value: "esim", label: "eSIM" },
          { value: "nano", label: "nano-SIM" },
        ],
      },
    },
  ];

  function slugsFor(
    facets: Readonly<Record<string, Readonly<Record<string, number>>>>,
    search = "type=listing",
    skipped: readonly string[] = []
  ): readonly string[] {
    return buildFacetGroups({
      facets,
      meta: {
        approximate: false,
        candidates: 43,
        counted: Object.keys(facets),
        skipped: [...skipped],
        dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      state: stateOf(search),
      categoryFeatures: DEAD_FEATURES,
    }).map((group) => group.slug);
  }

  it("drops an authored group the server zero-filled to nothing", () => {
    const slugs = slugsFor({ ...PHONE_FACETS, sim_config: { esim: 0, nano: 0 } });
    expect(slugs).not.toContain("sim_config");
    // and has not taken the live axes with it
    expect(slugs).toEqual(["condition", "vendor"]);
  });

  it("drops a counted group that came back with no buckets at all", () => {
    // `video_file_url: {}` — counted, and empty. Same death, one step earlier:
    // the model used to hand this out and every skin filtered it again.
    expect(slugsFor(PHONE_FACETS)).not.toContain("video_file_url");
  });

  it("KEEPS a zero option beside a live one — that is drill-down working", () => {
    // The distinction the whole rule turns on. `novoe: 0` says what swapping
    // to it would get you, and "nothing" is information; the group still
    // narrows, because `b-u` does.
    const slugs = slugsFor({ ...PHONE_FACETS, condition: { "b-u": 31, novoe: 0 } });
    expect(slugs).toContain("condition");
  });

  it("KEEPS an UNCOUNTED group, which sums to zero for the opposite reason", () => {
    // A skipped slug's options carry `count: null` — nobody looked. Dropping
    // on that is the regression the `MAX_FACET_FIELDS` branch exists to
    // prevent: `/query` accepts `f.<slug>` whether or not it counted it.
    const { condition, ...rest } = PHONE_FACETS;
    void condition;
    const slugs = slugsFor(rest, "type=listing", ["condition"]);
    expect(slugs).toContain("condition");
  });

  it("KEEPS a dead group the reader has already filtered on", () => {
    // Otherwise the URL narrows the search to nothing and the control that
    // would widen it again is gone.
    const slugs = slugsFor(
      { ...PHONE_FACETS, sim_config: { esim: 0, nano: 0 } },
      "type=listing&f.sim_config=esim"
    );
    expect(slugs).toContain("sim_config");
  });
});
