// @vitest-environment jsdom
/**
 * `SkinCarousel` — the native scroll-snap strip.
 *
 * jsdom computes no layout and implements no scrolling, so the SNAP itself is
 * unobservable here: what these tests hold is the structure that produces it
 * (the classes, the hoisted rules, the custom properties the sheet reads) plus
 * the parts that are real JavaScript — the peek arithmetic, the accessibility
 * contract, and the scroll→index tracking, which is exercised against stubbed
 * rectangles because that is the one thing jsdom will let us fake honestly.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { cssVar } from "@stapel/tokens";
import {
  SKIN_CAROUSEL_CLASS,
  SKIN_CAROUSEL_DOT_CLASS,
  SKIN_CAROUSEL_PEEK,
  SKIN_CAROUSEL_SLIDE_CLASS,
  SKIN_CAROUSEL_STRIP_CLASS,
  SKIN_CAROUSEL_STYLE_HREF,
  SkinCarousel,
  skinCarouselCss,
} from "../src/skin.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LABEL = "Photos of this listing";

function slides(count: number): readonly ReactElement[] {
  return Array.from({ length: count }, (_, i) => `photo-${String(i)}`).map((id) => (
    <div key={id} data-testid={id} />
  ));
}

function root(): HTMLElement {
  return screen.getByTestId("carousel");
}

function strip(): HTMLElement {
  const found = root().querySelector<HTMLElement>(`.${SKIN_CAROUSEL_STRIP_CLASS}`);
  if (found === null) throw new Error("no strip");
  return found;
}

/**
 * Place the strip and its slides on a fake horizontal ruler: the strip's
 * leading edge at 0, slide `i` at `i * pitch - scrollLeft`. That is exactly
 * what a real scroll does to the rectangles, and it is what
 * `nearestSlideIndex` reads.
 */
function layout(pitch: number, scrollLeft: number): void {
  const el = strip();
  el.getBoundingClientRect = (() => ({ left: 0 })) as unknown as () => DOMRect;
  const items = [...el.children];
  items.forEach((item, index) => {
    item.getBoundingClientRect = (() => ({
      left: index * pitch - scrollLeft,
    })) as unknown as () => DOMRect;
  });
}

