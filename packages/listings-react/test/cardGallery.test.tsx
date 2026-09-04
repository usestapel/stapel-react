/**
 * The card gallery: hover-scrub on a pointer, swipe on a finger.
 *
 * A card with six photographs showed one, and the other five needed a
 * navigation. The two gestures every classified has are here, and so are the
 * four things a gesture layer breaks on its way in:
 *
 *  - a scrub on a phone (a photograph that changes when nobody touched it);
 *  - a swipe that eats the page's VERTICAL scroll;
 *  - a keyboard left with no way through the strip;
 *  - a card that stops being one link.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ListingCard } from "../src/default/index.js";
import {
  SWIPE_MIN_PX,
  cardGalleryCss,
  segmentIndex,
  swipeStep,
} from "../src/default/cardGallery.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

const PHOTOS = ["image/a", "image/b", "image/c", "image/d"];
const MANY: ListingCardData = { ...CARD, images: PHOTOS };

/**
 * jsdom ships no `PointerEvent`, so testing-library falls back to a bare
 * `Event` and every `clientX`/`pointerType` in this file would arrive
 * `undefined` — a suite that passes because nothing ever happened. This is
 * the smallest shape the real interface has: a mouse event that also says
 * which kind of pointer it came from, which is exactly the two facts both
 * gestures are decided on.
 */
