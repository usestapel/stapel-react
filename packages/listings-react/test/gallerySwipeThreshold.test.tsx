/**
 * HOW FAR A FINGER MUST TRAVEL TO CHANGE THE PHOTOGRAPH.
 *
 * The gesture layer committed on a fixed 32 CSS pixels and then MOVED ITS OWN
 * ORIGIN, so one drag committed once per 32px it covered. A one-column search
 * card on a 390px phone is a ~351px slide (the well less the carousel's 8%
 * peek), which priced a photograph at 32/351 ≈ 9% of itself — the owner read
 * it as "it feels like 10%, the middle photo flies past" — and a deliberate
 * drag across three photographs advanced three.
 *
 * The rule the owner ruled, and what each test below is about:
 *
 *  1. a slow drag advances only past {@link SWIPE_COMMIT_FRACTION} of the
 *     SLIDE's own measured width — not a pixel constant, not the viewport's;
 *  2. a short drag thrown fast still advances, above
 *     {@link SWIPE_FLICK_VELOCITY};
 *  3. NEVER more than one photograph per gesture, however long the drag;
 *  4. under the threshold the strip goes back to the photograph it was on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ListingCard } from "../src/default/index.js";
import {
  SWIPE_COMMIT_FRACTION,
  SWIPE_FLICK_VELOCITY,
  SWIPE_MIN_PX,
  swipeStep,
} from "../src/default/cardGallery.js";
import { detailGalleryCss } from "../src/default/detailGallery.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

const PHOTOS = ["image/a", "image/b", "image/c", "image/d"];
const MANY: ListingCardData = { ...CARD, images: PHOTOS };

/** The card's media well, in CSS pixels. */
const BOX = 400;
/** One slide: the well less the carousel's 8% peek. THE number every
 * threshold below is a fraction of. */
const SLIDE = 368;

/**
 * jsdom ships no `PointerEvent`, and its `Event` stamps its own `timeStamp`
 * from a clock a test cannot move. Velocity is half the rule under test, so
 * the stamp is an INPUT here: this is the smallest shape the real interface
 * has, plus a settable clock.
 */
