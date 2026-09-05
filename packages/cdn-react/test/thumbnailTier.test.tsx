/**
 * The upload tile asks for the tier its own BOX needs.
 *
 * Owner sweep 2026-08-24, defect class (c) — a size decision taken without
 * reference to the element it is for. The tiles rendered a raw `<img>` into a
 * hardcoded 96x96 frame with `smallestVariantUrl()` as its source: the bottom
 * rung of the ladder, chosen with no reference to the frame at all. On a 2x
 * phone that frame wants 192 device pixels and the smallest tier is
 * guaranteed to be short of it.
 *
 * The measurement is driven through a controllable `ResizeObserver` rather
 * than by stubbing `@stapel/image`: the point of the fix is that the real
 * measuring component runs, so a test that mocked it away would pass over a
 * tile that still hardcoded a tier.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CdnThumbnail } from "../src/default/CdnThumbnail.js";
import { PREVIEW_BOX } from "../src/default/phase.js";
import type { CdnImage } from "../src/api/types.js";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {}
  trigger(width: number, height: number): void {
    this.callback(
      [
        {
          target: this.observed[0],
          contentRect: { width, height },
          contentBoxSize: [{ inlineSize: width, blockSize: height }],
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    );
  }
}

/** A ladder with a real spread of rungs, so "the smallest" and "the one that
 * fits" are visibly different answers. */
function ladderRow(): CdnImage {
  const tiers = [64, 120, 240, 480, 960];
  return {
    prefix: "product/" + "a".repeat(64),
    type: "product",
    file_hash: "a".repeat(64),
    original_url: "https://cdn.test/original.webp",
    original_width: 1200,
    original_height: 1200,
    is_processed: true,
    variants_meta: tiers.map((tier) => ({
      tier,
      branch: null,
      url: `https://cdn.test/${String(tier)}.webp`,
      width: tier,
      height: tier,
    })),
  } as unknown as CdnImage;
}

function measure(width: number, height: number): void {
  const ro = MockResizeObserver.instances.at(-1);
  if (ro === undefined) throw new Error("nothing observed the tile");
  act(() => {
    ro.trigger(width, height);
  });
}

describe("the tile's tier comes from the tile", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    Object.defineProperty(window.HTMLImageElement.prototype, "decode", {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a 96px box at 1x asks for 120, not the smallest rung", async () => {
    vi.stubGlobal("devicePixelRatio", 1);
    render(
      <CdnThumbnail localUrl={null} image={ladderRow()} box={PREVIEW_BOX} alt="tile" />
    );
    measure(96, 96);
    await waitFor(() => {
      expect(screen.getByAltText("tile").getAttribute("src")).toBe(
        "https://cdn.test/120.webp"
      );
    });
  });

  it("the SAME box at 3x asks for 480 — the pixels the screen actually has", async () => {
    // 96 CSS px x 3 = 288 device px. This is the case the old code could never
    // get right: `smallestVariantUrl` would have answered 64 on every screen.
    vi.stubGlobal("devicePixelRatio", 3);
    render(
      <CdnThumbnail localUrl={null} image={ladderRow()} box={PREVIEW_BOX} alt="tile" />
    );
    measure(96, 96);
    await waitFor(() => {
      expect(screen.getByAltText("tile").getAttribute("src")).toBe(
        "https://cdn.test/480.webp"
      );
    });
  });

  it("the local pick still paints immediately, with no measurement at all", () => {
    // An object URL has no ladder and no metadata, and the whole point of it
    // is that it is on screen before any request has been made.
    render(
      <CdnThumbnail
        localUrl="blob:local/1"
        image={ladderRow()}
        box={PREVIEW_BOX}
        alt="tile"
      />
    );
    expect(screen.getByAltText("tile").getAttribute("src")).toBe("blob:local/1");
  });

  it("an unprocessed row (no ladder yet) shows the original rather than nothing", () => {
    const row = { ...ladderRow(), variants_meta: [], is_processed: false } as CdnImage;
    render(<CdnThumbnail localUrl={null} image={row} box={PREVIEW_BOX} alt="tile" />);
    expect(screen.getByAltText("tile").getAttribute("src")).toBe(
      "https://cdn.test/original.webp"
    );
  });
});

/**
 * A restored item's three paint states (composer reopen, D383): still
 * asking, asked-and-gone, and the row itself once it arrives — the last of
 * which is already covered above, since a resolved row is drawn exactly like
 * one a fresh upload produced.
 */
describe("a restored item's tile before its row is known", () => {
  it("draws a skeleton while the lookup is in flight, not the empty frame", () => {
    render(
      <CdnThumbnail
        localUrl={null}
        image={null}
        box={PREVIEW_BOX}
        alt="tile"
        resolving
        data-testid="thumb"
      />
    );
    expect(screen.getByTestId("thumb-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("thumb")).toBeNull();
  });

  it("draws a broken-image fallback once the reference resolves to nothing", () => {
    render(
      <CdnThumbnail
        localUrl={null}
        image={null}
        box={PREVIEW_BOX}
        alt="gone"
        broken
        data-testid="thumb"
      />
    );
    expect(screen.getByTestId("thumb-broken")).toBeTruthy();
    expect(screen.getByRole("img", { name: "gone" })).toBeTruthy();
  });

  it("a local pick or a resolved row wins over `resolving`/`broken` — there is something to paint", () => {
    render(
      <CdnThumbnail
        localUrl="blob:local/1"
        image={null}
        box={PREVIEW_BOX}
        alt="tile"
        resolving
        broken
        data-testid="thumb"
      />
    );
    expect(screen.getByAltText("tile").getAttribute("src")).toBe("blob:local/1");
    expect(screen.queryByTestId("thumb-skeleton")).toBeNull();
    expect(screen.queryByTestId("thumb-broken")).toBeNull();
  });
});
