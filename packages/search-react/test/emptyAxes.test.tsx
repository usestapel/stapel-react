/**
 * D249 — "6 of 6 groups are empty": an axis with no evidence is not a filter.
 *
 * The walker's laptops leaf (`/c/noutbuki`) drew six accordions over an
 * answer in which every bucket of every counted axis was zero and four more
 * axes had never been counted at all. Opening any of them offered checkboxes
 * that could only ever narrow one listing to none. The rule this suite pins:
 *
 *  - drawn: an axis some candidate in this answer actually carries a value
 *    for, an axis the reader has already filtered on, and any
 *    VOCABULARY-BACKED axis (whose control is a field over a dictionary the
 *    answer never enumerated — it searches with no buckets at all);
 *  - not drawn: everything else, and named in development so the plan or the
 *    schema that produced the gap has an owner.
 *
 * Everything below runs against `liveLaptops.ts`, captured from the live
 * answer rather than written to make the rule pass.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { FacetPanelPane } from "../src/default/index.js";
import {
  buildFacetGroups,
  facetGroupIsDrawable,
  facetGroupIsVocabularyBacked,
  parseSearchState,
} from "../src/index.js";
import { LIVE_LAPTOP_FEATURES, liveLaptopsResponse } from "./liveLaptops.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

afterEach(cleanup);

function laptopGroups(
  search = "type=listing&category=elektronika/noutbuki"
): ReturnType<typeof buildFacetGroups> {
  const body = liveLaptopsResponse();
  return buildFacetGroups({
    facets: body.facets,
    meta: body.facet_meta,
    facetLabels: body.facet_labels,
    state: parseSearchState(new URLSearchParams(search), OPTIONS).state,
    categoryFeatures: LIVE_LAPTOP_FEATURES,
  });
}

describe("a group with no evidence and nothing selected is not drawn", () => {
  // FIRST in the file on purpose: the warning is said once per slug per page
  // load, so a later test would find the set already spoken for.
  it("names each axis it drops, once, in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    laptopGroups().forEach(facetGroupIsDrawable);
    const said = warn.mock.calls.flat().join(" ");
    expect(said).toContain("condition");
    expect(said).toContain("ram_size_select");
    warn.mockRestore();
  });

  it("drops every dead inline axis and keeps the vocabulary ones", () => {
    const drawable = laptopGroups()
      .filter(facetGroupIsDrawable)
      .map((group) => group.slug);
    // What is left is the three axes whose values live in a dictionary this
    // leaf simply has no stock from: each draws a field with a search box
    // over hundreds of terms. The inline tables the answer zero-filled
    // (`ad_type`, `condition`, `color`, `ram_size_select`) and the ones the
    // budget skipped are gone — they were the six openable nothings.
    expect(drawable).toEqual(["vendor", "model", "screen_size"]);
  });

  it("draws each of those as the searchable FIELD, not as an empty list", () => {
    const drawable = laptopGroups().filter(facetGroupIsDrawable);
    for (const group of drawable) {
      expect(group.vocabulary).toBe("fleet-autocatalog");
      expect(facetGroupIsVocabularyBacked(group)).toBe(true);
      // No buckets at all — the dictionary is behind the field, not here.
      expect(group.options).toEqual([]);
    }
  });

  it("keeps the axis the reader has already filtered on", () => {
    // Whatever its counts say. A constraint with no control to remove it is
    // worse than a heading over nothing — and the link may spell the axis
    // either way (`f.ram_size` is the same filter as `f.ram_size_select`).
    const drawable = laptopGroups(
      "type=listing&category=elektronika/noutbuki&f.ram_size=16-gb"
    )
      .filter(facetGroupIsDrawable)
      .map((group) => group.slug);
    expect(drawable).toContain("ram_size_select");
    // Its dead inline neighbours are still gone.
    expect(drawable).not.toContain("condition");
    expect(drawable).not.toContain("color");
  });

  it("keeps a vocabulary axis the schema does NOT mark required", () => {
    // The gate asked for `mandatory` for one round, and on this leaf not one
    // of vendor/model/screen_size carries it — so the rule meant to save the
    // make picker on cars deleted the vendor picker on laptops. What makes
    // the field usable is the dictionary behind it.
    expect(
      LIVE_LAPTOP_FEATURES.find((feature) => feature.slug === "vendor")?.mandatory
    ).toBe(false);
    const vendor = laptopGroups().find((group) => group.slug === "vendor");
    expect(vendor).toBeTruthy();
    expect(vendor?.vocabulary).toBe("fleet-autocatalog");
    expect(vendor === undefined ? null : facetGroupIsVocabularyBacked(vendor)).toBe(
      true
    );
    expect(vendor === undefined ? null : facetGroupIsDrawable(vendor)).toBe(true);
  });

  it("draws three fields on the page instead of six openable nothings", async () => {
    render(
      <TestHarness
        server={mockServer({
          "/query": { body: liveLaptopsResponse() },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
        initialSearch="type=listing&category=elektronika/noutbuki"
      >
        <FacetPanelPane categoryFeatures={LIVE_LAPTOP_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getByTestId("facet-group-vendor")).toBeTruthy());
    expect(
      [...document.querySelectorAll("[data-testid^='facet-group-']")].map((node) =>
        node.getAttribute("data-testid")
      )
    ).toEqual([
      "facet-group-vendor",
      "facet-group-model",
      "facet-group-screen_size",
    ]);
    // Each one a dictionary, and none of the zero-filled inline tables.
    expect(
      screen.getByTestId("facet-group-vendor").getAttribute("data-shape")
    ).toBe("dictionary");
    expect(screen.queryByTestId("facet-group-condition")).toBeNull();
  });
});