class TestPointerEvent extends MouseEvent {
  public readonly pointerType: string;
  public constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? "";
  }
}
(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;

const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

/** A device with a real pointer, or one without. jsdom's own stub answers
 * `matches: false` to everything, which IS the touch case. */
function pointerEnvironment(fine: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: fine && query.includes("hover: hover"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

/** The gallery box, with a measured width jsdom does not give it — every
 * rectangle in jsdom is zero, and a segment map over a zero-width box is
 * arithmetic about nothing. */
function galleryBox(width = 400): HTMLElement {
  const box = screen.getByTestId("listings-card-photos-gallery");
  vi.spyOn(box, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: width,
    bottom: 300,
    width,
    height: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return box;
}

function active(box: HTMLElement): string | null {
  return box.getAttribute("data-gallery-active");
}

describe("the segment map", () => {
  it("divides the box into N equal segments and clamps both ends", () => {
    expect(segmentIndex(0, 400, 4)).toBe(0);
    expect(segmentIndex(150, 400, 4)).toBe(1);
    expect(segmentIndex(250, 400, 4)).toBe(2);
    expect(segmentIndex(399, 400, 4)).toBe(3);
    // A pointer reported one pixel past the edge is still the last photo,
    // not a photograph that does not exist.
    expect(segmentIndex(401, 400, 4)).toBe(3);
    expect(segmentIndex(-5, 400, 4)).toBe(0);
  });

  it("answers 0 for a strip with one photo or a box with no width", () => {
    expect(segmentIndex(200, 400, 1)).toBe(0);
    expect(segmentIndex(200, 0, 4)).toBe(0);
  });
});

describe("the swipe threshold", () => {
  it("ignores a drag shorter than the threshold — that is a tap that wobbled", () => {
    expect(swipeStep(SWIPE_MIN_PX - 1, 0)).toBe(0);
    expect(swipeStep(-(SWIPE_MIN_PX - 1), 0)).toBe(0);
  });

  it("advances on a leftward drag and rewinds on a rightward one", () => {
    expect(swipeStep(-80, 4)).toBe(1);
    expect(swipeStep(80, 4)).toBe(-1);
  });

  it("declines a drag that is going DOWN the page", () => {
    // The one unacceptable outcome: a card in a feed that will not scroll.
    expect(swipeStep(-60, 200)).toBe(0);
    expect(swipeStep(-60, 60)).toBe(0);
    expect(swipeStep(0, 300)).toBe(0);
  });
});

describe("hover scrub, on a device that has a pointer", () => {
  it("shows the photo the cursor's segment names, and restores the first on leave", () => {
    pointerEnvironment(true);
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const box = galleryBox();
    fireEvent.pointerMove(box, { clientX: 250, clientY: 10, pointerType: "mouse" });
    expect(active(box)).toBe("2");
    fireEvent.pointerMove(box, { clientX: 390, clientY: 10, pointerType: "mouse" });
    expect(active(box)).toBe("3");
    // A hover is a look, not an edit: the card is the card it was drawn as.
    fireEvent.pointerLeave(box, { pointerType: "mouse" });
    expect(active(box)).toBe("0");
  });

  it("does nothing at all on a card with one photograph", () => {
    pointerEnvironment(true);
    render(providers(<ListingCard listing={{ ...CARD, images: ["image/a"] }} href="/l/7" />));
    const box = galleryBox();
    fireEvent.pointerMove(box, { clientX: 390, clientY: 10, pointerType: "mouse" });
    expect(active(box)).toBe("0");
  });
});

describe("the two gates", () => {
  it("never scrubs on a device with no fine pointer", () => {
    // `(hover: hover) and (pointer: fine)` is false: a phone reporting a
    // stray mouse move must not change the photograph under a thumb.
    pointerEnvironment(false);
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const box = galleryBox();
    fireEvent.pointerMove(box, { clientX: 390, clientY: 10, pointerType: "mouse" });
    expect(active(box)).toBe("0");
  });

  it("swipes on a finger even where the device also has a pointer", () => {
    // A touch laptop answers `hover: hover` AND delivers finger events. The
    // gates are per-GESTURE, not per-device.
    pointerEnvironment(true);
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const box = galleryBox();
    fireEvent.pointerDown(box, { clientX: 300, clientY: 100, pointerType: "touch" });
    fireEvent.pointerMove(box, { clientX: 200, clientY: 104, pointerType: "touch" });
    expect(active(box)).toBe("1");
  });
});

describe("swipe, on a finger", () => {
  it("advances one photo per threshold and rewinds the same way", () => {
    pointerEnvironment(false);
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const box = galleryBox();
    fireEvent.pointerDown(box, { clientX: 300, clientY: 100, pointerType: "touch" });
    fireEvent.pointerMove(box, { clientX: 200, clientY: 102, pointerType: "touch" });
    expect(active(box)).toBe("1");
    // The origin travels with the commit, so a long drag walks the strip.
    fireEvent.pointerMove(box, { clientX: 100, clientY: 104, pointerType: "touch" });
    expect(active(box)).toBe("2");
    fireEvent.pointerUp(box, { pointerType: "touch" });
    fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerMove(box, { clientX: 220, clientY: 100, pointerType: "touch" });
    expect(active(box)).toBe("1");
  });

  it("changes nothing on a VERTICAL drag", () => {
    pointerEnvironment(false);
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const box = galleryBox();
    fireEvent.pointerDown(box, { clientX: 200, clientY: 300, pointerType: "touch" });
    fireEvent.pointerMove(box, { clientX: 190, clientY: 120, pointerType: "touch" });
    fireEvent.pointerMove(box, { clientX: 180, clientY: 40, pointerType: "touch" });
    expect(active(box)).toBe("0");
  });

  it("ignores a move that never began with a press", () => {
    pointerEnvironment(false);
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const box = galleryBox();
    fireEvent.pointerMove(box, { clientX: 10, clientY: 100, pointerType: "touch" });
    expect(active(box)).toBe("0");
  });

  it("leaves the VERTICAL axis to the browser, in CSS, where no handler can argue", () => {
    expect(cardGalleryCss()).toContain("touch-action:pan-y");
  });
});

describe("what the gestures do not cost", () => {
  it("keeps the card ONE link with ONE accessible name", () => {
    pointerEnvironment(true);
    const { container } = render(providers(<ListingCard listing={MANY} href="/l/7" />));
    // The earlier ruling, unchanged: one tab stop, one name, every anchor
    // leading to the same listing, and the heart still outside it.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    for (const anchor of container.querySelectorAll("a[href]")) {
      expect(anchor.getAttribute("href")).toBe("/l/7");
    }
    const target = screen.getByTestId("listings-card-open");
    expect(target.contains(screen.getByTestId("listings-card-favorite"))).toBe(false);
  });

  it("leaves the strip a real, focusable scroll container for the keyboard", () => {
    pointerEnvironment(true);
    render(providers(<ListingCard listing={MANY} href="/l/7" />));
    const strip = screen
      .getByTestId("listings-card-photos")
      .querySelector("[data-stapel-carousel-strip]");
    expect(strip).not.toBeNull();
    // The gestures scroll this element; they do not replace it, which is
    // what keeps arrow keys, the reading order and the dots working.
    expect(strip?.getAttribute("tabindex")).toBe("0");
    expect(strip?.children).toHaveLength(PHOTOS.length);
  });
});
