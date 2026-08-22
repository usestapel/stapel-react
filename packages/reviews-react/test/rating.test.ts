/**
 * The zero that is not a rating.
 *
 * `services.aggregate` returns `avg=0.0` when `count=0`, and the schema says
 * so in its own field description. Every assertion here exists to keep a
 * renderer from turning that into the worst possible score.
 */
import { describe, expect, it } from "vitest";
import { ratingSummary, starBreakdown } from "../src/index.js";
import { RATED, UNRATED } from "./fixtures.js";

describe("ratingSummary", () => {
  it("reads count 0 as NOT RATED, whatever avg says", () => {
    const summary = ratingSummary(UNRATED);
    expect(summary.rated).toBe(false);
    expect(summary.count).toBe(0);
    // There is no average of an empty set, and the type says so: a skin
    // cannot reach a number to draw here even by accident.
    expect(summary.avg).toBeUndefined();
    expect(summary.rounded).toBeUndefined();
  });

  it("still reads count 0 as not rated when the server sends a non-zero avg", () => {
    // Defensive on purpose: the pair's rule is "count decides", so a bad or
    // stale avg beside a zero count cannot resurrect a star row.
    const summary = ratingSummary({ avg: 4.9, count: 0 });
    expect(summary.rated).toBe(false);
  });

  it("reads a real aggregate, rounding for display without losing the mean", () => {
    const summary = ratingSummary(RATED);
    expect(summary.rated).toBe(true);
    if (!summary.rated) return;
    expect(summary.avg).toBe(4.25);
    expect(summary.rounded).toBe(4.3);
    expect(summary.count).toBe(12);
  });

  it("treats a missing or malformed aggregate as not rated, never as zero stars", () => {
    expect(ratingSummary(undefined).rated).toBe(false);
    expect(ratingSummary(null).rated).toBe(false);
    expect(ratingSummary({ avg: 3, count: Number.NaN }).rated).toBe(false);
    expect(ratingSummary({ avg: 3, count: -1 }).rated).toBe(false);
  });

  it("reads the composite's projection shape, because it IS the same shape", () => {
    // stapel_shop/projections.py: read("shop.listing_review_summary") answers
    // {avg, count} in both local and remote mode, deliberately using the
    // owner's field names.
    const summary = ratingSummary({ avg: 4.8, count: 137 });
    expect(summary.rated).toBe(true);
    if (!summary.rated) return;
    expect(summary.rounded).toBe(4.8);
  });
});

describe("starBreakdown", () => {
  it("draws the deployment's ceiling, not a hardcoded five", () => {
    expect(starBreakdown(7, 10)).toEqual({ full: 7, half: 0, empty: 3 });
  });

  it("puts a half star in the middle band and rounds the edges", () => {
    expect(starBreakdown(4.5, 5)).toEqual({ full: 4, half: 1, empty: 0 });
    expect(starBreakdown(4.1, 5)).toEqual({ full: 4, half: 0, empty: 1 });
    expect(starBreakdown(4.8, 5)).toEqual({ full: 5, half: 0, empty: 0 });
  });

  it("never draws more stars than the ceiling", () => {
    const breakdown = starBreakdown(99, 5);
    expect(breakdown.full + breakdown.half + breakdown.empty).toBe(5);
  });
});
