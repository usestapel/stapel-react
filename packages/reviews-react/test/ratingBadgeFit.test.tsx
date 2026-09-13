/**
 * THE BADGE IS ONE LINE, AND NOTHING ON IT IS EVER CUT MID-WORD.
 *
 * ── what 0.8.1 fixed, and what it broke ───────────────────────────────────
 *
 * Measured on the live storefront with a headless probe at 390 and 320 CSS px
 * (2026-09-13, `/c/novye` and `/l/1345`):
 *
 *     .ant-rate           font-size 32px
 *     .ant-rate-star      32×44, margin-inline-end 12px
 *     five-star row       220px natural, inside a 105px card text column
 *     [data-testid=reviews-rating]   196px tall at 390, 356px tall at 320
 *
 * Nothing overflowed, because the old row was `wrap` — it folded the stars
 * into three rows at 390 and into a vertical column of five at 320. 0.8.1 made
 * the row `nowrap`, pinned the glyph to the 16px icon step, and gave the review
 * COUNT an ellipsis so the count would be what gave way.
 *
 * The owner then read the result on a tile card:
 *
 *     <seller name>  ****+  4.3 out of 5 · 6 revi…
 *
 * (The glyphs sat before the number then; the owner later ruled for the
 * reference's order, number first.)
 *
 * A word cut in the middle. That is the defect this suite pins: the count no
 * longer shrinks and no longer carries an ellipsis. The badge measures its own
 * box and drops whole FACTS in a stated order instead — the scale, then four
 * of the five stars, then the count's long form, then the count.
 *
 * ── how the widths get in ─────────────────────────────────────────────────
 *
 * jsdom lays nothing out, so `useElementWidth`'s only reading is its
 * synchronous `getBoundingClientRect()` (the setup's `ResizeObserver` is a
 * no-op). Stubbing that one call is therefore the whole of "put this badge in
 * a 120px column", and it is honest: it is the same number a browser's
 * observer would have delivered.
 *
 * The threshold arithmetic itself is asserted separately against the pure
 * ladder, so a change to the estimate fails as arithmetic rather than as a
 * puzzling render.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fontSize } from "@stapel/tokens";
import {
  RATING_FIT_LADDER,
  RATING_FIT_METRICS,
  RatingBadge,
  estimateRatingWidth,
  pickRatingFit,
} from "../src/default/index.js";
import type { RatingFitParts } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { RATED, TARGET } from "./fixtures.js";

/**
 * What the default (English) bundle puts on screen for the `RATED` fixture —
 * avg 4.25 over 12 reviews. These are the strings the ladder measures, so the
 * widths below are derived from them and not invented.
 */
const EN_PARTS: RatingFitParts = {
  score: "4.3 out of 5",
  scoreBare: "4.3",
  count: "12 reviews",
  countShort: "12 rev.",
  stars: 5,
};

/**
 * A column width that lands on each rung, widest first. Each number is just
 * above that rung's estimate and below the one above it; the test after this
 * one proves that is actually true rather than trusting the comment.
 */
const RUNGS = [
  { width: 300, step: "full" },
  { width: 240, step: "no-scale" },
  { width: 160, step: "one-star" },
  { width: 120, step: "short-count" },
  { width: 90, step: "score-only" },
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Put the badge in a column exactly `width` CSS px wide. */
function inAColumn(width: number): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height: 20,
    top: 0,
    left: 0,
    right: width,
    bottom: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

async function mountRated(width?: number): Promise<void> {
  if (width !== undefined) inAColumn(width);
  render(
    <TestProviders server={mockServer({ "/reviews/aggregate": { body: RATED } })}>
      <RatingBadge target={TARGET} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("reviews-rating-line")).toBeTruthy();
  });
}

function styleOf(testId: string): string {
  return screen.getByTestId(testId).getAttribute("style") ?? "";
}

function starCount(): number {
  return screen.getByTestId("reviews-rating-stars").querySelectorAll(
    ".ant-rate-star"
  ).length;
}

