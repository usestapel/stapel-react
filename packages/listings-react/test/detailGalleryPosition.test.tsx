/**
 * THE PHONE GALLERY SAYS WHICH PHOTOGRAPH IS ON SCREEN — and it follows the
 * STRIP, not a tap.
 *
 * The finding (REPORT §20b, §30d item 9): the listing page's strip arm is a
 * real scroll container and scrolls correctly, and the page carried no
 * position indicator at all — where the reference leads every phone listing
 * with a "1 of 7" counter. The half that matters is that the reading follows a native
 * scroll: a finger, a fling and a snap settling are not events this package
 * fires, so anything keyed off a tap reports the first photograph forever.
 *
 * jsdom has no layout, so the scroll is FAKED the only honest way — the
 * children's rectangles are stubbed and a `scroll` event is dispatched on the
 * strip, which is exactly what a browser does after a finger moves it. What is
 * under test is that the pane listens to the strip and re-reads its position,
 * not that jsdom can lay out a flex row.
 */
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  LISTINGS_GALLERY_COUNTER_CLASS,
  LISTINGS_GALLERY_FRAME_CLASS,
  ListingDetailPane,
  detailGalleryCss,
  nearestPhotoIndex,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

const PHOTOS = ["image/1", "image/2", "image/3"];

function server(images: readonly string[] = PHOTOS) {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail({ images: [...images] }) },
  });
}

function rect(left: number): DOMRect {
  return {
    left,
    right: left + 300,
    top: 0,
    bottom: 200,
    width: 300,
    height: 200,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * Put the strip where a finger would have left it: the box at 0, the children
 * offset by `-slide * index`, which is what a scrolled-by-one strip measures.
 */
function fakeScroll(box: HTMLElement, index: number): void {
  vi.spyOn(box, "getBoundingClientRect").mockReturnValue(rect(0));
  for (let i = 0; i < box.children.length; i += 1) {
    const child = box.children.item(i) as HTMLElement;
    vi.spyOn(child, "getBoundingClientRect").mockReturnValue(rect((i - index) * 300));
  }
}

describe("the strip's counter tracks the strip", () => {
  it("opens at the first photograph and follows a scroll it was not told about", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} galleryLayout="strip" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-photo-counter")).toBeTruthy();
    });
    const counter = screen.getByTestId("listings-detail-photo-counter");
    expect(counter.textContent).toBe(`1 of ${String(PHOTOS.length)}`);
    // It changes with no gesture a screen reader would otherwise report, so
    // it announces itself.
    expect(counter.getAttribute("aria-live")).toBe("polite");

    const box = screen.getByTestId("listings-detail-gallery");
    expect(box.getAttribute("data-gallery-active")).toBe("0");

    // A finger moved it. The ONLY thing the page is told is `scroll` — no
    // tap, no dot click, no prop.
    await act(async () => {
      fakeScroll(box, 1);
      box.dispatchEvent(new Event("scroll"));
      // The measurement is throttled to one animation frame.
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(null);
        });
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-photo-counter").textContent).toBe(
        `2 of ${String(PHOTOS.length)}`
      );
    });
    expect(box.getAttribute("data-gallery-active")).toBe("1");

    await act(async () => {
      fakeScroll(box, 2);
      box.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(null);
        });
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-photo-counter").textContent).toBe(
        `3 of ${String(PHOTOS.length)}`
      );
    });
  });

  it("says nothing over a grid, or over a single photograph", async () => {
    const { unmount } = render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-gallery")).toBeTruthy();
    });
    // Every photograph is on screen at once: "1 of 3" over a grid of three is
    // a control panel for a picture that needs none.
    expect(screen.queryByTestId("listings-detail-photo-counter")).toBeNull();
    unmount();

    render(
      <TestProviders server={server(["image/only"])} resolveImage>
        <ListingDetailPane id={7} galleryLayout="strip" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-gallery")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-photo-counter")).toBeNull();
  });

  it("stands OUTSIDE the scroller, because a child of one scrolls away", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} galleryLayout="strip" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-photo-counter")).toBeTruthy();
    });
    const box = screen.getByTestId("listings-detail-gallery");
    const counter = screen.getByTestId("listings-detail-photo-counter");
    // Not a child of the strip — `> *` would make it a slide, and an absolute
    // child of a scroller is positioned against the padding box and scrolls
    // with the content it is counting.
    expect(box.contains(counter)).toBe(false);
    const frame = counter.parentElement;
    expect(frame?.classList.contains(LISTINGS_GALLERY_FRAME_CLASS)).toBe(true);
    expect(frame?.contains(box)).toBe(true);
    const css = detailGalleryCss();
    expect(css).toContain(`.${LISTINGS_GALLERY_FRAME_CLASS} {`);
    expect(css).toContain(`.${LISTINGS_GALLERY_COUNTER_CLASS} {`);
  });
});

describe("the index comes from rectangles, not from arithmetic", () => {
  it("names the child whose leading edge is nearest the box's", () => {
    const box = document.createElement("div");
    for (let i = 0; i < 3; i += 1) box.append(document.createElement("div"));
    vi.spyOn(box, "getBoundingClientRect").mockReturnValue(rect(0));
    const children = [...box.children] as HTMLElement[];
    // A strip settled between two snap points, closer to the third.
    const offsets = [-620, -320, -20];
    children.forEach((child, i) => {
      vi.spyOn(child, "getBoundingClientRect").mockReturnValue(
        rect(offsets[i] as number)
      );
    });
    expect(nearestPhotoIndex(box)).toBe(2);
  });
});
