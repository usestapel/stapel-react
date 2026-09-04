/**
 * `<FilterChips mode="applied">` — the row that states what a search is
 * narrowed to, beside the control that widens it again.
 *
 * The defect it closes, measured on a storefront: with the rail on screen,
 * picking two values left NOTHING between the page header and the first card,
 * and dropping one of the two meant scrolling a 2377px column until its button
 * came back. The pair's own row was the wrong instrument there — it is a row
 * of OPENERS, one chip per axis applied or not, so beside an open rail it
 * printed the panel twice and removed nothing without a modal.
 *
 * What is asserted here is the shape a host cannot fix from outside: one chip
 * per VALUE (not per axis), a caption naming the axis AND the value, a real
 * button whose press drops exactly that constraint, the label path carried on
 * the markup, and an empty row that is not drawn at all.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  FilterChips,
  SearchPage,
  buildAppliedChips,
  rangeChipText,
  rangeLabelSource,
} from "../src/default/index.js";
import { buildRangeGroups, parseSearchState } from "../src/index.js";
import type { RangeGroup, SearchParamsAdapter } from "../src/index.js";
import { FEATURES, PHONE_RANGE_FEATURES, searchResponse } from "./fixtures.js";
import type { MockServer } from "./harness.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestHarness,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

afterEach(cleanup);

const OPTIONS = { defaultType: "listing" } as const;

/** The row on its own, over the shipped answer (brand + condition + price). */
function mount(initialSearch: string): { search: string; server: MockServer } {
  const seen = { search: "", server: mockServer({ "/query": { body: searchResponse() } }) };
  render(
    <TestHarness
      server={seen.server}
      initialSearch={initialSearch}
      onAdapter={(adapter) => {
        seen.search = adapter.search;
      }}
    >
      <FilterChips mode="applied" categoryFeatures={FEATURES} />
    </TestHarness>
  );
  return seen;
}

function rangeOf(search: string, slug: string): RangeGroup {
  const state = parseSearchState(new URLSearchParams(search), OPTIONS).state;
  const group = buildRangeGroups({
    state,
    categoryFeatures: PHONE_RANGE_FEATURES,
    coreRanges: ["price"],
  }).find((candidate) => candidate.slug === slug);
  if (group === undefined) throw new Error(`no range ${slug}`);
  return group;
}

describe("the applied row draws one chip per constraint, or nothing at all", () => {
  it("draws nothing when nothing is applied", async () => {
    const seen = mount("type=listing");
    // The answer has to have LANDED before absence means anything — the row
    // waits for it before naming a slug (see the component's note).
    await waitFor(() => {
      expect(seen.server.calls.length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId("search-applied-chips")).toBeNull();
  });

  it("draws one chip per VALUE, not one per axis", async () => {
    mount("type=listing&f.brand=bosch&f.brand=makita");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-brand-bosch")).toBeTruthy();
    });
    // Two brands chosen is two chips and two removals. A row that collapsed
    // them would drop both filters with one press.
    expect(screen.getByTestId("search-applied-chip-brand-makita")).toBeTruthy();
  });

  it("names the axis AND the value on every chip", async () => {
    mount("type=listing&f.condition=used&r.price=100..500");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-condition-used")).toBeTruthy();
    });
    // `facet_labels` names the VALUE (server), the schema names the axis.
    const condition = screen.getByTestId("search-applied-chip-condition-used");
    expect(condition.textContent).toContain("test.feature.condition");
    expect(condition.textContent).toContain("Б/у");
    // Both bounds in one phrase, and the axis in front of them.
    const price = screen.getByTestId("search-applied-chip-range-price");
    expect(price.textContent).toContain("Price");
    expect(price.textContent).toContain("100");
    expect(price.textContent).toContain("500");
  });

  it("is a keyboard control that says what pressing it does", async () => {
    mount("type=listing&f.brand=bosch");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-brand-bosch")).toBeTruthy();
    });
    const chip = screen.getByTestId("search-applied-chip-brand-bosch");
    // A real `<button>`, so Tab reaches it — not an antd `Tag closable`, whose
    // close icon is a `<span>` a keyboard cannot land on.
    expect(chip.tagName).toBe("BUTTON");
    // The caption states the constraint; only the accessible name states that
    // the press REMOVES it.
    const name = chip.getAttribute("aria-label") ?? "";
    expect(name).toContain("Remove filter");
    expect(name).toContain("test.brand.bosch");
  });
});

describe("a chip removes exactly its own constraint", () => {
  it("removes one VALUE and leaves the other on the same axis", async () => {
    const seen = mount("type=listing&f.brand=bosch&f.brand=makita");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-brand-bosch")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-applied-chip-brand-bosch"));
    await waitFor(() => {
      expect(new URLSearchParams(seen.search).getAll("f.brand")).toEqual([
        "makita",
      ]);
    });
  });

  it("removes a numeric BOUND and touches no facet", async () => {
    const seen = mount("type=listing&f.brand=bosch&r.price=100..500");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-range-price")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-applied-chip-range-price"));
    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("r.price")).toBeNull();
    });
    expect(new URLSearchParams(seen.search).getAll("f.brand")).toEqual(["bosch"]);
  });

  it("carries the rail's own clear-all beside the chips", async () => {
    const seen = mount("type=listing&f.brand=bosch&r.price=100..500");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chips-clear")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-applied-chips-clear"));
    await waitFor(() => {
      const params = new URLSearchParams(seen.search);
      expect(params.getAll("f.brand")).toEqual([]);
      expect(params.get("r.price")).toBeNull();
    });
  });
});

