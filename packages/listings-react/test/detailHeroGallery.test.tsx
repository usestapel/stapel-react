/**
 * THE DESKTOP GALLERY IS A HERO, A FILMSTRIP AND A LIGHTBOX.
 *
 * What the 2026-09-12 walk logged against the reference classified: this page
 * drew a GRID of equal tiles, with no arrows, no larger view and no way to
 * open a photograph at all. A person who wants to look at the thing being
 * sold — the whole reason a classified has photographs — could not.
 *
 * `galleryLayout="hero"` is the reference's own anatomy: one large photograph,
 * a row of thumbnails under it that change which one that is, and a click on
 * the large one opening the set full size.
 *
 * ── What this file refuses to accept as proof ──────────────────────────────
 *
 * "A dialog element exists" is the green gate this fleet has been burned by.
 * A lightbox is a thing a person OPERATES, so every assertion below is an
 * outcome at the hands of one:
 *
 *   · the hero photograph CHANGES when a thumbnail is pressed — read off WHICH
 *     stored picture the hero is drawing, not off a class (see `photoOf`);
 *   · the lightbox OPENS with an accessible name, and lands on the photograph
 *     the hero was showing — not on the first one;
 *   · the arrows, the left/right keys and a swipe each MOVE it, and the
 *     counter says where it is;
 *   · Escape CLOSES it and the focus comes back to the control that opened
 *     it — a lightbox that leaves focus on `<body>` has stranded a keyboard;
 *   · Tab is TRAPPED: from the last control it wraps to the first rather than
 *     walking out into the page behind the mask.
 *
 * The PHONE arm is asserted untouched in the last block: the snap-scrolling
 * strip and its counter are what a finger reads, and this wave does not move
 * them.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

const PHOTOS = ["image/a", "image/b", "image/c", "image/d"];

/**
 * jsdom ships no `PointerEvent`, and a swipe is half of what this gallery
 * promises a touch screen — so the smallest honest shape of one is built here
 * (the same bargain `gallerySwipeThreshold.test.tsx` strikes).
 */
class TestPointerEvent extends MouseEvent {
  public readonly pointerType: string;
  public constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? "";
  }
}
(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;

afterEach(() => {
  vi.restoreAllMocks();
});

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail({ images: PHOTOS }) },
  });
}

function pane(node: ReactElement): ReactElement {
  // `resolveImage` on, so the photographs take the real image path rather than
  // the designed "this app cannot resolve a reference" box — which would make
  // every picture on the page identical and every assertion below vacuous.
  return (
    <TestProviders server={server()} resolveImage>
      {node}
    </TestProviders>
  );
}

async function heroPage(): Promise<void> {
  render(pane(<ListingDetailPane id={7} layout="split" galleryLayout="hero" />));
  await waitFor(() => {
    expect(screen.getByTestId("listings-detail-hero")).toBeTruthy();
  });
}

/**
 * WHICH photograph a box is showing.
 *
 * Not the `alt` text, and the reason is a property of the environment rather
 * than a compromise: `@stapel/image` commits its `<img>` only once it has
 * MEASURED the slot it stands in, and jsdom lays nothing out — so the string a
 * reader would hear is not in this DOM at all, for the hero or for any card in
 * this package. The stored reference IS the picture, one step earlier, and the
 * skin publishes it on both boxes for exactly this reason.
 *
 * The alt text itself is asserted where it IS observable: the thumbnails carry
 * it as their own accessible name, checked below.
 */
function photoOf(box: HTMLElement): string | null {
  return box.getAttribute("data-photo");
}

/** Open the lightbox off the hero and hand back the dialog. */
async function openLightbox(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId("listings-detail-hero"));
  await waitFor(() => {
    expect(screen.getByTestId("listings-detail-lightbox")).toBeTruthy();
  });
  return screen.getByTestId("listings-detail-lightbox");
}

function counter(): string {
  return screen.getByTestId("listings-detail-lightbox-counter").textContent ?? "";
}

/** One drag across the lightbox stage: a press and a release. */
function swipe(from: number, to: number): void {
  const stage = screen.getByTestId("listings-detail-lightbox-stage");
  const fire = (type: string, x: number): void => {
    fireEvent(
      stage,
      new TestPointerEvent(type, {
        clientX: x,
        clientY: 200,
        pointerType: "touch",
        bubbles: true,
      })
    );
  };
  act(() => {
    fire("pointerdown", from);
    fire("pointerup", to);
  });
}

