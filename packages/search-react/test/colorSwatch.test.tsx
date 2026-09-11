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
 *  - the VALUE is painted from the CATALOGUE's own answer first — the term
 *    bag the answer ships as `facet_labels[<slug>].extras[<code>]`
 *    (stapel-search 0.16.5+), where a colour level carries `{hue: "#1a1a1a"}`
 *    — and, failing that, from the code read as a name: a design-system
 *    colour role, a CSS keyword, or a hex code. A catalogue's own
 *    transliterated term (`chernyy`) names no colour anyone can read, so
 *    until the bag arrives it gets nothing, and an invented mapping for it
 *    would still be data this pair does not have.
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
  termHue,
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

/**
 * The same fake axis, built through the answer's `facet_labels` so the term
 * bags travel the way they do in production — `buildFacetGroups` is the seam
 * that puts them on the group, and a test that hand-wrote `extras` onto a
 * literal would not prove the seam carries them.
 */
function hueGroup(
  slug: string,
  buckets: Record<string, number>,
  extras: Record<string, Record<string, unknown>>
): FacetGroup {
  const [group] = buildFacetGroups({
    facets: { [slug]: buckets },
    meta: meta([slug]),
    state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
    facetLabels: {
      [slug]: {
        label: "Colour",
        label_translatable: false,
        url_key: slug,
        translatable: false,
        values: Object.fromEntries(Object.keys(buckets).map((code) => [code, code])),
        extras,
        vocabulary: "phone-catalog",
        level: "Color",
        order: 1,
      },
    },
  });
  if (group === undefined) throw new Error(`no group ${slug}`);
  return group;
}

/** The live phones leaf's own colour codes, with the hues the catalogue
 * carries for them — the shape stapel-vocabularies 0.4.1 puts in `Term.extra`
 * and stapel-search 0.16.5 ships beside the caption. */
const LIVE_CODES = { chernyy: 9, belyy: 4, mauveish: 2 } as const;
const LIVE_HUES = {
  chernyy: { hue: "#1a1a1a" },
  belyy: { hue: "#ffffff" },
} as const;

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

  it("draws none for the live phones leaf's own codes when nothing states a hue", () => {
    /* `GET /search/api/v1/query?type=listing&category=mobilnye-telefony
       &facets=color_ref_select` answers 11 values, all transliterated Russian
       (`chernyy`, `belyy`, `siniy`, and so on). Read as NAMES they resolve to
       nothing and always will: the axis is recognised and not one value gets
       a dot. That was the whole story until the catalogue started shipping
       its own hue — see the block below — and it is still the story on every
       deployment whose answer carries no bag. Pinned as a test so the set is
       not re-derived by hand next time. */
    const live = ["chernyy", "belyy", "siniy", "zelenyy", "serebristyy", "seryy"];
    expect(isColorAxis({ slug: "color_ref_select", urlKey: "color" })).toBe(true);
    expect(live.filter((code) => swatchColor(code) !== null)).toEqual([]);
  });
});

describe("the hue the CATALOGUE states", () => {
  it("paints a transliterated code no name could ever resolve", () => {
    // The point of the whole rung: `chernyy` is not a colour keyword in any
    // language a browser speaks, and the catalogue has always known it is
    // #1a1a1a.
    const group = hueGroup("color_ref_select", LIVE_CODES, LIVE_HUES);
    expect(swatchColor("chernyy")).toBeNull();
    expect(termHue(group, "chernyy")).toBe("#1a1a1a");
    expect(facetSwatch(group, "chernyy")).toBe("#1a1a1a");
    expect(facetSwatch(group, "belyy")).toBe("#ffffff");
  });

  it("keeps the name-resolving fallback for a code the bag skipped", () => {
    // Two codes carry a hue and one does not; the third falls through to the
    // reading that was there before, and to nothing when that fails too.
    const group = hueGroup(
      "color_ref_select",
      { chernyy: 9, black: 4, mauveish: 2 },
      { chernyy: { hue: "#1a1a1a" } }
    );
    expect(facetSwatch(group, "chernyy")).toBe("#1a1a1a");
    expect(facetSwatch(group, "black")).toBe("black");
    expect(facetSwatch(group, "mauveish")).toBeNull();
  });

  it("leaves an answer with no bag exactly as it was", () => {
    // The ordinary deployment: an older server, or a resolver that serves no
    // bags. `extras` never arrives and every arm below it still runs.
    const group = colorGroup("color_ref_select");
    expect(group.extras).toBeUndefined();
    expect(termHue(group, "black")).toBeNull();
    expect(facetSwatch(group, "black")).toBe("black");
    expect(facetSwatch(group, "mauveish")).toBeNull();
  });

  it("recognises a colour axis the slug does not name, when the values do", () => {
    // `tsvet` published under a key neither spelling matches — the values say
    // what the slug does not.
    const group = hueGroup("tsvet", LIVE_CODES, LIVE_HUES);
    expect(isColorAxis({ slug: "tsvet" })).toBe(false);
    expect(isColorAxis(group)).toBe(true);
    expect(facetSwatch(group, "chernyy")).toBe("#1a1a1a");
  });

  it("refuses a bag value that is not a colour this pair would accept anywhere", () => {
    // A catalogue is a DATA source, not a stylesheet: whatever a term carries
    // goes through the same vocabulary a value code does before it can reach
    // a CSS property.
    const group = hueGroup(
      "color_ref_select",
      { a: 3, b: 2, c: 1 },
      {
        a: { hue: "url(javascript:alert(1))" },
        b: { hue: 17 },
        c: { hue: "#1a1a1a", band: "dark" },
      }
    );
    expect(termHue(group, "a")).toBeNull();
    expect(termHue(group, "b")).toBeNull();
    // The rest of the bag is the source catalogue's and is simply ignored.
    expect(termHue(group, "c")).toBe("#1a1a1a");
  });

  it("draws the dot on the rail for a value only the catalogue could explain", () => {
    mount(hueGroup("color_ref_select", LIVE_CODES, LIVE_HUES));
    const black = screen.getByTestId("facet-swatch-color_ref_select-chernyy");
    expect(black.getAttribute("data-swatch")).toBe("#1a1a1a");
    expect(black.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("facet-swatch-color_ref_select-belyy")).toBeTruthy();
    // Still nothing invented for the value nobody stated a hue for.
    expect(screen.queryByTestId("facet-swatch-color_ref_select-mauveish")).toBeNull();
    expect(screen.getByText("mauveish")).toBeTruthy();
  });
});
