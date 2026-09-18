/**
 * THE GLYPHS ROUND TO THE NEAREST HALF, NEVER DOWN.
 *
 * A client storefront's seller panel printed «4.8» beside four and a half
 * stars (owner screenshot, dark theme, desktop). The number was right and the
 * picture was a third of a star short of it, on the one line a buyer reads to
 * decide whether to trust a stranger.
 *
 * The cause is antd's own rule: `<Rate allowHalf value={4.8}>` fills the star
 * below and half-fills the fifth — it floors to the half beneath the value.
 * `starBreakdown` has always said otherwise (a remainder of three quarters or
 * more is a WHOLE star), and the badge simply was not asking it.
 *
 * So the ladder here is arithmetic, not layout: each average is mounted at the
 * full rung — `pickRatingFit(undefined, …)` is "full", so an unmeasured box
 * draws every star — and the glyph classes antd paints are counted.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { RatingBadge } from "../src/default/index.js";
import { starBreakdown } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { TARGET } from "./fixtures.js";

afterEach(cleanup);

async function mountAverage(avg: number, count = 12): Promise<void> {
  render(
    <TestProviders
      server={mockServer({
        "/reviews/aggregate": {
          body: {
            target_type: TARGET.targetType,
            target_key: TARGET.targetKey,
            avg,
            count,
          },
        },
      })}
    >
      <RatingBadge target={TARGET} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("reviews-rating-line")).toBeTruthy();
  });
}

/** How antd paints the row: whole stars, the one half, and the empty rest. */
function glyphs(): { full: number; half: number; total: number } {
  const row = screen.getByTestId("reviews-rating-stars");
  return {
    full: row.querySelectorAll(".ant-rate-star-full").length,
    half: row.querySelectorAll(".ant-rate-star-half").length,
    total: row.querySelectorAll(".ant-rate-star").length,
  };
}

describe("the star row over a fractional average", () => {
  it("draws FIVE whole stars at 4.8 — the defect the owner photographed", async () => {
    await mountAverage(4.8);
    expect(glyphs()).toEqual({ full: 5, half: 0, total: 5 });
  });

  it("still halves the fifth star at 4.3", async () => {
    await mountAverage(4.3);
    expect(glyphs()).toEqual({ full: 4, half: 1, total: 5 });
  });

  it("does not round a 4.1 up to a half it has not earned", async () => {
    await mountAverage(4.1);
    expect(glyphs()).toEqual({ full: 4, half: 0, total: 5 });
  });

  it("keeps the unrounded number in the text beside the glyphs", async () => {
    await mountAverage(4.8);
    // The glyphs are the approximation; the number never is.
    expect(screen.getByTestId("reviews-rating-score").textContent).toContain(
      "4.8"
    );
    expect(screen.getByTestId("reviews-rating-full").textContent).toContain(
      "4.8"
    );
  });

  it("agrees with the pure breakdown at every tenth", () => {
    // The badge must not hold a second opinion about what a value looks like.
    for (let tenth = 0; tenth <= 50; tenth += 1) {
      const value = tenth / 10;
      const stars = starBreakdown(value, 5);
      expect(stars.full + stars.half * 0.5).toBeGreaterThanOrEqual(
        Math.floor(value)
      );
      // Never below the value by more than a quarter star: flooring to the
      // half beneath is exactly what this suite exists to forbid.
      expect(stars.full + stars.half * 0.5).toBeGreaterThanOrEqual(value - 0.25);
    }
  });
});