describe("the hero and its filmstrip", () => {
  it("draws ONE large photograph and a thumbnail per picture", async () => {
    await heroPage();
    const gallery = screen.getByTestId("listings-detail-gallery");
    expect(gallery.dataset["galleryLayout"]).toBe("hero");
    // One hero, not a grid of four equal tiles.
    expect(screen.getAllByTestId("listings-detail-hero")).toHaveLength(1);
    expect(screen.getAllByTestId("listings-detail-thumb")).toHaveLength(
      PHOTOS.length
    );
    expect(photoOf(screen.getByTestId("listings-detail-hero"))).toBe(PHOTOS[0]);
    // The alt text a reader hears for each picture, where the DOM carries it:
    // the thumbnails' own accessible names.
    expect(
      screen.getAllByTestId("listings-detail-thumb").map((one) =>
        one.getAttribute("aria-label")
      )
    ).toEqual(["Photo 1 of 4", "Photo 2 of 4", "Photo 3 of 4", "Photo 4 of 4"]);
  });

  it("changes the hero when a thumbnail is pressed", async () => {
    await heroPage();
    fireEvent.click(screen.getAllByTestId("listings-detail-thumb")[2] as HTMLElement);
    await waitFor(() => {
      expect(photoOf(screen.getByTestId("listings-detail-hero"))).toBe(PHOTOS[2]);
    });
    // …and says which one it is, for anything that is not looking at pixels.
    expect(
      screen.getByTestId("listings-detail-gallery").dataset["galleryActive"]
    ).toBe("2");
    const marks = screen
      .getAllByTestId("listings-detail-thumb")
      .map((one) => one.getAttribute("aria-current"));
    expect(marks).toEqual([null, null, "true", null]);
  });

  it("draws no filmstrip for a listing with one photograph", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/listings/7/status/": { body: statusInfo() },
          "/listings/7/": { body: detail({ images: ["image/a"] }) },
        })}
        resolveImage
      >
        <ListingDetailPane id={7} layout="split" galleryLayout="hero" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-hero")).toBeTruthy();
    });
    // A strip of one is a control for a choice nobody has.
    expect(screen.queryByTestId("listings-detail-filmstrip")).toBeNull();
  });
});

describe("the lightbox opens, and opens on the right photograph", () => {
  it("opens on a click on the hero, with an accessible name", async () => {
    await heroPage();
    expect(screen.queryByTestId("listings-detail-lightbox")).toBeNull();
    await openLightbox();
    // A dialog nobody can name is a dialog a screen reader announces as a
    // region. `getByRole` resolves `aria-labelledby`, so this is the name a
    // person is actually given.
    expect(screen.getByRole("dialog", { name: "Photos of this listing" })).toBeTruthy();
    expect(counter()).toBe("1 of 4");
  });

  it("opens on the photograph the hero was showing, not on the first", async () => {
    await heroPage();
    fireEvent.click(screen.getAllByTestId("listings-detail-thumb")[3] as HTMLElement);
    await waitFor(() => {
      expect(photoOf(screen.getByTestId("listings-detail-hero"))).toBe(PHOTOS[3]);
    });
    await openLightbox();
    expect(counter()).toBe("4 of 4");
    expect(photoOf(screen.getByTestId("listings-detail-lightbox-stage"))).toBe(
      PHOTOS[3]
    );
  });
});

