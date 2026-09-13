/**
 * A CARD'S PHOTOGRAPH IS NOT TORN BY THE NEXT ONE.
 *
 * Measured on the stand at 390 and at 1024, and confirmed by two independent
 * reviewers: on every multi-photo card a 14-30px vertical strip of the NEXT
 * slide was painted between the picture and the card's trailing edge — grass
 * beside a pram, a blue car beside a motorcycle — with the "1 of N" pill and
 * the heart standing on top of that strip. A feed read as a column of torn
 * images.
 *
 * The numbers, from the stand: the strip's port measured 267 CSS pixels, one
 * slide 245, the gap 8 — so the second slide began at x=253 and fourteen
 * pixels of it were inside the port.
 *
 * ── The cause is a deliberate affordance in the wrong place ────────────────
 *
 * `<SkinCarousel peek>` keeps ~8% of the container for the next slide, and its
 * own header argues the case: on a full-width phone GALLERY that sliver is the
 * only thing saying there is more, and it is what people swipe at. On a CARD
 * it is not: the card already draws dots and a "1 of N" counter, so "there is
 * more" is stated twice and only one of the two statements tears the picture.
 *
 * ── What this file asserts, and what it refuses to ─────────────────────────
 *
 * NOT "the component was passed `peek={false}`" — the value was never passed
 * at all, so a test shaped like that would have been green through the whole
 * defect. What is asserted is the GEOMETRY the browser resolves from the card
 * it rendered: the slide's declared width against the port's, and where the
 * second slide's leading edge therefore falls. jsdom lays nothing out, so the
 * arithmetic is done here on the declarations the card actually wrote — the
 * same two custom properties a browser would resolve, at the port width the
 * stand measured.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ListingCard, ListingSerpCard } from "../src/default/index.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

/** The port the stand measured, in CSS pixels. */
const PORT = 267;

const MANY: ListingCardData = {
  ...CARD,
  images: ["image/a", "image/b", "image/c"],
};

function providers(node: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{node}</TestProviders>;
}

/** A CSS length as the browser would resolve it against `port`. */
function resolve(length: string, port: number): number {
  if (length.endsWith("%")) return (port * Number(length.slice(0, -1))) / 100;
  if (length.endsWith("px")) return Number(length.slice(0, -2));
  throw new Error(`not a length this test can resolve: ${length}`);
}

interface Geometry {
  /** What ONE slide is declared to be, in a `port`-wide strip. */
  readonly slide: number;
  /** Where the SECOND slide's leading edge falls. */
  readonly secondEdge: number;
}

/**
 * The card's own declared strip geometry, resolved against a `PORT`-wide box.
 *
 * Read off the element rather than off the props: `--skin-carousel-slide` is
 * `calc(100% - var(--skin-carousel-peek))` and the gap is
 * `--skin-carousel-gap`, which together are exactly what a browser lays the
 * strip out from.
 */
function geometryOf(testId: string): Geometry {
  const strip = screen.getByTestId(testId);
  const style = strip.style;
  const peek = style.getPropertyValue("--skin-carousel-peek").trim();
  const gap = style.getPropertyValue("--skin-carousel-gap").trim();
  expect(peek, "the strip declares no peek at all").not.toBe("");
  const slide = PORT - resolve(peek, PORT);
  return { slide, secondEdge: slide + resolve(gap, PORT) };
}

describe("the grid card's photo strip fills its own port", () => {
  it("gives one slide the WHOLE width, and starts the next one outside it", () => {
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const { slide, secondEdge } = geometryOf("listings-card-photos");
    // The defect, in one number: 245 of a 267 port left 22 pixels of the next
    // photograph inside it.
    expect(slide).toBe(PORT);
    // …and therefore nothing of the second photograph is on screen: its
    // leading edge is at the port's trailing edge or past it.
    expect(secondEdge).toBeGreaterThanOrEqual(PORT);
  });

  it("still says there is more — the counter and the dots are untouched", () => {
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    // The sliver was one of two statements of the same fact. This is the one
    // that survives, and it is the one that does not tear the picture.
    expect(screen.getByTestId("listings-card-photos-counter").textContent).toBe(
      "1 of 3"
    );
    expect(
      screen.getByTestId("listings-card-photos").querySelectorAll("[aria-hidden]")
        .length
    ).toBeGreaterThan(0);
  });
});

describe("the phone result row's strip fills its own port too", () => {
  it("gives one slide the WHOLE width", () => {
    render(providers(<ListingSerpCard listing={MANY} href="/l/7" />));
    const { slide, secondEdge } = geometryOf("listings-serp-photos");
    expect(slide).toBe(PORT);
    expect(secondEdge).toBeGreaterThanOrEqual(PORT);
  });
});

describe("a one-photo card is unchanged", () => {
  it("has nothing to peek at and says nothing about it", () => {
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    expect(geometryOf("listings-card-photos").slide).toBe(PORT);
    // No counter and no dots for a set of one — the rule the strip already
    // followed, and the reason taking the peek away loses nothing here.
    expect(screen.queryByTestId("listings-card-photos-counter")).toBeNull();
  });
});