// ── the ladder, as arithmetic ───────────────────────────────────────────────

describe("the order of sacrifice", () => {
  it("is strictly descending — every rung is reachable", () => {
    const widths = RATING_FIT_LADDER.map((step) =>
      estimateRatingWidth(step, EN_PARTS)
    );
    for (let i = 1; i < widths.length; i += 1) {
      // A rung that is not narrower than the one above it can never be
      // chosen, and the ladder would silently skip it.
      expect(widths[i]).toBeLessThan(widths[i - 1] as number);
    }
  });

  it("says everything it knows while it has not been measured", () => {
    expect(pickRatingFit(undefined, EN_PARTS)).toBe("full");
  });

  it.each(RUNGS)("picks $step at $width px", ({ width, step }) => {
    expect(pickRatingFit(width, EN_PARTS)).toBe(step);
  });

  it("never gives up the number itself, however narrow the column", () => {
    for (const width of [60, 40, 10, 1]) {
      expect(pickRatingFit(width, EN_PARTS)).toBe("score-only");
    }
  });

  it("steps down sooner for a locale whose words are longer", () => {
    // Same column, same rating, longer plural. The ladder reads the ACTUAL
    // strings, so a language whose word for "reviews" is longer steps down
    // sooner on the same card and nobody maintains a second table of pixel
    // thresholds per locale.
    const long: RatingFitParts = {
      ...EN_PARTS,
      count: "12 Bewertungen insgesamt",
    };
    const narrower = estimateRatingWidth("one-star", long);
    expect(narrower).toBeGreaterThan(estimateRatingWidth("one-star", EN_PARTS));
    expect(pickRatingFit(160, long)).not.toBe("one-star");
  });

  it("measures the stars from the glyph size, not from a pixel constant", () => {
    const wide = estimateRatingWidth("no-scale", EN_PARTS, RATING_FIT_METRICS);
    const big = estimateRatingWidth("no-scale", EN_PARTS, {
      ...RATING_FIT_METRICS,
      starSize: RATING_FIT_METRICS.starSize * 2,
    });
    expect(big).toBeGreaterThan(wide);
  });
});

// ── the ladder, on screen ───────────────────────────────────────────────────

describe("the badge in a column", () => {
  it("draws the whole truth when there is room for it", async () => {
    await mountRated(300);
    expect(starCount()).toBe(5);
    expect(screen.getByTestId("reviews-rating-score").textContent).toBe(
      "4.3 out of 5"
    );
    expect(screen.getByTestId("reviews-rating-count").textContent).toBe(
      "12 reviews"
    );
  });

  it("drops the scale first — the star row already says what it is", async () => {
    await mountRated(240);
    expect(starCount()).toBe(5);
    expect(screen.getByTestId("reviews-rating-score").textContent).toBe("4.3");
    expect(screen.getByTestId("reviews-rating-count").textContent).toBe(
      "12 reviews"
    );
  });

  it("collapses five stars to one before it touches the count", async () => {
    await mountRated(160);
    expect(starCount()).toBe(1);
    expect(screen.getByTestId("reviews-rating-count").textContent).toBe(
      "12 reviews"
    );
  });

  it("abbreviates the count with a real short form, never an ellipsis", async () => {
    await mountRated(120);
    expect(starCount()).toBe(1);
    const count = screen.getByTestId("reviews-rating-count").textContent ?? "";
    expect(count).toBe("12 rev.");
    // The defect, named: a word may be abbreviated, never truncated.
    expect(count).not.toContain("…");
    expect(count).not.toContain("...");
  });

  it("drops the count outright only at the last rung", async () => {
    await mountRated(90);
    expect(starCount()).toBe(1);
    expect(screen.queryByTestId("reviews-rating-count")).toBeNull();
    expect(screen.queryByTestId("reviews-rating-dot")).toBeNull();
    expect(screen.getByTestId("reviews-rating-score").textContent).toBe("4.3");
  });

  it.each(RUNGS)(
    "never puts an ellipsis on the count at $width px",
    async ({ width }) => {
      await mountRated(width);
      const count = screen.queryByTestId("reviews-rating-count");
      if (count === null) return;
      const style = count.getAttribute("style") ?? "";
      // Both halves of the 0.8.1 mechanism are gone: the item no longer
      // shrinks below its content, and there is no ellipsis to fire if it did.
      expect(style).not.toContain("text-overflow");
      expect(style).not.toContain("flex: 0 1 auto");
      expect(style).toContain("flex: 0 0 auto");
    }
  );

  it.each(RUNGS)(
    "still speaks both numbers in full at $width px",
    async ({ width }) => {
      await mountRated(width);
      // The column got narrower; the rating did not lose a fact.
      const spoken = screen.getByTestId("reviews-rating-full").textContent ?? "";
      expect(spoken).toContain("4.3 out of 5");
      expect(spoken).toContain("12 reviews");
      // And the visible parts do not double-announce a different, shorter
      // rating — including the collapsed glyph, which would otherwise read
      // as "1 star".
      expect(
        screen.getByTestId("reviews-rating-stars").getAttribute("aria-hidden")
      ).toBe("true");
      expect(
        screen.getByTestId("reviews-rating-score").getAttribute("aria-hidden")
      ).toBe("true");
    }
  );
});

