/**
 * WHERE THE FILTER RAIL TAKES OVER FROM THE SHEET.
 *
 * The page had one answer and it was not a prop: `useDialogSurface()`, i.e.
 * the token `tablet` edge (768px), because that is where a dialog stops being
 * a bottom sheet. For a DIALOG that is the right rule. For this layout it is
 * often the wrong number — at 768 the 280px rail leaves the results a 470px
 * column, one card wide, which is worse than the sheet it replaced — and a
 * host had no way to say so: `filtersLayout` pinned the surface at every width
 * and its own doc called itself a test override.
 *
 * `railFrom` is that number, read live off the viewport. This suite walks the
 * three widths the threshold is made of: below it (768 with `railFrom={1024}`
 * — the width that used to draw the rail), one pixel under it (1023), and at
 * it (1024).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { SearchPage } from "../src/default/index.js";
import type { SearchFiltersLayout } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  PHONE_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

afterEach(() => {
  cleanup();
  setViewport(1024);
});

function server() {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: { brand: { bosch: 12 } },
        facet_meta: {
          approximate: false,
          candidates: 2,
          counted: ["brand"],
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

function Page(props: {
  readonly railFrom?: number;
  readonly filtersLayout?: SearchFiltersLayout;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      {...(props.railFrom !== undefined ? { railFrom: props.railFrom } : {})}
      {...(props.filtersLayout !== undefined
        ? { filtersLayout: props.filtersLayout }
        : {})}
    />
  );
}

/** The surface the page actually drew, off the rendered markup. */
async function drawnLayout(): Promise<string | null> {
  await waitFor(() => {
    expect(screen.getByTestId("search-page").getAttribute("data-filters")).toBe(
      "on"
    );
  });
  return screen.getByTestId("search-page").getAttribute("data-filters-layout");
}

describe("<SearchPage railFrom> — the rail's own threshold", () => {
  it("draws the sheet at 768, the width the token edge used to hand the rail", async () => {
    // 768 IS the tablet breakpoint, so `useDialogSurface()` says "modal" here
    // and the page drew the 280px rail beside a 470px result column. With a
    // threshold of its own the page says sheet, which is the whole ask.
    setViewport(768);
    render(
      <TestProviders server={server()}>
        <Page railFrom={1024} />
      </TestProviders>
    );
    expect(await drawnLayout()).toBe("sheet");
    // …and the filters are behind the opener, not laid out beside the results.
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-open")).toBeTruthy();
    });
  });

  it("still draws the sheet one pixel under the threshold", async () => {
    setViewport(1023);
    render(
      <TestProviders server={server()}>
        <Page railFrom={1024} />
      </TestProviders>
    );
    expect(await drawnLayout()).toBe("sheet");
  });

  it("draws the rail AT the threshold — `min-width`, inclusive", async () => {
    setViewport(1024);
    render(
      <TestProviders server={server()}>
        <Page railFrom={1024} />
      </TestProviders>
    );
    expect(await drawnLayout()).toBe("column");
    // The rail is the panel itself, laid out beside the results rather than
    // behind a button.
    expect(screen.getByTestId("search-facets")).toBeTruthy();
    expect(screen.queryByTestId("search-filters-open")).toBeNull();
  });

  it("leaves the token edge in charge when no threshold is given", async () => {
    setViewport(768);
    render(
      <TestProviders server={server()}>
        <Page />
      </TestProviders>
    );
    // Unchanged default: one rule, `useDialogSurface`'s, and no third opinion
    // about where a phone ends.
    expect(await drawnLayout()).toBe("column");
  });

  it("is overridden by `filtersLayout`, which pins the surface", async () => {
    // A page inside a phone-width container that is not the viewport: the
    // viewport answers the wrong question at any threshold, so the pinned
    // answer has to win over the measured one.
    setViewport(1440);
    render(
      <TestProviders server={server()}>
        <Page railFrom={1024} filtersLayout="sheet" />
      </TestProviders>
    );
    expect(await drawnLayout()).toBe("sheet");
  });

  it("keeps the sheet on a phone whatever the threshold says", async () => {
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={server()}>
        <Page railFrom={1024} />
      </TestProviders>
    );
    expect(await drawnLayout()).toBe("sheet");
  });
});
