/**
 * `toolbarLead` — a host node INSIDE the results toolbar row, at its start.
 *
 * The storefront wants the "where am I searching" control as the leading item
 * of the toolbar row, left of the view switch. Nothing could put a node in
 * that row: `<SearchPage>` forwards `toolbarSticky` and `toolbarTop` and
 * nothing else about it, and each of the three existing candidates costs a
 * whole row plus a gap — about 50px of a page head the wave is trying to get
 * under 330px at 1440.
 *
 * WHY NOT THE THREE THAT ALREADY EXIST, since a slot that duplicates one is
 * worse than no slot:
 *
 *  - `<SearchPage resultsHeader>` spans BOTH columns, above the applied chips.
 *    It is a row of its own by contract, and it would stand the control over
 *    the filter rail as well as over the results;
 *  - `<SearchPage resultsLead>` (the pane's `lead`) is inside the results
 *    column, which is closer — but it is ABOVE the heading row and the
 *    toolbar, so it is still a row of its own and still costs one;
 *  - the pane's own `toolbar` cannot be forwarded from `<SearchPage>` at all,
 *    because the page BUILDS that value: the view switch, the sort select, the
 *    page size and `resultsAction`, in two different shapes for phone and
 *    desktop. A host handed that prop would be REPLACING the pair's controls,
 *    not adding to them — it would have to re-implement the row to add one
 *    item to it, and would silently lose the shape split on the way.
 *
 * And not `resultsAction` either: that is the row's TRAILING end, documented as
 * such, and this is the leading one.
 *
 * What this suite pins is PLACEMENT A PERSON SEES — the node inside the
 * toolbar row and ahead of the view switch — in both the wide layout and the
 * phone one, not that a prop reached a component.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { SearchPage, SearchResultsPane } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestHarness,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

/** The width the two-column layout (rail beside the feed) is drawn at. */
const RAIL_WIDTH = 1024;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

/** The host's own control — the thing the storefront wants in that row. */
const WHERE = <span data-testid="host-where">Everywhere</span>;

function server() {
  return mockServer({
    "/query": { body: searchResponse() },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

function Page(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      toolbarLead={WHERE}
    />
  );
}

async function mountPage(width: number): Promise<void> {
  setViewport(width);
  render(
    <TestProviders server={server()}>
      <Page />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("search-results-toolbar")).toBeTruthy();
  });
}

/** Does the toolbar ROW contain this node, and does it come first? */
function placement(): { readonly inRow: boolean; readonly beforeSwitch: boolean } {
  const row = screen.getByTestId("search-results-toolbar");
  const node = screen.getByTestId("host-where");
  const view = screen.getByTestId("search-view-switch");
  return {
    inRow: row.contains(node),
    // DOCUMENT_POSITION_FOLLOWING: the view switch comes after the host node.
    beforeSwitch: Boolean(
      node.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING
    ),
  };
}

describe("the host's node lands in the toolbar row, at its start", () => {
  it("draws it inside the row and before the view switch, beside the rail", async () => {
    await mountPage(RAIL_WIDTH);
    const { inRow, beforeSwitch } = placement();
    expect(inRow, "the node is not in the toolbar row").toBe(true);
    expect(beforeSwitch, "the view switch does not follow the node").toBe(true);
  });

  it("draws it inside the row and before the view switch on a phone", async () => {
    await mountPage(PHONE_WIDTH);
    // The phone draws the compact header, whose toolbar is its own row between
    // the heading and the count — a different arm of the pane entirely.
    expect(screen.getByTestId("search-results-header-compact")).toBeTruthy();
    const { inRow, beforeSwitch } = placement();
    expect(inRow, "the node is not in the compact toolbar row").toBe(true);
    expect(beforeSwitch, "the view switch does not follow the node").toBe(true);
  });

  it("costs no row of its own — it is not the lead block or a header", async () => {
    await mountPage(RAIL_WIDTH);
    // The two slots that would each have cost a row are untouched and empty.
    expect(screen.queryByTestId("search-results-lead")).toBeNull();
    expect(screen.queryByTestId("search-results-header")).toBeNull();
  });
});

describe("the pane takes it directly too, and keeps its own row intact", () => {
  it("puts the node ahead of the count's elastic half", () => {
    render(
      <TestHarness server={server()}>
        <SearchResultsPane toolbarLead={WHERE} toolbar={<b>controls</b>} />
      </TestHarness>
    );
    const row = screen.getByTestId("search-results-toolbar");
    const node = screen.getByTestId("host-where");
    // The count's half is the pane's own and still stands in the row, whether
    // or not a number has arrived — the reservation that stops the controls
    // travelling when it does.
    const countHalf = screen.getByTestId("search-results-toolbar-lead");
    expect(row.contains(node)).toBe(true);
    expect(
      node.compareDocumentPosition(countHalf) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("draws no box at all when the host passes nothing", () => {
    render(
      <TestHarness server={server()}>
        <SearchResultsPane toolbar={<b>controls</b>} />
      </TestHarness>
    );
    expect(screen.queryByTestId("search-toolbar-lead")).toBeNull();
    // …and the row and its own halves are exactly as before.
    expect(screen.getByTestId("search-results-toolbar")).toBeTruthy();
    expect(screen.getByTestId("search-results-toolbar-lead")).toBeTruthy();
  });
});