/** Fire a scroll and let the rAF the handler schedules run. */
async function scrollTo(pitch: number, scrollLeft: number): Promise<void> {
  layout(pitch, scrollLeft);
  await act(async () => {
    fireEvent.scroll(strip());
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

describe("structure — one well per child, and the region has a name", () => {
  it("wraps every child in its own snap-aligned slide", () => {
    render(
      <SkinCarousel label={LABEL} data-testid="carousel">
        {slides(3)}
      </SkinCarousel>
    );
    expect(root().className).toContain(SKIN_CAROUSEL_CLASS);
    expect(root().getAttribute("data-stapel-carousel-slides")).toBe("3");
    const wells = root().querySelectorAll(`.${SKIN_CAROUSEL_SLIDE_CLASS}`);
    expect(wells).toHaveLength(3);
    // The children are IN the document, not swapped by state — that is what
    // makes reading order, Tab and find-in-page work.
    for (let i = 0; i < 3; i += 1) expect(screen.getByTestId(`photo-${String(i)}`)).toBeTruthy();
  });

  it("names the scroller with the caller's copy and makes it a tab stop", () => {
    render(
      <SkinCarousel label={LABEL} data-testid="carousel">
        {slides(2)}
      </SkinCarousel>
    );
    const el = strip();
    // A scrollable region whose scrollbar is hidden must be reachable some
    // other way, or the strip is mouse-only.
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute("aria-label")).toBe(LABEL);
    // `role="list"` is written out (WebKit drops list semantics under
    // `list-style:none`) — and those semantics are the position announcement.
    expect(el.getAttribute("role")).toBe("list");
    expect(el.tagName).toBe("UL");
    expect([...el.children].every((child) => child.tagName === "LI")).toBe(true);
  });

  it("merges a caller className instead of replacing the component's own", () => {
    render(
      <SkinCarousel label={LABEL} className="host-rail" data-testid="carousel">
        {slides(1)}
      </SkinCarousel>
    );
    expect(root().className).toBe(`${SKIN_CAROUSEL_CLASS} host-rail`);
  });
});

describe("the hoisted stylesheet — one copy, the rules an inline style cannot state", () => {
  it("hoists exactly one sheet however many carousels are on the page", () => {
    render(
      <>
        <SkinCarousel label={LABEL} data-testid="carousel">
          {slides(2)}
        </SkinCarousel>
        <SkinCarousel label={LABEL} data-testid="second">
          {slides(2)}
        </SkinCarousel>
      </>
    );
    const sheets = [
      ...document.querySelectorAll(`style[data-href="${SKIN_CAROUSEL_STYLE_HREF}"]`),
    ];
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.textContent).toBe(skinCarouselCss());
  });

  it("states the snap contract and hides the scrollbar without hiding the content", () => {
    const css = skinCarouselCss();
    expect(css).toContain("scroll-snap-type:x mandatory");
    expect(css).toContain("scroll-snap-align:start");
    expect(css).toContain("scroll-snap-stop:always");
    expect(css).toContain("overscroll-behavior-inline:contain");
    expect(css).toContain("scrollbar-width:none");
    expect(css).toContain(`.${SKIN_CAROUSEL_STRIP_CLASS}::-webkit-scrollbar{display:none}`);
    // Hiding the bar is only safe with a focus ring on the thing that scrolls.
    expect(css).toContain(`.${SKIN_CAROUSEL_STRIP_CLASS}:focus-visible`);
    expect(css).toContain("prefers-reduced-motion:reduce");
  });

  it("carries no literal colour — every paint is a token role reference", () => {
    const css = skinCarouselCss();
    expect(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(css)).toBe(false);
    for (const name of ["dot", "dot-active", "focus"]) {
      expect(css).toContain(`var(--skin-carousel-${name})`);
    }
  });
});

describe("peek — the edge of the next slide is the affordance", () => {
  it("defaults to the proportional sliver", () => {
    render(
      <SkinCarousel label={LABEL} data-testid="carousel">
        {slides(3)}
      </SkinCarousel>
    );
    expect(root().getAttribute("data-stapel-carousel-peek")).toBe(SKIN_CAROUSEL_PEEK);
    expect(root().style.getPropertyValue("--skin-carousel-peek")).toBe(SKIN_CAROUSEL_PEEK);
    // The slide's width is stated once, in terms of the peek.
    expect(root().style.getPropertyValue("--skin-carousel-slide")).toBe(
      "calc(100% - var(--skin-carousel-peek))"
    );
  });

  it("takes a fixed length, and `false` means full-width slides", () => {
    render(
      <SkinCarousel label={LABEL} peek="48px" data-testid="carousel">
        {slides(2)}
      </SkinCarousel>
    );
    expect(root().style.getPropertyValue("--skin-carousel-peek")).toBe("48px");
    cleanup();
    render(
      <SkinCarousel label={LABEL} peek={false} data-testid="carousel">
        {slides(2)}
      </SkinCarousel>
    );
    expect(root().style.getPropertyValue("--skin-carousel-peek")).toBe("0px");
  });
});

describe("aspect ratio — a photo well does not change height as images load", () => {
  it("sets the ratio property only when the caller asked for one", () => {
    render(
      <SkinCarousel label={LABEL} aspectRatio="4 / 3" data-testid="carousel">
        {slides(2)}
      </SkinCarousel>
    );
    expect(root().style.getPropertyValue("--skin-carousel-ratio")).toBe("4 / 3");
    expect(skinCarouselCss()).toContain("aspect-ratio:var(--skin-carousel-ratio,auto)");
    cleanup();
    render(
      <SkinCarousel label={LABEL} data-testid="carousel">
        {slides(2)}
      </SkinCarousel>
    );
    // Absent, the property is unset and the rule's `auto` fallback applies —
    // a text slide is as tall as its text.
    expect(root().style.getPropertyValue("--skin-carousel-ratio")).toBe("");
  });
});

describe("dots — an indicator, deliberately not a control", () => {
  it("draws nothing by default, and nothing for a single slide", () => {
    render(
      <SkinCarousel label={LABEL} data-testid="carousel">
        {slides(4)}
      </SkinCarousel>
    );
    expect(root().querySelectorAll(`.${SKIN_CAROUSEL_DOT_CLASS}`)).toHaveLength(0);
    cleanup();
    render(
      <SkinCarousel label={LABEL} dots data-testid="carousel">
        {slides(1)}
      </SkinCarousel>
    );
    expect(root().querySelectorAll(`.${SKIN_CAROUSEL_DOT_CLASS}`)).toHaveLength(0);
  });

  it("draws one dot per slide, marks the first, and hides the row from AT", () => {
    render(
      <SkinCarousel label={LABEL} dots data-testid="carousel">
        {slides(4)}
      </SkinCarousel>
    );
    const dots = [...root().querySelectorAll(`.${SKIN_CAROUSEL_DOT_CLASS}`)];
    expect(dots).toHaveLength(4);
    expect(dots.map((d) => d.getAttribute("data-active"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);
    // The row speaks nothing: a tappable dot needs a name per dot, which is
    // i18n copy this package cannot invent, so the position is carried by the
    // strip's list semantics instead.
    const row = root().querySelector("[data-stapel-carousel-dots]");
    expect(row?.getAttribute("aria-hidden")).toBe("true");
    expect(row?.querySelector("button")).toBeNull();
  });

  it("paints from the border / text-muted roles, so dark mode needs no second rule", () => {
    render(
      <SkinCarousel label={LABEL} dots data-testid="carousel">
        {slides(3)}
      </SkinCarousel>
    );
    expect(root().style.getPropertyValue("--skin-carousel-dot")).toBe(cssVar("border"));
    expect(root().style.getPropertyValue("--skin-carousel-dot-active")).toBe(
      cssVar("text-muted")
    );
    expect(root().style.getPropertyValue("--skin-carousel-focus")).toBe(
      cssVar("focus-ring")
    );
  });
});

describe("tracking — the index follows the scroll, and only the index", () => {
  it("moves the active dot to the slide nearest the leading edge", async () => {
    render(
      <SkinCarousel label={LABEL} dots data-testid="carousel">
        {slides(4)}
      </SkinCarousel>
    );
    const activeIndex = (): number =>
      [...root().querySelectorAll(`.${SKIN_CAROUSEL_DOT_CLASS}`)].findIndex(
        (d) => d.getAttribute("data-active") === "true"
      );
    expect(activeIndex()).toBe(0);
    await scrollTo(100, 200);
    expect(activeIndex()).toBe(2);
    // Past the halfway point of the pitch the NEXT slide is the nearer one.
    await scrollTo(100, 260);
    expect(activeIndex()).toBe(3);
    await scrollTo(100, 0);
    expect(activeIndex()).toBe(0);
  });

  it("reports a settled change, never a scrolled pixel", async () => {
    const onSlideChange = vi.fn();
    render(
      <SkinCarousel label={LABEL} onSlideChange={onSlideChange} data-testid="carousel">
        {slides(3)}
      </SkinCarousel>
    );
    onSlideChange.mockClear();
    // Three scroll events, all still nearest slide 1: one index, one call.
    await scrollTo(100, 90);
    await scrollTo(100, 100);
    await scrollTo(100, 110);
    expect(onSlideChange).toHaveBeenCalledTimes(1);
    expect(onSlideChange).toHaveBeenLastCalledWith(1);
    await scrollTo(100, 200);
    expect(onSlideChange).toHaveBeenCalledTimes(2);
    expect(onSlideChange).toHaveBeenLastCalledWith(2);
  });

  it("measures nothing when there is neither an indicator nor a listener", async () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    render(
      <SkinCarousel label={LABEL} data-testid="carousel">
        {slides(3)}
      </SkinCarousel>
    );
    raf.mockClear();
    await scrollTo(100, 200);
    // No handler was ever attached, so a grid of forty untracked strips pays
    // no layout flush per scroll frame — the reason `tracks` exists.
    expect(raf).not.toHaveBeenCalled();
  });
});
