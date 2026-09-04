/**
 * The RANGE half of the filter model, and the row that draws it.
 *
 * The codec has carried `r.<slug>=from..to` since 0.1 and nothing ever drew
 * one: a marketplace shipped without a price filter because the panel only
 * knew how to draw checkboxes. Two things decide what a range row IS —
 *
 *  1. **Which slugs get one.** A facet answer enumerates discrete values; a
 *     range is not enumerable and the server never sends one. So the rows come
 *     from the CATEGORY SCHEMA's numeric features, plus every slug the URL
 *     already constrains — the same rule the facet groups follow, and the one
 *     that guarantees a shared link's constraint always has a control that
 *     removes it.
 *  2. **What the row refuses.** `100..50` is syntactically fine and
 *     semantically empty, and the backend answers zero results rather than a
 *     refusal — which reads as "there is nothing like this" instead of "you
 *     typed it backwards".
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
import type { FeatureDef } from "@stapel/attributes-react";
import { RangeFilterRow } from "../src/default/index.js";
import { buildRangeGroups, isRangeUsable, useSearchState } from "../src/index.js";
import type { SearchQueryState } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const NUMERIC: readonly FeatureDef[] = [
  { slug: "price", name: "test.feature.price", config: { type: "int", min: 0, max: 9_000_000, postfix: "RUB" } },
  { slug: "weight_kg", name: "test.feature.weight", config: { type: "float", min: 0.1 } },
  { slug: "brand", name: "test.feature.brand", config: { type: "select", options: [] } },
  // Range-capable on the wire and deliberately NOT drawn: a numeric input over
  // a Unix timestamp is worse than no control at all.
  { slug: "listed_at", name: "test.feature.listed", config: { type: "date" } },
];

function state(overrides: Partial<SearchQueryState> = {}): SearchQueryState {
  return {
    type: "listing",
    q: "",
    filters: {},
    ranges: {},
    ...overrides,
  } as SearchQueryState;
}

describe("which slugs get a range row", () => {
  it("draws one per NUMERIC feature of the category, in the schema's order", () => {
    const groups = buildRangeGroups({ state: state(), categoryFeatures: NUMERIC });
    expect(groups.map((g) => g.slug)).toEqual(["price", "weight_kg"]);
  });

  it("carries the schema's bounds, unit and step onto the row", () => {
    const [price, weight] = buildRangeGroups({
      state: state(),
      categoryFeatures: NUMERIC,
    });
    expect(price?.min).toBe(0);
    expect(price?.max).toBe(9_000_000);
    expect(price?.unit).toBe("RUB");
    // A whole-number feature gets a whole-number input.
    expect(price?.step).toBe(1);
    expect(weight?.step).toBeUndefined();
  });

  it("draws a row for a slug the URL constrains but the schema cannot explain", () => {
    const groups = buildRangeGroups({
      state: state({ ranges: { power_w: { from: "500", to: "1200" } } }),
      categoryFeatures: NUMERIC,
    });
    const power = groups.find((g) => g.slug === "power_w");
    // Labelled by its slug rather than dropped: a constraint with no control
    // is a link that narrows a search with no way to widen it again.
    expect(power?.label).toBe("power_w");
    expect(power?.active).toBe(true);
    expect(power?.from).toBe("500");
    expect(power?.to).toBe("1200");
  });

  it("keeps the URL's bounds as STRINGS — re-formatting one rewrites the link", () => {
    const groups = buildRangeGroups({
      state: state({ ranges: { price: { from: "1000.00" } } }),
      categoryFeatures: NUMERIC,
    });
    expect(groups[0]?.from).toBe("1000.00");
    expect(groups[0]?.to).toBeUndefined();
  });

  it("translates a label KEY through the host's translator", () => {
    const groups = buildRangeGroups({
      state: state(),
      categoryFeatures: NUMERIC,
      t: (key) => (key === "test.feature.price" ? "Price" : key),
    });
    expect(groups[0]?.label).toBe("Price");
  });

  it("has no rows at all without a schema and without a constraint", () => {
    expect(buildRangeGroups({ state: state() })).toEqual([]);
  });
});

describe("which ranges are worth sending", () => {
  it("refuses a backwards range", () => {
    expect(isRangeUsable({ from: "100", to: "50" })).toBe(false);
  });

  it("accepts an equal, a one-sided and an empty range", () => {
    expect(isRangeUsable({ from: "50", to: "50" })).toBe(true);
    expect(isRangeUsable({ from: "50" })).toBe(true);
    expect(isRangeUsable({ to: "50" })).toBe(true);
    expect(isRangeUsable({})).toBe(true);
  });

  it("leaves a non-numeric bound to the server, which names its own refusal", () => {
    expect(isRangeUsable({ from: "cheap", to: "50" })).toBe(true);
  });
});

/** The row itself, over the real state seam. */
function Rows(props: { features: readonly FeatureDef[] }): ReactElement {
  const { state: search, setRange } = useSearchState();
  const groups = buildRangeGroups({ state: search, categoryFeatures: props.features });
  return (
    <>
      {groups.map((group) => (
        <RangeFilterRow key={group.slug} group={group} onApply={setRange} />
      ))}
    </>
  );
}