// ── the geometry 0.8.1 earned, which this release keeps ────────────────────

describe("the one-line geometry", () => {
  it("draws the stars at the scale's icon step, not at a touch pitch", async () => {
    await mountRated(300);
    // 16px, from the dictionary — against the 32px the phone touch floor was
    // giving a rating nobody can tick.
    expect(styleOf("reviews-rating-stars")).toContain(
      `font-size: ${String(fontSize.md.fontSize)}px`
    );
    expect(fontSize.md.fontSize).toBeLessThanOrEqual(16);
    expect(fontSize.md.fontSize).toBeGreaterThanOrEqual(14);
  });

  it("is ONE line — the row does not wrap", async () => {
    await mountRated(90);
    expect(styleOf("reviews-rating-line")).toContain("flex-wrap: nowrap");
  });

  it("never shrinks or wraps the stars", async () => {
    await mountRated(90);
    const stars = styleOf("reviews-rating-stars");
    expect(stars).toContain("flex: 0 0 auto");
    expect(stars).toContain("white-space: nowrap");
  });

  it("can be narrower than its content, so it cannot push a card open", async () => {
    await mountRated(120);
    for (const id of ["reviews-rating", "reviews-rating-line"]) {
      expect(styleOf(id)).toContain("min-inline-size: 0");
      expect(styleOf(id)).toContain("max-inline-size: 100%");
    }
  });

  it("reads as one sentence: score, stars, ·, count — the reference's order", async () => {
    await mountRated(300);
    const line = screen.getByTestId("reviews-rating-line");
    const order = [...line.children].map((node) =>
      node.getAttribute("data-testid")
    );
    expect(order).toEqual([
      "reviews-rating-score",
      "reviews-rating-stars",
      "reviews-rating-dot",
      "reviews-rating-count",
      "reviews-rating-full",
    ]);
  });

  it.each(RUNGS)(
    "keeps the number before the star at $width px, so nothing reorders",
    async ({ width }) => {
      await mountRated(width);
      const line = screen.getByTestId("reviews-rating-line");
      const order = [...line.children].map((node) =>
        node.getAttribute("data-testid")
      );
      // The reference writes "4.3 *", and so do we, at EVERY rung — only the
      // glyph count and the length of the words change as the column narrows.
      // A badge whose parts reorder while a card resizes is its own defect.
      expect(order.slice(0, 2)).toEqual([
        "reviews-rating-score",
        "reviews-rating-stars",
      ]);
    }
  );
});
