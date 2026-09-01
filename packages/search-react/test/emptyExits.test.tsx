/**
 * The way out of a search that found nothing.
 *
 * Measured on a live board with 2924 empty leaves out of 2924: the SERP for a
 * men's-clothing leaf said "0 listings / nothing matches this search"
 * under fifteen filter chips, six of them parcel logistics, and
 * offered no way up, no siblings, no wider radius and no way to drop the
 * constraint that caused it. The sentence was the terminal state of the whole
 * catalogue.
 *
 * Every exit asserted here is derived from state the pair already owns, and
 * each one removes exactly ONE constraint — the assertions are on the URL
 * after the tap, because "the button exists" is not the behaviour.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SearchResultsPane, parentCategory } from "../src/default/index.js";
import { PHONE_RANGE_FEATURES, searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

const EMPTY = searchResponse({
  items: [],
  count: 0,
  has_next: false,
  next_anchor: null,
});

function mount(initialSearch: string) {
  const seen: { search: string } = { search: "" };
  render(
    <TestHarness
      server={mockServer({ "/query": { body: EMPTY } })}
      initialSearch={initialSearch}
      onAdapter={(adapter) => {
        seen.search = adapter.search;
      }}
    >
      <SearchResultsPane categoryFeatures={PHONE_RANGE_FEATURES} />
    </TestHarness>
  );
  return seen;
}

describe("an empty result offers the exits it can derive", () => {
  it("goes up a level by dropping the last segment of the path", async () => {
    const seen = mount("type=listing&category=140/145/48/1142");
    await waitFor(() => {
      expect(screen.getByTestId("search-empty-exit-up")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-empty-exit-up"));
    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("category")).toBe("140/145/48");
    });
  });

  it("offers no way up from a root category — there is nowhere to go", async () => {
    mount("type=listing&category=140");
    await waitFor(() => {
      expect(screen.getByTestId("search-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-empty-exit-up")).toBeNull();
    expect(parentCategory("140")).toBeUndefined();
    expect(parentCategory(undefined)).toBeUndefined();
    expect(parentCategory("140/145")).toBe("140");
  });

  it("widens the radius the page applied on its own", async () => {
    // The 25 km default nobody typed: on this board the same category
    // answered 2 from the API and "nothing matches" on screen, with not a
    // word about the radius anywhere on the page.
    const seen = mount("type=listing&lat=55.75&lon=37.61&radius_km=25");
    await waitFor(() => {
      expect(screen.getByTestId("search-empty-exit-widen")).toBeTruthy();
    });
    expect(screen.getByTestId("search-empty-exit-widen").textContent).toContain("100");
    fireEvent.click(screen.getByTestId("search-empty-exit-widen"));
    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("radius_km")).toBe("100");
    });
  });

  it("drops the location entirely", async () => {
    const seen = mount("type=listing&lat=55.75&lon=37.61&radius_km=25");
    await waitFor(() => {
      expect(screen.getByTestId("search-empty-exit-anywhere")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("search-empty-exit-anywhere"));
    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("lat")).toBeNull();
    });
  });

  it("drops one applied filter, named the way its own chip names it", async () => {
    const seen = mount("type=listing&f.condition=b-u&r.weight_for_delivery=1..5");
    await waitFor(() => {
      expect(screen.getByTestId("search-empty-exit-filter:condition")).toBeTruthy();
    });
    expect(
      screen.getByTestId("search-empty-exit-range:weight_for_delivery")
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId("search-empty-exit-filter:condition"));
    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("f.condition")).toBeNull();
    });
    // The OTHER constraint survives: one exit removes one thing.
    expect(new URLSearchParams(seen.search).get("r.weight_for_delivery")).toBe("1..5");
  });

  it("says nothing at all when there is nothing to widen", async () => {
    // A bare search that finds nothing has no exit to offer, and a row of
    // buttons that change nothing is worse than the sentence alone.
    mount("type=listing");
    await waitFor(() => {
      expect(screen.getByTestId("search-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-empty-exits")).toBeNull();
  });

  it("renders the host's siblings above the derived exits", async () => {
    // Sibling sections WITH their counts is the exit a buyer most wants, and
    // the one this package must not build: the tree belongs to
    // categories-react. So it is a slot.
    render(
      <TestHarness
        server={mockServer({ "/query": { body: EMPTY } })}
        initialSearch="type=listing&category=140/145"
      >
        <SearchResultsPane
          renderEmptyExits={() => <div data-testid="host-siblings">Брюки 12</div>}
        />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-siblings")).toBeTruthy();
    });
    expect(screen.getByTestId("search-empty-exit-up")).toBeTruthy();
  });

  it("is not rendered over a result set that has results", async () => {
    render(
      <TestHarness
        server={mockServer({ "/query": { body: searchResponse() } })}
        initialSearch="type=listing&category=140/145"
      >
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-empty-exits")).toBeNull();
  });
});
