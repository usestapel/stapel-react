/**
 * THE BADGE IS ONE LINE, AND THE STARS ARE NOT WHAT GIVES WAY.
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
 * into three rows at 390 and into a vertical column of five at 320, and the
 * score and the count each took a line under them. A rating that is 16 lines
 * tall on a feed card is the defect the owner reported: the stars are huge on
 * the phone and do not fit their container.
 *
 * jsdom lays nothing out, so this suite asserts the DECLARATIONS that decide
 * the geometry — the glyph size, which items may shrink, and which one carries
 * the ellipsis. The pixels are the stand's to confirm.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fontSize } from "@stapel/tokens";
import { RatingBadge } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { RATED, TARGET } from "./fixtures.js";

/** The two widths the owner's phones are: the reference 390, and the narrowest
 * screen still in the field. jsdom does not lay out, so the width is set for
 * the skin's own phone rule and the assertions stay declarative. */
const PHONE_WIDTHS = [320, 390] as const;

function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

async function mountRated(width: number): Promise<void> {
  setViewport(width);
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

describe.each(PHONE_WIDTHS)("the rating badge at %ipx", (width) => {
  it("draws the stars at the scale's icon step, not at a touch pitch", async () => {
    await mountRated(width);
    // 16px, from the dictionary — against the 32px the phone touch floor was
    // giving a rating nobody can tick.
    expect(styleOf("reviews-rating-stars")).toContain(
      `font-size: ${String(fontSize.md.fontSize)}px`
    );
    expect(fontSize.md.fontSize).toBeLessThanOrEqual(16);
    expect(fontSize.md.fontSize).toBeGreaterThanOrEqual(14);
  });

  it("is ONE line — the row does not wrap", async () => {
    await mountRated(width);
    expect(styleOf("reviews-rating-line")).toContain("flex-wrap: nowrap");
  });

  it("never shrinks or wraps the stars", async () => {
    await mountRated(width);
    const stars = styleOf("reviews-rating-stars");
    expect(stars).toContain("flex: 0 0 auto");
    expect(stars).toContain("white-space: nowrap");
  });

  it("keeps the score whole and truncates the review COUNT first", async () => {
    await mountRated(width);
    expect(styleOf("reviews-rating-score")).toContain("flex: 0 0 auto");
    const count = styleOf("reviews-rating-count");
    expect(count).toContain("flex: 0 1 auto");
    expect(count).toContain("text-overflow: ellipsis");
    expect(count).toContain("overflow: hidden");
    // Without this the ellipsis can never fire: a flex item's default
    // `min-width: auto` refuses to shrink below its content, which is how a
    // 220px star row left a 105px column in the first place.
    expect(count).toContain("min-inline-size: 0");
  });

  it("can be narrower than its content, so it cannot push a card open", async () => {
    await mountRated(width);
    for (const id of ["reviews-rating", "reviews-rating-line"]) {
      expect(styleOf(id)).toContain("min-inline-size: 0");
      expect(styleOf(id)).toContain("max-inline-size: 100%");
    }
  });

  it("reads as one sentence: stars, score, ·, count — the dot for the eye only", async () => {
    await mountRated(width);
    const line = screen.getByTestId("reviews-rating-line");
    const order = [...line.children].map((node) =>
      node.getAttribute("data-testid")
    );
    expect(order).toEqual([
      "reviews-rating-stars",
      "reviews-rating-score",
      "reviews-rating-dot",
      "reviews-rating-count",
    ]);
    expect(
      screen.getByTestId("reviews-rating-dot").getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("still says both numbers — the fit changed, the facts did not", async () => {
    await mountRated(width);
    expect(screen.getByTestId("reviews-rating-score").textContent).toContain("4");
    expect(screen.getByTestId("reviews-rating-count").textContent).toContain("12");
  });
});
