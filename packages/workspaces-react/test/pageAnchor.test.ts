import { describe, expect, it } from "vitest";
import { pageAnchor } from "../src/api/anchors.js";

/**
 * The core anchor envelope declares `next_anchor`/`prev_anchor` as the raw
 * value of the ordering field — `string | number` — while every `?anchor=`
 * parameter these routes document takes a string. One bridge, five call sites.
 */
describe("pageAnchor", () => {
  it("carries a datetime anchor through unchanged", () => {
    expect(pageAnchor("2026-09-18T10:00:00Z")).toBe("2026-09-18T10:00:00Z");
  });

  it("spells a sequence anchor as the server would read it back", () => {
    expect(pageAnchor(412)).toBe("412");
    // Zero is an anchor, not an absence.
    expect(pageAnchor(0)).toBe("0");
  });

  it("reads the end of the walk as no parameter at all", () => {
    expect(pageAnchor(null)).toBeUndefined();
    expect(pageAnchor(undefined)).toBeUndefined();
  });
});
