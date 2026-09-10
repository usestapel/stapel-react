/**
 * THE TWO KINDS OF CHILD stapel-categories 0.22.0 ADDED, and the one that was
 * always there.
 *
 * `GET /{id}/children/` no longer answers rows only. A POINTER carries the
 * TARGET's whole row plus `linked`, inserted at the `order` its operator gave
 * it among the real children; a VALUE of an expanded branch carries no row at
 * all — a name, an option code and a `{feature slug: value}` filter, whose URL
 * only the host can spell.
 *
 * Three things are asserted here, and the third is the one that matters most:
 * a level with neither kind must go through every reader UNCHANGED.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  browseChildren,
  categoryChildTileEntries,
  categoryTileEntry,
  hasChildren,
  isTransparentWrapper,
} from "../src/index.js";
import type { CategoryChild } from "../src/index.js";
import { CategoryTileGrid } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import {
  LAPTOPS,
  PHONES,
  categoryRow,
  linkedChild,
  virtualChild,
} from "./fixtures.js";

/** The target of the pointer: a real branch elsewhere in the tree, with
 * children of its own — the shape the wrapper rule would otherwise collapse. */
const RENTALS = categoryRow(
  70,
  "arenda",
  "category.rentals",
  60,
  "60",
  "71,72"
);

/** A level whose middle entry is a POINTER: two real children with the link
 * between them, exactly as `order: 1` puts it on the wire. */
const LEVEL_WITH_POINTER: readonly CategoryChild[] = [
  PHONES,
  linkedChild(RENTALS),
  LAPTOPS,
];

/** A level of an EXPANDED branch: values of `operation_type`, no rows. */
const LEVEL_OF_VALUES: readonly CategoryChild[] = [
  virtualChild("category.op.sell", "sell", { operation_type: "sell" }),
  virtualChild("category.op.rent", "rent", { operation_type: "rent" }),
];

/** Nothing to look grandchildren up by: the plain-level case. */
const NO_GRANDCHILDREN = (): undefined => undefined;

describe("a POINTER among the children", () => {
  it("keeps its place in the level rather than being appended or dropped", () => {
    const drawn = browseChildren(LEVEL_WITH_POINTER, NO_GRANDCHILDREN);
    expect(drawn).toHaveLength(3);
    expect(drawn[1]).toBe(LEVEL_WITH_POINTER[1]);
  });

  it("is never read as a one-rung wrapper, however many children its target has", () => {
    // Without the `linked` guard this is the exact shape `isTransparentWrapper`
    // fires on — a lone child that itself has children — and `browseChildren`
    // would put the TARGET's children where the operator drew its door.
    const lone = [linkedChild(RENTALS)];
    expect(isTransparentWrapper(lone)).toBe(false);
    expect(browseChildren(lone, () => [PHONES, LAPTOPS])).toBe(lone);
  });

  it("navigates to the TARGET's own slug", () => {
    const entries = categoryChildTileEntries(LEVEL_WITH_POINTER, "/c");
    expect(entries[1]).toMatchObject({ href: "/c/arenda" });
  });
});

describe("a VALUE of an expanded branch", () => {
  it("has no children for any reader to reveal", () => {
    const [sell] = LEVEL_OF_VALUES;
    expect(sell).toBeDefined();
    expect(hasChildren(sell as CategoryChild)).toBe(false);
    // A lone value is therefore not a wrapper either — it has nothing behind
    // it, so there is nothing for a splice to put in its place.
    expect(isTransparentWrapper([sell as CategoryChild])).toBe(false);
  });

  it("hands its filter pair to the host, and takes the href the host answers", () => {
    const hrefForVirtual = vi.fn(
      (filter: Readonly<Record<string, string>>) =>
        `/c/kvartiry?${new URLSearchParams(filter).toString()}`
    );
    const entries = categoryChildTileEntries(
      LEVEL_OF_VALUES,
      "/c",
      hrefForVirtual
    );

    expect(hrefForVirtual).toHaveBeenCalledTimes(2);
    expect(hrefForVirtual.mock.calls[0]?.[0]).toEqual({ operation_type: "sell" });
    expect(hrefForVirtual.mock.calls[1]?.[0]).toEqual({ operation_type: "rent" });
    expect(entries.map((entry) => entry.href)).toEqual([
      "/c/kvartiry?operation_type=sell",
      "/c/kvartiry?operation_type=rent",
    ]);
  });

  it("is dropped, loudly, when nobody said what its filter's URL is", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(categoryChildTileEntries(LEVEL_OF_VALUES, "/c")).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("draws a tile captioned with the value's own name", () => {
    // The override arm asks the server nothing, but the providers still need
    // a runtime to build.
    render(
      <TestProviders server={mockServer({})}>
        <CategoryTileGrid
          allTile={false}
          entries={categoryChildTileEntries(
            LEVEL_OF_VALUES,
            "/c",
            (filter) => `/c/kvartiry?${new URLSearchParams(filter).toString()}`
          )}
        />
      </TestProviders>
    );

    const rent = screen.getByText("category.op.rent");
    expect(rent).toBeDefined();
    expect(rent.closest("a")?.getAttribute("href")).toBe(
      "/c/kvartiry?operation_type=rent"
    );
  });
});

describe("a level with neither kind", () => {
  const PLAIN: readonly CategoryChild[] = [PHONES, LAPTOPS];

  it("comes back from browseChildren as the very same array", () => {
    expect(browseChildren(PLAIN, NO_GRANDCHILDREN)).toBe(PLAIN);
  });

  it("maps to exactly what the one-row mapping always produced", () => {
    expect(categoryChildTileEntries(PLAIN, "/c")).toEqual(
      PLAIN.map((row) => categoryTileEntry(row as never, "/c"))
    );
  });
});