describe("both halves of a caption carry the source that named them", () => {
  it("marks a server-named value over a schema-named axis", async () => {
    mount("type=listing&f.condition=used");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-condition-used")).toBeTruthy();
    });
    const chip = screen.getByTestId("search-applied-chip-condition-used");
    expect(chip.getAttribute("data-label-source")).toBe("schema");
    expect(chip.getAttribute("data-value-label-source")).toBe("server");
  });

  it("marks a core range as the SERVER's axis — `facet_meta.core_ranges`", async () => {
    mount("type=listing&r.price=100..500");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-range-price")).toBeTruthy();
    });
    expect(
      screen
        .getByTestId("search-applied-chip-range-price")
        .getAttribute("data-label-source")
    ).toBe("server");
  });

  it("marks a slug NOBODY named as `none` rather than passing it off", async () => {
    // A filtered slug the plan dropped and the schema does not define: the row
    // still draws it (a constraint keeps its control) and says out loud that
    // the words on it are a raw index term.
    mount("type=listing&f.mystery=zzz");
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chip-mystery-zzz")).toBeTruthy();
    });
    const chip = screen.getByTestId("search-applied-chip-mystery-zzz");
    expect(chip.getAttribute("data-label-source")).toBe("none");
    expect(chip.getAttribute("data-value-label-source")).toBe("none");
  });
});

describe("the openers mode is untouched", () => {
  it("defaults to the opener row — one chip per axis, applied or not", async () => {
    render(
      <TestHarness
        server={mockServer({ "/query": { body: searchResponse() } })}
        initialSearch="type=listing&f.brand=bosch"
      >
        <FilterChips
          categoryFeatures={FEATURES}
          onOpenAll={() => {
            /* the page owns the sheet */
          }}
        />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy();
    });
    // The opener for the axis, not a removal for the value.
    expect(screen.getByTestId("search-chip-brand")).toBeTruthy();
    expect(screen.queryByTestId("search-applied-chips")).toBeNull();
  });
});

describe("the phrases and the sources, without a render", () => {
  it("states a lower bound, an upper bound and a span", () => {
    const t = (key: string, params: Record<string, unknown> = {}): string =>
      `${key}:${JSON.stringify(params)}`;
    const from = rangeChipText(rangeOf("type=listing&r.akb=80..", "akb"), t);
    const to = rangeChipText(rangeOf("type=listing&r.akb=..90", "akb"), t);
    const span = rangeChipText(rangeOf("type=listing&r.akb=80..90", "akb"), t);
    expect(from).toContain("chip_range_from");
    expect(from).toContain("80");
    expect(to).toContain("chip_range_to");
    expect(to).toContain("90");
    expect(span).toContain("chip_range_between");
  });

  it("names a range axis by the same three sources the groups use", () => {
    expect(rangeLabelSource(rangeOf("type=listing&r.price=1..2", "price"))).toBe(
      "server"
    );
    expect(rangeLabelSource(rangeOf("type=listing&r.akb=1..2", "akb"))).toBe(
      "schema"
    );
    expect(
      rangeLabelSource(rangeOf("type=listing&r.nobody=1..2", "nobody"))
    ).toBe("none");
  });

  it("builds nothing out of an unapplied search", () => {
    const ranges = buildRangeGroups({
      state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
      categoryFeatures: PHONE_RANGE_FEATURES,
      coreRanges: ["price"],
    });
    expect(
      buildAppliedChips({ groups: [], ranges, t: (key: string) => key })
    ).toEqual([]);
  });
});

/** `<SearchPage>` with the one prop a host sets to mount the row. */
function mountPage(props: {
  readonly appliedChips?: boolean | "desktop";
  readonly width?: number;
}): void {
  setViewport(props.width ?? DESKTOP_WIDTH);
  function Page(): ReactElement {
    const adapter: SearchParamsAdapter = useTestParams(
      "type=listing&f.brand=bosch"
    );
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        categoryFeatures={FEATURES}
        {...(props.appliedChips !== undefined
          ? { appliedChips: props.appliedChips }
          : {})}
      />
    );
  }
  render(
    <TestProviders
      server={mockServer({
        "/query": { body: searchResponse() },
        "/suggest": { body: { items: [], backend: "postgres" } },
      })}
    >
      <Page />
    </TestProviders>
  );
}

describe("a host mounts the row with one prop", () => {
  it("draws nothing extra when the prop is absent", async () => {
    mountPage({});
    await waitFor(() => {
      expect(screen.getByTestId("search-page")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-applied-chips")).toBeNull();
  });

  it("`\"desktop\"` draws it beside the rail and not under the phone row", async () => {
    mountPage({ appliedChips: "desktop" });
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chips")).toBeTruthy();
    });
    cleanup();
    // On the phone the opener row below already states every applied filter on
    // its own chip, so a second row would say the same thing twice.
    mountPage({ appliedChips: "desktop", width: PHONE_WIDTH });
    await waitFor(() => {
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-applied-chips")).toBeNull();
  });

  it("`true` draws it in both layouts", async () => {
    mountPage({ appliedChips: true, width: PHONE_WIDTH });
    await waitFor(() => {
      expect(screen.getByTestId("search-applied-chips")).toBeTruthy();
    });
  });
});