class TestPointerEvent extends MouseEvent {
  public readonly pointerType: string;
  readonly #stamp: number | undefined;
  public constructor(
    type: string,
    init: PointerEventInit & { timeStamp?: number } = {}
  ) {
    super(type, init);
    this.pointerType = init.pointerType ?? "";
    this.#stamp = init.timeStamp;
  }
  public override get timeStamp(): number {
    return this.#stamp ?? super.timeStamp;
  }
}
(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;

const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

/** A device with no fine pointer — a phone, which is what a swipe is for. */
function touchOnly(): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
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

function rect(left: number, width: number): DOMRect {
  return {
    left,
    top: 0,
    right: left + width,
    bottom: 300,
    width,
    height: 300,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

interface Gallery {
  readonly box: HTMLElement;
  readonly scrollTo: ReturnType<typeof vi.fn>;
  readonly active: () => string | null;
}

/**
 * The card, with the geometry jsdom refuses to lay out.
 *
 * Every rectangle in jsdom is zero-width, and the whole claim of this file is
 * that the threshold is a fraction of ONE SLIDE's width — so the slides carry
 * the measurement and the well is deliberately wider than they are, exactly
 * as the peek makes it on a phone. A rule read off the well instead of the
 * slide would be 8% too generous and this file would not notice.
 */
function mountCard(): Gallery {
  render(providers(<ListingCard listing={MANY} href="/l/7" />));
  const box = screen.getByTestId("listings-card-photos-gallery");
  vi.spyOn(box, "getBoundingClientRect").mockReturnValue(rect(0, BOX));
  const strip = box.querySelector<HTMLElement>("[data-stapel-carousel-strip]");
  if (strip === null) throw new Error("no strip");
  vi.spyOn(strip, "getBoundingClientRect").mockReturnValue(rect(0, BOX));
  [...strip.children].forEach((slide, index) => {
    vi.spyOn(slide, "getBoundingClientRect").mockReturnValue(
      rect(index * SLIDE, SLIDE)
    );
  });
  const scrollTo = vi.fn();
  (strip as unknown as { scrollTo: unknown }).scrollTo = scrollTo;
  return {
    box,
    scrollTo,
    active: () => box.getAttribute("data-gallery-active"),
  };
}

/**
 * One drag, as a finger makes it: a press, N moves, a release — with the
 * clock moving, because the speed of the thing is half of what decides it.
 */
function drag(
  box: HTMLElement,
  options: {
    readonly from: number;
    readonly to: readonly number[];
    /** Milliseconds per move. */
    readonly step: number;
  }
): void {
  const fire = (type: string, x: number, t: number): void => {
    fireEvent(
      box,
      new TestPointerEvent(type, {
        clientX: x,
        clientY: 100,
        pointerType: "touch",
        bubbles: true,
        timeStamp: t,
      })
    );
  };
  let clock = 1000;
  fire("pointerdown", options.from, clock);
  for (const x of options.to) {
    clock += options.step;
    fire("pointermove", x, clock);
  }
  fire("pointerup", options.to[options.to.length - 1] ?? options.from, clock);
}

describe("the swipe threshold is a fraction of the photograph, not a pixel count", () => {
  it("declares a commit fraction and a flick speed the owner can read", () => {
    // The ruling: ~30% of the item, and a flick above ~0.5 px/ms.
    expect(SWIPE_COMMIT_FRACTION).toBeCloseTo(0.3);
    expect(SWIPE_FLICK_VELOCITY).toBeCloseTo(0.5);
  });

  it("changes nothing on a slow drag across a fifth of the photograph", () => {
    touchOnly();
    const gallery = mountCard();
    // 74px of a 368px slide — 20%, under the rule — taken slowly enough that
    // no flick could be claimed for it (0.19 px/ms).
    act(() => {
      drag(gallery.box, { from: 300, to: [226], step: 400 });
    });
    expect(gallery.active()).toBe("0");
  });

  it("advances exactly one on a slow drag past the commit fraction", () => {
    touchOnly();
    const gallery = mountCard();
    // 166px — 45% of the slide, at 0.42 px/ms, which is UNDER the flick
    // speed: this is the distance rule on its own.
    act(() => {
      drag(gallery.box, { from: 300, to: [134], step: 400 });
    });
    expect(gallery.active()).toBe("1");
  });

  it("advances one on a short drag thrown fast", () => {
    touchOnly();
    const gallery = mountCard();
    // 40px — a tenth of the slide, nowhere near the distance rule — at
    // 0.8 px/ms. A flick is a choice too.
    act(() => {
      drag(gallery.box, { from: 300, to: [260], step: 50 });
    });
    expect(gallery.active()).toBe("1");
  });

  it("never advances more than one photograph, however long the gesture", () => {
    touchOnly();
    const gallery = mountCard();
    // Three slide widths, fast. The defect: the origin travelled with each
    // commit, so this walked the strip to its last photograph in one gesture.
    act(() => {
      drag(gallery.box, {
        from: 1200,
        to: [1200 - SLIDE, 1200 - SLIDE * 2, 1200 - SLIDE * 3],
        step: 60,
      });
    });
    expect(gallery.active()).toBe("1");
  });

  it("puts the strip back on its photograph when the drag stops short", () => {
    touchOnly();
    const gallery = mountCard();
    act(() => {
      drag(gallery.box, { from: 300, to: [226], step: 400 });
    });
    // Under the threshold the gesture is refused — and refusing it means the
    // strip returns to where it was, not that it is left mid-photograph.
    expect(gallery.active()).toBe("0");
    expect(gallery.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 0 })
    );
  });
});

describe("the decision itself, with the slide's width in hand", () => {
  it("prices a photograph in the photograph's own width, not in pixels", () => {
    // The same 100px drag: a commit on a 300px slide (33%), a refusal on a
    // 600px one (17%). A pixel constant cannot tell those apart, and that is
    // the whole defect.
    expect(swipeStep(-100, 0, 300, 0)).toBe(1);
    expect(swipeStep(-100, 0, 600, 0)).toBe(0);
    expect(swipeStep(100, 0, 300, 0)).toBe(-1);
  });

  it("lets a fast one through, under the distance", () => {
    expect(swipeStep(-100, 0, 600, SWIPE_FLICK_VELOCITY)).toBe(1);
    expect(swipeStep(-100, 0, 600, SWIPE_FLICK_VELOCITY - 0.01)).toBe(0);
  });

  it("keeps the two gates a speed cannot open", () => {
    // A tap that wobbled stays a tap however fast the wobble was…
    expect(swipeStep(-(SWIPE_MIN_PX - 1), 0, 300, 9)).toBe(0);
    // …and a thumb scrolling the feed is still the page's, not the gallery's.
    expect(swipeStep(-200, 400, 300, 9)).toBe(0);
  });

  it("falls back to the pixel floor where nothing could be measured", () => {
    // `0` is a refusal to guess, not a width: a fraction of nothing is
    // nothing, and a gallery that stopped swiping on an unmeasured strip
    // would be a worse bug than the one this rule fixes.
    expect(swipeStep(-40, 0, 0, 0)).toBe(1);
  });
});

describe("the detail gallery is the browser's scroller, and every photo is a stop", () => {
  it("makes each photograph a destination a fling cannot fly past", () => {
    const css = detailGalleryCss();
    expect(css).toContain("scroll-snap-type: x mandatory");
    // Without this a single fling crosses as many photographs as its momentum
    // carries — the same "the middle photo flies past" the card gallery had,
    // spelled in CSS instead of in a handler.
    expect(css).toContain("scroll-snap-stop: always");
  });
});
