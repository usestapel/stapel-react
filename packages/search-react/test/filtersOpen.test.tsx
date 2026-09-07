/**
 * The filter sheet's open state, offered to the host.
 *
 * `<SearchPage>` kept `sheetOpen` to itself and published only
 * `defaultFiltersOpen` — an INITIAL value. A storefront that renders a
 * partition row in `filtersHeader` and NAVIGATES on a chip press therefore had
 * no way to take the sheet down on that same press: the route changed under a
 * drawer that was still standing, and the new page opened behind it.
 *
 * Two shapes close that, and a host picks whichever it needs:
 *  - the controlled pair `filtersOpen` + `onFiltersOpenChange(open, reason)`,
 *    React's usual contract — the page keeps no copy, and every open and close
 *    is a call the owner answers;
 *  - `filtersHeader` as a FUNCTION handed `{ closeFilters, open }`, for the
 *    host that wants the close and not the state.
 *
 * The uncontrolled page must be byte-identical to what it was, which is the
 * last block here.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { SearchPage } from "../src/default/index.js";
import type {
  SearchFiltersHeaderSlotProps,
  SearchFiltersOpenReason,
} from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestProviders, mockServer, useTestParams } from "./harness.js";

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

/** The sheet layout is PINNED rather than left to jsdom's viewport: this suite
 * is about the sheet and nothing else, so the shape must not be a guess. */
function SheetPage(props: {
  readonly filtersOpen?: boolean;
  readonly defaultFiltersOpen?: boolean;
  readonly onFiltersOpenChange?: (
    open: boolean,
    reason: SearchFiltersOpenReason
  ) => void;
  readonly filtersHeader?:
    | ReactNode
    | ((slot: SearchFiltersHeaderSlotProps) => ReactNode);
  readonly layout?: "column" | "sheet";
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      filtersLayout={props.layout ?? "sheet"}
      {...(props.filtersOpen !== undefined ? { filtersOpen: props.filtersOpen } : {})}
      {...(props.defaultFiltersOpen !== undefined
        ? { defaultFiltersOpen: props.defaultFiltersOpen }
        : {})}
      {...(props.onFiltersOpenChange !== undefined
        ? { onFiltersOpenChange: props.onFiltersOpenChange }
        : {})}
      {...(props.filtersHeader !== undefined
        ? { filtersHeader: props.filtersHeader }
        : {})}
    />
  );
}

const DISMISS_LABEL = "Close the filters";

/**
 * Press the dialog's OWN close control — the X in its chrome.
 *
 * Found by walking up from the sheet's body rather than by its label, because
 * three surfaces in this package name their dismiss with the same i18n key
 * (`FilterChips`, the geo sheet, this page) and a bare `getByLabelText` picks
 * up whichever of them jsdom is still holding.
 */
function dismissSheet(): void {
  let node: HTMLElement | null = screen.getByTestId("search-filters-sheet");
  while (node !== null) {
    const control = node.querySelector<HTMLElement>(
      `[aria-label="${DISMISS_LABEL}"]`
    );
    if (control !== null) {
      fireEvent.click(control);
      return;
    }
    node = node.parentElement;
  }
  throw new Error("the filters sheet drew no dismiss control");
}

async function openerReady(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId("search-filters-open")).toBeTruthy();
  });
}

describe("the sheet is controllable", () => {
  it("stays shut on filtersOpen={false} however hard the chip is pressed", async () => {
    const onChange = vi.fn();
    render(
      <TestProviders server={server()}>
        <SheetPage filtersOpen={false} onFiltersOpenChange={onChange} />
      </TestProviders>
    );
    await openerReady();
    fireEvent.click(screen.getByTestId("search-filters-open"));

    // The page ASKED and did not act: this is the whole of the controlled
    // contract, and the half a component that also keeps its own copy breaks.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true, "open");
    expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
  });

  it("is open on filtersOpen={true} without anything being pressed", async () => {
    render(
      <TestProviders server={server()}>
        <SheetPage filtersOpen onFiltersOpenChange={vi.fn()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });
    expect(screen.getByTestId("search-facets")).toBeTruthy();
  });

  it("ignores defaultFiltersOpen while controlled", async () => {
    render(
      <TestProviders server={server()}>
        <SheetPage filtersOpen={false} defaultFiltersOpen />
      </TestProviders>
    );
    await openerReady();
    expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
  });

  it("opens and closes when the owner answers", async () => {
    function Owner(): ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <SheetPage
          filtersOpen={open}
          onFiltersOpenChange={(next) => {
            setOpen(next);
          }}
        />
      );
    }
    render(
      <TestProviders server={server()}>
        <Owner />
      </TestProviders>
    );
    await openerReady();
    expect(screen.queryByTestId("search-filters-sheet")).toBeNull();

    fireEvent.click(screen.getByTestId("search-filters-open"));
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("search-filters-apply"));
    await waitFor(() => {
      expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
    });
  });
});

