/**
 * The chip row gets a category narrowing.
 *
 * There is no category facet on the server and the index has no read path for
 * one, so nothing here synthesizes counts — the row does not invent a "Phones
 * (31)" chip. What the SERP needs is a way to narrow to a CHILD category, and
 * the owner's navigation model puts levels 1-2 on tiles and every deeper level
 * behind a cascading child selector chosen as a characteristic, on the result
 * list and in the composer alike. On this surface that selector is the row's
 * leading chip: the host's `renderCategoryFilter`, in the same sheet every
 * other chip opens.
 *
 * The three properties asserted below are the ones a host can break:
 * the chip exists only where a host can actually draw the picker, it LEADS the
 * row (narrowing the category is what decides which facet chips exist at all),
 * and it opens the sheet rather than navigating somewhere.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { SearchPage, categoryLeaf } from "../src/default/index.js";
import type { CategoryFilterSlotProps } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { PHONE_FEATURES, legacySearchResponse } from "./fixtures.js";
import { TestProviders, mockServer, useTestParams } from "./harness.js";

afterEach(cleanup);

/** The host's catalogue picker — `categories-react`'s job, stood in for. */
function picker(slot: CategoryFilterSlotProps): ReactElement {
  return (
    <button
      type="button"
      data-testid="host-category-control"
      data-analytics="none"
      data-analytics-reason="test double"
      onClick={() => {
        slot.onChange("elektronika/mobilnye-telefony/apple");
      }}
    >
      {slot.value ?? "none"}
    </button>
  );
}

interface MountProps {
  readonly slot?: boolean;
  readonly initial?: string;
  readonly categoryLabel?: string;
}

function mount(props: MountProps = {}): void {
  function Page(): ReactElement {
    const adapter: SearchParamsAdapter = useTestParams(
      props.initial ?? "type=listing"
    );
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        filtersLayout="sheet"
        categoryFeatures={PHONE_FEATURES}
        {...(props.slot === false ? {} : { renderCategoryFilter: picker })}
        {...(props.categoryLabel !== undefined
          ? { categoryLabel: props.categoryLabel }
          : {})}
      />
    );
  }
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
}

describe("the category chip appears only when the host supplies the slot", () => {
  it("draws the chip when `renderCategoryFilter` is filled", async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category")).toBeTruthy();
    });
  });

  it("draws NO category chip when the host supplied no slot", async () => {
    // Not a constraint left without a control: the whole panel is one tap
    // away behind the leading circle and carries "search the whole catalogue".
    mount({ slot: false, initial: "type=listing&category=elektronika" });
    await waitFor(() => {
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-chip-category")).toBeNull();
  });

  it("still returns null for a row that would hold only its leading circle", async () => {
    // The row's own rule: one button is not a chip row. A deployment with no
    // facets, no ranges, no location AND no category slot draws nothing.
    render(
      <TestProviders
        server={mockServer({
          "/query": { body: legacySearchResponse({}) },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
      >
        <NoFilters />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-page")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-filter-chips")).toBeNull();
  });

  it("draws the row for the category chip ALONE when there is nothing else", async () => {
    // The mirror of the rule above: the leading circle plus one real chip is
    // a chip row, so the slot alone is enough to bring the row back.
    render(
      <TestProviders
        server={mockServer({
          "/query": { body: legacySearchResponse({}) },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
      >
        <OnlyCategory />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category")).toBeTruthy();
    });
  });
});

describe("the category chip leads the row", () => {
  it("comes before every facet chip, because it decides which ones exist", async () => {
    mount();
    // Wait for the ANSWER, not just the chip: the facet chips arrive with the
    // envelope and the category chip is drawn before it, so a test that waited
    // only for the leading chip would compare it against an empty row.
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-condition")).toBeTruthy();
    });
    const row = screen.getByTestId("search-filter-chips");
    const ids = [...row.querySelectorAll("[data-testid]")]
      .map((node) => node.getAttribute("data-testid"))
      .filter((id): id is string => id !== null && id.startsWith("search-chip-"));
    expect(ids[0]).toBe("search-chip-category");
    expect(ids).toContain("search-chip-condition");
    expect(ids.indexOf("search-chip-category")).toBeLessThan(
      ids.indexOf("search-chip-condition")
    );
  });
});

describe("the chip opens the same sheet the other chips use", () => {
  it("mounts the host's control in a chip sheet on tap", async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category")).toBeTruthy();
    });
    expect(screen.queryByTestId("filter-chip-sheet-category")).toBeNull();

    fireEvent.click(screen.getByTestId("search-chip-category"));
    await waitFor(() => {
      expect(screen.getByTestId("filter-chip-sheet-category")).toBeTruthy();
    });
    const sheet = within(screen.getByTestId("filter-chip-sheet-category"));
    expect(sheet.getByTestId("host-category-control")).toBeTruthy();
    // The same "Show N results" commit button every other chip sheet carries.
    expect(screen.getByTestId("filter-chip-apply-category")).toBeTruthy();
  });

  it("writes the chosen path into the URL, so the search actually narrows", async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-chip-category"));
    await waitFor(() => {
      expect(screen.getByTestId("host-category-control")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("host-category-control"));
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category").textContent).toBe("apple");
    });
  });
});

describe("the chip states the narrowing, or the filter's own name", () => {
  it("reads the filter's name while the search is not narrowed", async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category").textContent).toBe(
        "Category"
      );
    });
  });

  it("reads the host's name for the category when there is one", async () => {
    mount({
      initial: "type=listing&category=elektronika/mobilnye-telefony",
      categoryLabel: "Mobile phones",
    });
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category").textContent).toBe(
        "Mobile phones"
      );
    });
  });

  it("falls back to the path's LAST segment, never the whole stored path", async () => {
    // A chip has room for one word. The leaf is what the search is actually
    // narrowed to and it is a value the URL genuinely carries — the same line
    // the geo chip draws: print the name you have, never the storage.
    mount({ initial: "type=listing&category=elektronika/mobilnye-telefony" });
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-category").textContent).toBe(
        "mobilnye-telefony"
      );
    });
    expect(categoryLeaf("elektronika/mobilnye-telefony")).toBe(
      "mobilnye-telefony"
    );
    expect(categoryLeaf("elektronika")).toBe("elektronika");
    expect(categoryLeaf("")).toBe("");
  });
});

/** A deployment with nothing to filter by and no category slot. */
function NoFilters(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage adapter={adapter} defaultType="listing" filtersLayout="sheet" />
  );
}

/** The same deployment with the category slot filled and nothing else. */
function OnlyCategory(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      filtersLayout="sheet"
      renderCategoryFilter={picker}
    />
  );
}
