/**
 * `f.make=toyota` — the SHORT key, end to end through the surfaces.
 *
 * The address is what a person reads and shares, and `f.make_ref_select` says
 * "make" once and "how the importer typed the column" once. stapel-search
 * 0.14.4 states the readable half per group (`facet_labels[slug].url_key`,
 * derived inside the queried category's scope) and accepts both forms; this
 * pair writes the short one and reads either.
 *
 * Driven through the real panel over the real live answer (`liveCars.ts`,
 * captured 2026-09-04 with its `url_key`s), never through a stubbed codec: a
 * key map that only the unit test threads is a key map no click ever uses.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { FacetPanelPane, FilterChips, PopularValues } from "../src/default/index.js";
import { useFacetPanel } from "../src/index.js";
import { LIVE_CARS_FEATURES, liveCarsResponse } from "./liveCars.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

function carsServer(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": { body: liveCarsResponse() },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

/** The address as the surfaces have last written it. */
let latest = "";

function mount(node: ReactElement, initialSearch = "type=listing&category=141/151"): void {
  latest = initialSearch;
  render(
    <TestHarness
      server={carsServer()}
      initialSearch={initialSearch}
      onAdapter={(adapter) => {
        latest = adapter.search;
      }}
    >
      {node}
    </TestHarness>
  );
}

/** The first `ref_select` group of the plan, the way a feed page draws it. */
function PopularMakes(): ReactElement | null {
  const bag = useFacetPanel({ categoryFeatures: LIVE_CARS_FEATURES });
  if (bag.state.status !== "ready") return null;
  const group = bag.state.data.find((entry) => entry.slug === "make_ref_select");
  return group === undefined ? null : (
    <PopularValues
      group={group}
      onApply={(slug, value) => {
        bag.toggle(slug, value);
      }}
    />
  );
}

describe("the rail writes the short key", () => {
  it("puts `f.make` in the address when a make is chosen", async () => {
    mount(<FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} dictionaryMode="inline" />);
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-make_ref_select-toyota")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("facet-option-make_ref_select-toyota"));
    await waitFor(() => expect(latest).toContain("f.make=toyota"));
    // The slug is the feature's identity and never appears in the address.
    expect(latest).not.toContain("make_ref_select");
  });

  it("puts `f.fuel_type` there too, and leaves a suffix-less slug alone", async () => {
    mount(<FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} dictionaryMode="inline" />);
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-model-camry")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("facet-option-model-camry"));
    await waitFor(() => expect(latest).toContain("f.model=camry"));
  });
});

describe("the surfaces read the short key back", () => {
  it("marks the group selected from an incoming `f.make`", async () => {
    mount(
      <FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} dictionaryMode="inline" />,
      "type=listing&category=141/151&f.make=toyota"
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-make_ref_select-toyota")).toBeTruthy()
    );
    const box = screen
      .getByTestId("facet-option-make_ref_select-toyota")
      .closest("label")
      ?.querySelector<HTMLInputElement>("input[type='checkbox']");
    expect(box?.checked).toBe(true);
    // The full slug is the other half of "reads both".
    expect(latest).toContain("f.make=toyota");
  });

  it("marks it selected from an incoming full slug just as well", async () => {
    mount(
      <FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} dictionaryMode="inline" />,
      "type=listing&category=141/151&f.make_ref_select=toyota"
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-make_ref_select-toyota")).toBeTruthy()
    );
    expect(
      screen
        .getByTestId("facet-option-make_ref_select-toyota")
        .closest("label")
        ?.querySelector<HTMLInputElement>("input[type='checkbox']")?.checked
    ).toBe(true);
  });

  it("gives the APPLIED chip its own removing click, whichever form the link used", async () => {
    mount(
      <FilterChips mode="applied" categoryFeatures={LIVE_CARS_FEATURES} />,
      "type=listing&category=141/151&f.make=toyota"
    );
    await waitFor(() =>
      expect(screen.getByTestId("search-applied-chips")).toBeTruthy()
    );
    const chip = screen.getByTestId("search-applied-chip-make_ref_select-toyota");
    expect(chip.textContent).toContain("Toyota");
    fireEvent.click(chip);
    await waitFor(() => expect(latest).not.toContain("toyota"));
  });

  it("applies a popular value under the short key", async () => {
    mount(<PopularMakes />);
    await waitFor(() =>
      expect(screen.getByTestId("popular-value-make_ref_select-toyota")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("popular-value-make_ref_select-toyota"));
    await waitFor(() => expect(latest).toContain("f.make=toyota"));
  });
});
