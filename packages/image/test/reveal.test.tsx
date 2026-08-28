import type { ReactElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Image } from "../src/Image.js";
import type { StapelImage } from "../src/tiers.js";

/**
 * The fade-in must be an ENHANCEMENT, never a gate.
 *
 * `requestAnimationFrame` is SUSPENDED in a backgrounded or occluded tab, and
 * throttled in prerender/screenshot runners. An image whose opacity is flipped
 * only from a frame callback therefore stays at `opacity: 0` there — fully
 * fetched, correctly decoded, invisible — and self-heals the moment the tab is
 * looked at, which is what makes it expensive: it is never reproducible while
 * somebody is watching. Every screenshot, link preview and prerender pipeline
 * sees the broken state and nothing else does.
 *
 * These tests describe the ENVIRONMENT (no frame callback, hidden document),
 * not the implementation, so they stay honest across whatever mechanism the
 * component uses to reveal.
 */

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** A "link" / unprocessed file: one url, no ladder — it commits with no
 * slot measurement at all, so these tests are about the reveal and nothing
 * else. */
function linkMeta(): StapelImage {
  return {
    source: "link",
    url: "https://cdn.example/photo.png",
    mime: "image/png",
    width: 800,
    height: 600,
    aspect: 1.333,
    square: false,
    preview_b64: "data:image/webp;base64,UklGRi4A",
    variants: [],
  };
}

function renderImage(): ReactElement {
  return <Image meta={linkMeta()} alt="photo" />;
}

async function loadedImage(): Promise<HTMLElement> {
  return screen.findByAltText("photo");
}

/** jsdom has no visibility control; `visibilityState` is an accessor on the
 * prototype, so it is overridden and restored per test. */
function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
}

describe("<Image> reveal", () => {
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("devicePixelRatio", 1);
    Object.defineProperty(window.HTMLImageElement.prototype, "decode", {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    setDocumentHidden(false);
  });

  /** rAF that ACCEPTS callbacks and never runs them — a backgrounded tab. */
  function stubDeadFrames(): void {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  }

  it("shows a loaded image when requestAnimationFrame never fires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubDeadFrames();

    render(renderImage());
    const img = await loadedImage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // The frame callback was requested and never invoked — exactly what a
    // backgrounded tab does — and the image is on screen regardless.
    expect(frames.length).toBeGreaterThan(0);
    expect(img.style.opacity).toBe("1");
    // Nothing is mid-transition either: a runner that captures the page never
    // gets a half-faded frame, because the flip that did not come from a frame
    // callback does not animate.
    expect(img.style.transition).toBe("");
  });

  it("shows a loaded image immediately when the document is hidden", async () => {
    setDocumentHidden(true);
    stubDeadFrames();

    render(renderImage());
    const img = await loadedImage();
    // Flush the reveal effect only — no timers are advanced, so nothing but
    // the effect itself can be what made the image visible.
    await act(async () => {});

    expect(img.style.opacity).toBe("1");
    expect(img.style.transition).toBe("");
  });

  it("shows a loaded image in an environment with no requestAnimationFrame", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);

    render(renderImage());
    const img = await loadedImage();
    await act(async () => {});

    expect(img.style.opacity).toBe("1");
  });

  it("still fades in on a visible tab: one painted frame at 0, then the transition", async () => {
    stubDeadFrames();

    render(renderImage());
    const img = await loadedImage();

    // The blur-up needs a painted frame at 0 for the transition to run at all.
    expect(img.style.opacity).toBe("0");

    act(() => {
      for (const frame of frames.splice(0)) {
        frame(performance.now());
      }
    });

    expect(img.style.opacity).toBe("1");
    expect(img.style.transition).toBe("opacity 200ms ease");
  });
});