function renderRows(initialSearch: string): { seen: { search: string } } {
  const server = mockServer({ "/query": { body: searchResponse() } });
  const seen = { search: initialSearch };
  render(
    <TestHarness
      server={server}
      initialSearch={initialSearch}
      onAdapter={(adapter) => {
        seen.search = adapter.search;
      }}
    >
      <Rows features={NUMERIC} />
    </TestHarness>
  );
  return { seen };
}

describe("the row commits on Apply, and says why when it will not", () => {
  it("writes the drafted bounds into the URL", async () => {
    const { seen } = renderRows("type=listing");
    fireEvent.change(screen.getByTestId("facet-range-price-from"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByTestId("facet-range-price-to"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByTestId("facet-range-price-apply"));

    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("r.price")).toBe("1000..5000");
    });
  });

  it("blocks a backwards range with the reason BESIDE the button, not in a hover", async () => {
    renderRows("type=listing");
    fireEvent.change(screen.getByTestId("facet-range-price-from"), {
      target: { value: "5000" },
    });
    fireEvent.change(screen.getByTestId("facet-range-price-to"), {
      target: { value: "1000" },
    });

    const gate = await waitFor(() => {
      const node = screen
        .getByTestId("facet-range-price-apply")
        .closest("[data-stapel-gated]");
      expect(node?.getAttribute("data-stapel-gated")).toBe("blocked");
      return node as HTMLElement;
    });
    // The reason is rendered text the eye can find, and the button points at
    // it — a disabled antd Button receives no pointer events, so a `title=`
    // never fires on any device and a phone has no hover to begin with.
    const reason = gate.querySelector("[data-stapel-gated-reason]");
    expect(reason?.textContent?.length).toBeGreaterThan(0);
    const button = screen.getByTestId("facet-range-price-apply");
    expect(button.getAttribute("aria-describedby")).toBe(reason?.getAttribute("id"));
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("offers a Clear only while the slug is actually constrained", async () => {
    const { seen } = renderRows("type=listing&r.price=1000..5000");
    const clear = screen.getByTestId("facet-range-price-clear");
    // The untouched row has none — nothing to widen.
    expect(screen.queryByTestId("facet-range-weight_kg-clear")).toBeNull();

    fireEvent.click(clear);
    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("r.price")).toBeNull();
    });
  });

  it("follows the URL when it moves on its own", async () => {
    renderRows("type=listing&r.price=1000..5000");
    const from = screen.getByTestId("facet-range-price-from") as HTMLInputElement;
    expect(from.value).toBe("1000");
    fireEvent.click(screen.getByTestId("facet-range-price-clear"));
    await waitFor(() => {
      expect((screen.getByTestId("facet-range-price-from") as HTMLInputElement).value).toBe(
        ""
      );
    });
  });

  it("names each field for the feature AND its unit", () => {
    renderRows("type=listing");
    const from = screen.getByTestId("facet-range-price-from");
    expect(from.getAttribute("aria-label")).toContain("RUB");
  });
});

describe("a typed bound also commits on blur, like the picker path already does", () => {
  it("writes the drafted bounds into the URL on blur, with no Apply click", async () => {
    const { seen } = renderRows("type=listing");
    fireEvent.change(screen.getByTestId("facet-range-price-from"), {
      target: { value: "1000" },
    });
    fireEvent.blur(screen.getByTestId("facet-range-price-from"));

    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("r.price")).toBe("1000..");
    });
  });

  it("does not double-commit when Enter fires and the field then blurs", async () => {
    let history: readonly string[] = [];
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness
        server={server}
        initialSearch="type=listing"
        onAdapter={(adapter) => {
          history = adapter.history;
        }}
      >
        <Rows features={NUMERIC} />
      </TestHarness>
    );
    const from = screen.getByTestId("facet-range-price-from") as HTMLInputElement;
    const to = screen.getByTestId("facet-range-price-to") as HTMLInputElement;
    fireEvent.change(from, { target: { value: "1000" } });
    fireEvent.change(to, { target: { value: "5000" } });
    fireEvent.keyDown(from, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(new URLSearchParams(history[history.length - 1]).get("r.price")).toBe(
        "1000..5000"
      );
    });
    const afterEnter = history.length;

    fireEvent.blur(from);
    fireEvent.blur(to);
    // The values Enter already sent are unchanged — blur must add nothing.
    expect(history.length).toBe(afterEnter);
  });

  it("does nothing on blur when the field's value never changed", async () => {
    let history: readonly string[] = [];
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness
        server={server}
        initialSearch="type=listing&r.price=1000..5000"
        onAdapter={(adapter) => {
          history = adapter.history;
        }}
      >
        <Rows features={NUMERIC} />
      </TestHarness>
    );
    const before = history.length;
    fireEvent.blur(screen.getByTestId("facet-range-price-from"));
    fireEvent.blur(screen.getByTestId("facet-range-price-to"));
    expect(history.length).toBe(before);
  });
});
