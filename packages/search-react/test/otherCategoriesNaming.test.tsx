/**
 * THE NAMES CAN BE LATE TOO — and a line that grows is worse than one that
 * arrives.
 *
 * `<OtherCategoriesLine>` was written to stop a block of sections from pushing
 * the results, and it did: the rows come out of the answer that drew the
 * cards. The NAMES do not. They are the host's — the pair holds `"140/145"`
 * and no catalogue — and a host whose catalogue is a read of its own answers
 * `undefined` for every path until its own request lands. A row nothing can
 * name is dropped, so the line was empty, then partly full, then full.
 *
 * Measured on a phone SERP: 0.054 CLS for the late mount, and 0.148 where the
 * names landed one at a time and the line grew from one row to two. The
 * storefront worked around it by holding the whole feature back until its
 * catalogue resolved — which is the late mount, kept.
 *
 * Two things close it, and this suite pins both: the height is reserved from
 * the frame the SECTIONS are known (not the frame the names are), and the
 * line is drawn ONCE, whole, when the host says its reads are in.
 */
import { describe, expect, it } from "vitest";
import { useState } from "react";
import type { ReactElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SearchResultsPane } from "../src/default/index.js";
import { OTHER_CATEGORIES_SLOT_MIN_HEIGHT } from "../src/default/OtherCategoriesLine.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const CARS = [
  { category: "cars", count: 12 },
  { category: "buses", count: 3 },
  { category: "motorhomes", count: 1 },
];

const NAMES: Record<string, string> = {
  cars: "Cars",
  buses: "Buses",
  motorhomes: "Motorhomes",
};

function serverWithSections(): ReturnType<typeof mockServer> {
  const response = searchResponse({
    facet_meta: { ...searchResponse().facet_meta, categories: CARS },
  });
  return mockServer({
    "/query": { body: response },
    "/suggest": { body: { backend: "postgres", categories: [] } },
  });
}

/**
 * A host whose catalogue is a read: names arrive one at a time, and it says so
 * until they are all in — exactly the shape that produced the 0.148.
 */
function NamingHost(): ReactElement {
  const [resolved, setResolved] = useState<readonly string[]>([]);
  const [pending, setPending] = useState(true);
  return (
    <>
      <button
        type="button"
        data-testid="resolve-one"
        onClick={() => {
          setResolved((current) => CARS.slice(0, current.length + 1).map((r) => r.category));
        }}
      >
        one more name
      </button>
      <button type="button" data-testid="settle" onClick={() => setPending(false)}>
        all in
      </button>
      <SearchResultsPane
        otherCategories
        categoryNamesPending={pending}
        categoryName={(category) =>
          resolved.includes(category) ? NAMES[category] : undefined
        }
      />
    </>
  );
}

function mount(node: ReactElement): void {
  render(
    <TestHarness server={serverWithSections()} initialSearch="type=listing&q=auto">
      {node}
    </TestHarness>
  );
}

function entryCount(): number {
  return screen.queryAllByTestId("search-other-category").length;
}

describe("the line is drawn ONCE, when the names are all in", () => {
  it("holds the band and prints nothing while the host is still naming", async () => {
    mount(<NamingHost />);
    // The slot is there in the same commit as the results: the sections are
    // known from the answer that drew the cards, so the height they will
    // occupy is known too, names or no names.
    const slot = await screen.findByTestId("search-other-categories");
    await screen.findByTestId("search-results");
    expect(slot.dataset["reserved"]).toBe("on");
    expect(slot.dataset["naming"]).toBe("pending");
    expect(slot.style.minBlockSize).toBe(`${String(OTHER_CATEGORIES_SLOT_MIN_HEIGHT)}px`);
    expect(entryCount()).toBe(0);
  });

  it("does not grow a row at a time as the names trickle in", async () => {
    mount(<NamingHost />);
    await screen.findByTestId("search-other-categories");

    // Three names, one at a time. This is the 0.148: each of these frames used
    // to add an entry, and on a phone the second one added a ROW.
    for (let i = 0; i < CARS.length; i += 1) {
      await act(async () => {
        fireEvent.click(screen.getByTestId("resolve-one"));
      });
      expect(entryCount()).toBe(0);
      expect(
        screen.getByTestId("search-other-categories").dataset["naming"]
      ).toBe("pending");
    }

    // …and then, in ONE commit, the whole line.
    await act(async () => {
      fireEvent.click(screen.getByTestId("settle"));
    });
    expect(entryCount()).toBe(CARS.length);
    const line = screen.getByTestId("search-other-categories");
    expect(line.dataset["naming"]).toBeUndefined();
    expect(line.textContent).toContain("Cars");
    expect(line.textContent).toContain("Motorhomes");
  });

  it("fills the band it reserved — the same height, so nothing moves", async () => {
    mount(<NamingHost />);
    const slot = await screen.findByTestId("search-other-categories");
    const reserved = slot.style.minBlockSize;
    await act(async () => {
      fireEvent.click(screen.getByTestId("resolve-one"));
      fireEvent.click(screen.getByTestId("settle"));
    });
    // The band and the line are the same element and the same floor: a slot a
    // few pixels taller than what fills it is still a shift.
    expect(screen.getByTestId("search-other-categories").style.minBlockSize).toBe(
      reserved
    );
  });

  it("reserves nothing when nothing is ever coming", async () => {
    // Sections exist, the host is NOT naming, and nothing else can name them
    // (numeric-looking paths have no slug to fall back on). A band under a
    // page that will never fill it is the hole an empty filter column was.
    const response = searchResponse({
      facet_meta: {
        ...searchResponse().facet_meta,
        categories: [{ category: "163/149", count: 4 }],
      },
    });
    render(
      <TestHarness
        server={mockServer({
          "/query": { body: response },
          "/suggest": { body: { backend: "postgres", categories: [] } },
        })}
        initialSearch="type=listing&q=auto"
      >
        <SearchResultsPane otherCategories />
      </TestHarness>
    );
    await screen.findByTestId("search-results");
    expect(screen.queryByTestId("search-other-categories")).toBeNull();
  });

  it("leaves a host that never names anything exactly as it was", async () => {
    // No `categoryNamesPending`: the server named these itself, so the line
    // draws in the same commit as the cards, with no band held for anyone.
    render(
      <TestHarness server={serverWithSections()} initialSearch="type=listing&q=auto">
        <SearchResultsPane
          otherCategories
          categoryName={(category) => NAMES[category]}
        />
      </TestHarness>
    );
    await screen.findByTestId("search-results");
    const line = screen.getByTestId("search-other-categories");
    expect(line.dataset["reserved"]).toBeUndefined();
    expect(entryCount()).toBe(CARS.length);
  });
});