describe("the lightbox moves — by arrow, by key and by finger", () => {
  it("advances and goes back on the two arrow controls", async () => {
    await heroPage();
    await openLightbox();
    fireEvent.click(screen.getByTestId("listings-detail-lightbox-next"));
    await waitFor(() => {
      expect(counter()).toBe("2 of 4");
    });
    expect(photoOf(screen.getByTestId("listings-detail-lightbox-stage"))).toBe(
      PHOTOS[1]
    );
    fireEvent.click(screen.getByTestId("listings-detail-lightbox-prev"));
    await waitFor(() => {
      expect(counter()).toBe("1 of 4");
    });
  });

  it("wraps around rather than dead-ending at either edge", async () => {
    await heroPage();
    await openLightbox();
    // Back from the first photograph is the last one: a lightbox is a ring,
    // and a disabled arrow at each end is two dead controls on a set of four.
    fireEvent.click(screen.getByTestId("listings-detail-lightbox-prev"));
    await waitFor(() => {
      expect(counter()).toBe("4 of 4");
    });
    fireEvent.click(screen.getByTestId("listings-detail-lightbox-next"));
    await waitFor(() => {
      expect(counter()).toBe("1 of 4");
    });
  });

  it("moves on the left and right keys", async () => {
    await heroPage();
    const box = await openLightbox();
    fireEvent.keyDown(box, { key: "ArrowRight" });
    await waitFor(() => {
      expect(counter()).toBe("2 of 4");
    });
    fireEvent.keyDown(box, { key: "ArrowRight" });
    await waitFor(() => {
      expect(counter()).toBe("3 of 4");
    });
    fireEvent.keyDown(box, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(counter()).toBe("2 of 4");
    });
  });

  it("moves on a swipe, and leaves a tap alone", async () => {
    await heroPage();
    await openLightbox();
    // Dragging LEFT advances — the direction the content moves under the
    // finger, the same mapping the phone strip already has.
    swipe(300, 180);
    await waitFor(() => {
      expect(counter()).toBe("2 of 4");
    });
    swipe(180, 300);
    await waitFor(() => {
      expect(counter()).toBe("1 of 4");
    });
    // A tap is not a swipe: 6px of wobble must not change the photograph.
    swipe(200, 206);
    expect(counter()).toBe("1 of 4");
  });

  it("carries the chosen photograph back to the hero on close", async () => {
    await heroPage();
    const box = await openLightbox();
    fireEvent.click(screen.getByTestId("listings-detail-lightbox-next"));
    await waitFor(() => {
      expect(counter()).toBe("2 of 4");
    });
    fireEvent.keyDown(box, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("listings-detail-lightbox")).toBeNull();
    });
    // The page a person comes back to is the page they were looking at.
    expect(photoOf(screen.getByTestId("listings-detail-hero"))).toBe(PHOTOS[1]);
  });
});

describe("the lightbox holds the keyboard, and hands it back", () => {
  it("puts focus inside itself when it opens", async () => {
    await heroPage();
    const box = await openLightbox();
    await waitFor(() => {
      expect(box.contains(document.activeElement)).toBe(true);
    });
  });

  it("traps Tab: the last control wraps to the first, and back", async () => {
    await heroPage();
    const box = await openLightbox();
    const dialog = screen.getByRole("dialog", { name: "Photos of this listing" });
    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
      ),
    ];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first).toBeTruthy();
    expect(last).toBeTruthy();
    expect(first).not.toBe(last);

    act(() => {
      last?.focus();
    });
    fireEvent.keyDown(last as HTMLElement, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first as HTMLElement, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    expect(box.isConnected).toBe(true);
  });

  it("returns focus to the control that opened it, on Escape", async () => {
    await heroPage();
    const hero = screen.getByTestId("listings-detail-hero");
    const box = await openLightbox();
    expect(document.activeElement).not.toBe(hero);
    fireEvent.keyDown(box, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("listings-detail-lightbox")).toBeNull();
    });
    // Not `<body>`: a keyboard that ends up there has to walk the whole page
    // again to get back to where it was.
    expect(document.activeElement).toBe(hero);
  });

  it("returns focus on the close control too", async () => {
    await heroPage();
    const hero = screen.getByTestId("listings-detail-hero");
    await openLightbox();
    fireEvent.click(screen.getByTestId("listings-detail-lightbox-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("listings-detail-lightbox")).toBeNull();
    });
    expect(document.activeElement).toBe(hero);
  });
});

describe("the phone's strip is not the desktop's hero", () => {
  it("keeps the snap-scrolling strip and its counter, and mounts no lightbox", async () => {
    render(pane(<ListingDetailPane id={7} galleryLayout="strip" />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-gallery")).toBeTruthy();
    });
    const gallery = screen.getByTestId("listings-detail-gallery");
    expect(gallery.dataset["galleryLayout"]).toBe("strip");
    expect(screen.getByTestId("listings-detail-photo-counter").textContent).toBe(
      "1 of 4"
    );
    // Every photograph is a child of the strip, exactly as before: the strip
    // is the scroller and the pictures are its slides.
    expect(gallery.children.length).toBeGreaterThanOrEqual(PHOTOS.length);
    expect(screen.queryByTestId("listings-detail-hero")).toBeNull();
    expect(screen.queryByTestId("listings-detail-lightbox")).toBeNull();
  });

  it("keeps the grid arm for a host that asked for it", async () => {
    render(pane(<ListingDetailPane id={7} galleryLayout="grid" />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-gallery")).toBeTruthy();
    });
    expect(
      screen.getByTestId("listings-detail-gallery").dataset["galleryLayout"]
    ).toBe("grid");
    expect(screen.queryByTestId("listings-detail-hero")).toBeNull();
  });
});