describe("the reason says which close it was", () => {
  it("names the opener 'open' and the footer 'apply'", async () => {
    const onChange = vi.fn();
    function Owner(): ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <SheetPage
          filtersOpen={open}
          onFiltersOpenChange={(next, reason) => {
            onChange(next, reason);
            setOpen(next);
          }}
        />
      );
    }
    render(
      <TestProviders server={server()}>
        <Owner />
      </TestProviders>
    );
    await openerReady();

    fireEvent.click(screen.getByTestId("search-filters-open"));
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });
    expect(onChange).toHaveBeenLastCalledWith(true, "open");

    // "Show N results" is a COMMIT, and a host that logs it as a dismissal
    // reports an abandonment that never happened.
    fireEvent.click(screen.getByTestId("search-filters-apply"));
    await waitFor(() => {
      expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
    });
    expect(onChange).toHaveBeenLastCalledWith(false, "apply");
  });

  it("names the dialog's own close 'dismiss'", async () => {
    const onChange = vi.fn();
    render(
      <TestProviders server={server()}>
        <SheetPage filtersOpen onFiltersOpenChange={onChange} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });
    dismissSheet();
    expect(onChange).toHaveBeenLastCalledWith(false, "dismiss");
  });

  it("names the header's own close 'consumer'", async () => {
    const onChange = vi.fn();
    render(
      <TestProviders server={server()}>
        <SheetPage
          filtersOpen
          onFiltersOpenChange={onChange}
          filtersHeader={({ closeFilters }) => (
            <button type="button" data-testid="header-close" onClick={closeFilters}>
              {"Sedans"}
            </button>
          )}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("header-close")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("header-close"));
    expect(onChange).toHaveBeenLastCalledWith(false, "consumer");
  });
});

describe("filtersHeader as a function", () => {
  it("closes the sheet from inside it, with the page still uncontrolled", async () => {
    render(
      <TestProviders server={server()}>
        <SheetPage
          defaultFiltersOpen
          filtersHeader={({ closeFilters, open }) => (
            <button
              type="button"
              data-testid="header-close"
              data-open={String(open)}
              onClick={closeFilters}
            >
              {"Sedans"}
            </button>
          )}
        />
      </TestProviders>
    );
    // The defect this closes: the press that navigates is the press that must
    // take the drawer down, and the host owns no state to do it with.
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("header-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
    });
  });

  it("tells the header whether the sheet is open around it", async () => {
    render(
      <TestProviders server={server()}>
        <SheetPage
          filtersHeader={({ open }) => (
            <span data-testid="header-open">{String(open)}</span>
          )}
        />
      </TestProviders>
    );
    // In the sheet layout the header only EXISTS inside the open sheet — the
    // panel it sits at the top of is what the dialog holds.
    await openerReady();
    expect(screen.queryByTestId("header-open")).toBeNull();
    fireEvent.click(screen.getByTestId("search-filters-open"));
    await waitFor(() => {
      expect(screen.getByTestId("header-open").textContent).toBe("true");
    });
  });

  it("says the column layout has no sheet around it", async () => {
    render(
      <TestProviders server={server()}>
        <SheetPage
          layout="column"
          filtersHeader={({ open }) => (
            <span data-testid="header-open">{String(open)}</span>
          )}
        />
      </TestProviders>
    );
    // The rail is on screen and there is nothing to close: `open` is the
    // SHEET's state, and a header that hides a control while the drawer is up
    // must not hide it on a desktop where the drawer never happens.
    await waitFor(() => {
      expect(screen.getByTestId("header-open").textContent).toBe("false");
    });
  });

  it("keeps drawing the node form in the same slot", async () => {
    render(
      <TestProviders server={server()}>
        <SheetPage
          defaultFiltersOpen
          filtersHeader={<span data-testid="header-node">{"Sedans"}</span>}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("header-node")).toBeTruthy();
    });
    expect(
      screen.getByTestId("search-filters-header").contains(
        screen.getByTestId("header-node")
      )
    ).toBe(true);
  });
});

describe("the uncontrolled page is unchanged", () => {
  it("opens on the chip and closes on the footer with no props at all", async () => {
    render(
      <TestProviders server={server()}>
        <SheetPage />
      </TestProviders>
    );
    await openerReady();
    expect(screen.queryByTestId("search-filters-sheet")).toBeNull();

    fireEvent.click(screen.getByTestId("search-filters-open"));
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("search-filters-apply"));
    await waitFor(() => {
      expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
    });
  });

  it("still opens on defaultFiltersOpen and still reports the reasons", async () => {
    const onChange = vi.fn();
    render(
      <TestProviders server={server()}>
        <SheetPage defaultFiltersOpen onFiltersOpenChange={onChange} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });
    // A watcher is not an owner: the callback fires in the uncontrolled mode
    // too, and the page still moves on its own.
    dismissSheet();
    expect(onChange).toHaveBeenLastCalledWith(false, "dismiss");
    await waitFor(() => {
      expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
    });
  });
});
