/**
 * A COLOUR FACET SHOWS THE COLOUR (deep/elektronika-telefony.md §3).
 *
 * The reference's colour group draws a filled dot beside every value and ours
 * drew the word alone — the one rail regression that deep walk found, on the
 * one attribute whose label is strictly worse than the thing itself.
 *
 * Two halves, and both fail towards drawing NOTHING, because both mistakes are
 * visible on a shopper's screen:
 *
 *  - the AXIS is recognised from the slug the catalogue mapped it to (and the
 *    address key beside it, and `axis_role` the day the canon grows a colour
 *    one). The live phones leaf maps its colour axis to `color_ref_select` and
 *    publishes it as `color`, so both spellings have to resolve;
 *  - the VALUE is painted only where its code IS a colour by a name the pair
 *    can resolve — a design-system colour role, a CSS keyword, or a hex code.
 *    A catalogue's own transliterated term (`chernyy`) names no colour anyone
 *    can read, and an invented mapping for it would be data this pair does not
 *    have.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import {
  FacetGroupControl,
  SWATCH_SIZE,
  facetSwatch,
  isColorAxis,
  swatchColor,
} from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

function meta(counted: readonly string[]): Parameters<typeof buildFacetGroups>[0]["meta"] {
  return {
    approximate: false,
    candidates: 30,
    counted: [...counted],
    skipped: [],
    dropped_filters: [],
    core_ranges: [],
    plan: "category",
    withheld: [],
    categories: [],
  };
}

/**
 * A FAKE colour axis — a schemaless group whose values are named in the one
 * vocabulary the pair can resolve, beside one that is not.
 *
 * Deliberately not the live phones leaf's own codes: those resolve to nothing
 * (see the last test in this file), which is the correct outcome there and a
 * useless fixture here.
 */
function colorGroup(
  slug: string,
  buckets: Record<string, number> = { black: 9, white: 4, mauveish: 2 }
): FacetGroup {
  const [group] = buildFacetGroups({
    facets: { [slug]: buckets },
    meta: meta([slug]),
    state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
  });
  if (group === undefined) throw new Error(`no group ${slug}`);
  return group;
}

function mount(group: FacetGroup): void {
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      <FacetGroupControl group={group} onToggle={() => undefined} />
    </TestHarness>
  );
}

describe("which axis is a colour", () => {
  it("reads the slug the live catalogue actually maps a colour to", () => {
    // `color_ref_select` is the phones leaf's own slug: the control type is a
    // tail on the axis name, and what a value is PICKED with cannot change
    // what it IS.
    expect(isColorAxis({ slug: "color_ref_select" })).toBe(true);
    expect(isColorAxis({ slug: "colour_multi" })).toBe(true);
    expect(isColorAxis({ slug: "color" })).toBe(true);
    // The address key alone is enough: the same answer publishes `url_key`
    // `color` for that slug, and a deployment may map either way round.
    expect(isColorAxis({ slug: "tsvet", urlKey: "color" })).toBe(true);
    // A colour OF something is still a colour axis.
    expect(isColorAxis({ slug: "color_fridge" })).toBe(true);
  });

  it("does not fire on an axis that merely starts with the letters", () => {
    expect(isColorAxis({ slug: "colorado_region" })).toBe(false);
    expect(isColorAxis({ slug: "vendor" })).toBe(false);
    expect(isColorAxis({ slug: "condition" })).toBe(false);
    // Not a colour axis, so not one value of it gets a dot either.
    expect(facetSwatch({ slug: "vendor" }, "black")).toBeNull();
  });

  it("prefers a schema that SAYS so, when one ever does", () => {
    /* The canon's `axis_role` vocabulary is closed and carries no colour yet
       (make/model/generation/year/mileage), so this arm is dead until it
       grows one — written now so that the day it does, nothing here has to
       change. The slug in this fixture says nothing at all. */
    expect(
      isColorAxis({
        slug: "attr_1187",
        feature: { slug: "attr_1187", config: {}, axis_role: "color" } as never,
      })
    ).toBe(true);
  });
});

describe("which value gets a dot", () => {
  it("resolves a CSS colour keyword, in any casing or separator", () => {
    expect(swatchColor("black")).toBe("black");
    expect(swatchColor("SILVER")).toBe("silver");
    expect(swatchColor("sky-blue")).toBe("skyblue");
  });

  it("resolves a hex code a catalogue spelled out itself", () => {
    expect(swatchColor("#0a0")).toBe("#0a0");
    expect(swatchColor("#1a2b3c")).toBe("#1a2b3c");
  });

  it("resolves a design-system colour ROLE through its custom property", () => {
    // §68: one neutral vocabulary of roles, resolved at paint time, so a
    // value named for a role follows the brand and the dark side rather than
    // freezing whichever theme mounted first.
    expect(swatchColor("brand")).toBe("var(--stapel-brand)");
    expect(swatchColor("success")).toBe("var(--stapel-success)");
  });

  it("says NOTHING for a code that names no colour anyone can resolve", () => {
    expect(swatchColor("mauveish")).toBeNull();
    expect(swatchColor("dark_slate_2")).toBeNull();
    expect(swatchColor("")).toBeNull();
  });
});

describe("the dot on the rail", () => {
  it("draws one beside every value it can resolve, and none beside the rest", () => {
    const group = colorGroup("color_ref_select");
    mount(group);
    const black = screen.getByTestId("facet-swatch-color_ref_select-black");
    expect(black.getAttribute("data-swatch")).toBe("black");
    expect(black.getAttribute("aria-hidden")).toBe("true");
    expect(black.style.inlineSize).toBe(`${String(SWATCH_SIZE)}px`);
    expect(black.style.background).toBe("black");
    expect(screen.getByTestId("facet-swatch-color_ref_select-white")).toBeTruthy();
    // A value nobody named a colour for gets the word and no placeholder: a
    // grey dot beside it would say "this one is grey".
    expect(
      screen.queryByTestId("facet-swatch-color_ref_select-mauveish")
    ).toBeNull();
    // The label is untouched in every case — the dot is a SECOND way to read
    // the row, so a screen reader and a monochrome display lose nothing.
    expect(screen.getByText("mauveish")).toBeTruthy();
  });

  it("draws none at all on an axis that is not a colour", () => {
    mount(colorGroup("vendor", { black: 9, white: 4 }));
    expect(screen.queryByTestId("facet-swatch-vendor-black")).toBeNull();
    expect(screen.getByTestId("facet-option-vendor-black")).toBeTruthy();
  });

  it("draws none for the live phones leaf's own codes — and that is the DATA", () => {
    /* `GET /search/api/v1/query?type=listing&category=mobilnye-telefony
       &facets=color_ref_select` answers 11 values, all transliterated Russian
       (`chernyy`, `belyy`, `siniy`, and so on), and the vocabulary endpoint carries
       `code`/`label`/`level`/`band` and no hue for any of them. So the axis is
       recognised and not one value resolves: the gap between us and the
       reference here is a colour the catalogue never stated, not a control
       this pair failed to draw. Pinned as a test so the number is not
       re-derived by hand next time. */
    const live = ["chernyy", "belyy", "siniy", "zelenyy", "serebristyy", "seryy"];
    expect(isColorAxis({ slug: "color_ref_select", urlKey: "color" })).toBe(true);
    expect(live.filter((code) => swatchColor(code) !== null)).toEqual([]);
  });
});
