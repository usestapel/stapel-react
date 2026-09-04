/**
 * `visibleGroups`' two defaults (census finding #2): the reference catalogue
 * inlines roughly two dozen groups in its desktop rail before anything folds;
 * this pair folded at eight everywhere. The column now defaults to 16 and the
 * phone sheet to 8 — a surface already behind one tap costs less to fold
 * again than a column sitting on screen the whole time — and both stay
 * overridable through the one prop `<FacetPanelPane>` and `<SearchPage>`
 * share.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { FacetPanelPane, SearchPage } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, TestProviders, mockServer, useTestParams } from "./harness.js";

/** Twenty groups with real evidence, so every one of them is drawable and
 * folding is decided by `visibleGroups` alone. */
const MANY_GROUP_SLUGS = Array.from({ length: 20 }, (_, i) => `axis_${i}`);

function manyGroupsServer() {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: Object.fromEntries(
          MANY_GROUP_SLUGS.map((slug) => [slug, { a: 3, b: 1 }])
        ),
        facet_meta: {
          approximate: false,
          candidates: 30,
          counted: MANY_GROUP_SLUGS,
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

function groupHeadings(): readonly string[] {
  return [
    ...document.querySelectorAll<HTMLElement>("[data-testid^='facet-group-']"),
  ].map((node) => node.getAttribute("data-testid") ?? "");
}

describe("<FacetPanelPane> visibleGroups — the column's own default", () => {
  it("draws 16 groups before folding when the host sets nothing", async () => {
    render(
      <TestHarness server={manyGroupsServer()}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-all-filters")).toBeTruthy();
    });
    expect(groupHeadings().length).toBe(16);
  });

  it("still overrides to any count the host asks for", async () => {
    render(
      <TestHarness server={manyGroupsServer()}>
        <FacetPanelPane visibleGroups={5} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-all-filters")).toBeTruthy();
    });
    expect(groupHeadings().length).toBe(5);
  });
});

function Page(props: { readonly filtersLayout: "column" | "sheet" }): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      filtersLayout={props.filtersLayout}
      // Opens the sheet from the first frame — the fold behaviour under test
      // is inside the dialog, not the tap that reveals it.
      defaultFiltersOpen
    />
  );
}

describe("<SearchPage> visibleGroups — defaulted per layout", () => {
  it("gives the desktop COLUMN 16 before folding", async () => {
    render(
      <TestProviders server={manyGroupsServer()}>
        <Page filtersLayout="column" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-all-filters")).toBeTruthy();
    });
    expect(groupHeadings().length).toBe(16);
  });

  it("gives the phone SHEET 8 before folding", async () => {
    render(
      <TestProviders server={manyGroupsServer()}>
        <Page filtersLayout="sheet" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-all-filters")).toBeTruthy();
    });
    expect(groupHeadings().length).toBe(8);
  });
});
