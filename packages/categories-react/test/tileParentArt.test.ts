/**
 * A ROW WITH NO ART OF ITS OWN INHERITS ITS PARENT'S, RATHER THAN DROPPING TO
 * A LETTER.
 *
 * Measured on a live classified (2026-09-13): a walk of sixty category pages
 * found exactly one tile drawing a monogram — a services row surfacing on the
 * transport page, whose `catalog_icon` is `""` while every sibling beside it
 * was illustrated and its own parent carried art. A monogram is the honest
 * answer for a catalogue with no pictures at all. It is the wrong answer for
 * one row inside an illustrated branch, and nothing in the pair walked up.
 *
 * The fallback is a PARAMETER rather than a lookup: a tile entry is built from
 * one row and this module has no tree to climb. A caller that threads its own
 * parent's RESOLVED icon down therefore gets a fallback that walks as far up
 * as the caller does, and a caller that passes nothing keeps the old
 * behaviour exactly.
 */
import { describe, expect, it } from "vitest";
import {
  categoryChildTileEntries,
  categoryTileEntry,
} from "../src/headless/CategoryCarousel.js";
import type { Category } from "../src/index.js";

function row(
  id: number,
  slug: string,
  catalogIcon: string,
  carouselIcon = ""
): Category {
  return {
    id,
    slug,
    name: slug,
    catalog_icon: catalogIcon,
    carousel_icon: carouselIcon,
    active: true,
    children_pks: [],
  } as unknown as Category;
}

const PARENT = row(1, "parent", "product/parent-art");
const ARTLESS = row(2, "artless", "");
const OWN_ART = row(3, "own", "product/own-art");

describe("the icon a tile entry resolves to", () => {
  it("is the row's own when it has one", () => {
    expect(categoryTileEntry(OWN_ART, "/c").icon).toBe("product/own-art");
  });

  it("is the parent's when the row has none", () => {
    expect(categoryTileEntry(ARTLESS, "/c", "product/parent-art").icon).toBe(
      "product/parent-art"
    );
  });

  it("never lets the parent override art the row actually has", () => {
    expect(categoryTileEntry(OWN_ART, "/c", "product/parent-art").icon).toBe(
      "product/own-art"
    );
  });

  it("is still null when neither has any — the monogram is right there", () => {
    // The fallback must not invent a reference. A catalogue with no art at all
    // draws letters, which is the anatomy's own honest answer.
    expect(categoryTileEntry(ARTLESS, "/c").icon).toBeNull();
    expect(categoryTileEntry(ARTLESS, "/c", "").icon).toBeNull();
    expect(categoryTileEntry(ARTLESS, "/c", null).icon).toBeNull();
  });
});

describe("a level of children", () => {
  it("hands the parent's art to the children that have none", () => {
    const entries = categoryChildTileEntries(
      [ARTLESS, OWN_ART] as never,
      "/c",
      undefined,
      PARENT
    );
    expect(entries[0]?.icon).toBe("product/parent-art");
    expect(entries[1]?.icon).toBe("product/own-art");
  });

  it("changes nothing for a caller that names no parent", () => {
    // The whole fleet's existing call sites are this one, so it is the arm
    // that must not move.
    const entries = categoryChildTileEntries([ARTLESS, OWN_ART] as never, "/c");
    expect(entries[0]?.icon).toBeNull();
    expect(entries[1]?.icon).toBe("product/own-art");
  });
});
