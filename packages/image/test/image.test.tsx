import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Image } from "../src/Image.js";
import type { StapelImage, VariantMeta } from "../src/tiers.js";

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
    const entry = {
      target: this.observed[0],
      contentRect: { width, height },
      contentBoxSize: [{ inlineSize: width, blockSize: height }],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}


function lastObserver(): MockResizeObserver {
  const ro = MockResizeObserver.instances.at(-1);
  if (ro === undefined) {
    throw new Error("no ResizeObserver instance");
  }
  return ro;
}

const PREVIEW_TIERS = [160, 240, 480, 560, 720, 1080];

function portraitMeta(): StapelImage {
  const variants: VariantMeta[] = [
    { tier: "32", branch: null, url: "cdn://img/32.webp", width: 32, height: 43 },
    { tier: "64", branch: null, url: "cdn://img/64.webp", width: 64, height: 85 },
    { tier: "120", branch: null, url: "cdn://img/120.webp", width: 120, height: 160 },
  ];
  for (const tier of PREVIEW_TIERS) {
    variants.push(
      { tier: String(tier), branch: "w", url: `cdn://img/${tier}w.webp`, width: tier, height: Math.round(tier / 0.75) },
      { tier: String(tier), branch: "h", url: `cdn://img/${tier}h.webp`, width: Math.round(tier * 0.75), height: tier }
    );
  }
  variants.push({
    tier: "original",
    branch: null,
    url: "cdn://img/original.webp",
    width: 3024,
    height: 4032,
  });
  return {
    source: "cdn",
    url: "cdn://img/original.webp",
    mime: "image/webp",
    width: 3024,
    height: 4032,
    aspect: 0.75,
    square: false,
    preview_b64: "data:image/webp;base64,UklGRi4A",
    variants,
  };
}

describe("<Image>", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("devicePixelRatio", 1);
    // jsdom does not load images; decode() must resolve so the swap commits.
    Object.defineProperty(window.HTMLImageElement.prototype, "decode", {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets aspect-ratio on the container from metadata before any measurement", () => {
    const { container } = render(<Image meta={portraitMeta()} alt="photo" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.aspectRatio).toBe("0.75");
  });

  it("renders the blur-up preview from preview_b64 before the tier loads", () => {
    const meta = portraitMeta();
    const { container } = render(<Image meta={meta} alt="photo" />);
    const blur = container.querySelector("img[aria-hidden='true']");
    expect(blur).not.toBeNull();
    expect(blur?.getAttribute("src")).toBe(meta.preview_b64);
    // The real image has not been chosen yet — no measurement happened.
    expect(screen.queryByAltText("photo")).toBeNull();
  });

  it("degrades to the single url when there is no ladder (a link / unprocessed file)", async () => {
    const link: StapelImage = {
      source: "link",
      url: "https://cdn.example/oauth-avatar.png",
      mime: null,
      width: null,
      height: null,
      aspect: null,
      square: false,
      preview_b64: null,
      variants: [],
    };
    const { container } = render(<Image meta={link} alt="avatar" />);
    // No measurement needed — the single url shows immediately.
    const img = await screen.findByAltText("avatar");
    expect(img.getAttribute("src")).toBe("https://cdn.example/oauth-avatar.png");
    // No aspect known → no aspect-ratio pinned, no blur-up layer.
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.aspectRatio).toBe("");
    expect(container.querySelector("img[aria-hidden='true']")).toBeNull();
  });

  it("picks the branch/tier from the measured slot (owner's case: portrait in a wide slot → w)", async () => {
    render(<Image meta={portraitMeta()} alt="photo" />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(640, 360);
    });
    const img = await screen.findByAltText("photo");
    // cover, Ri 0.75 < Rs 1.78 → w; 640 > 560×1.1 → 720w.
    expect(img.getAttribute("src")).toBe("cdn://img/720w.webp");
  });

  it("upgrades on slot growth, after decode", async () => {
    render(<Image meta={portraitMeta()} alt="photo" />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(300, 200);
    });
    // 300 ≤ 560×1.1? 160×1.1=176<300, 240×1.1=264<300, 480×1.1=528 ≥ 300 → 480w
    await waitFor(() => {
      expect(screen.getByAltText("photo").getAttribute("src")).toBe("cdn://img/480w.webp");
    });
    act(() => {
      ro.trigger(700, 400);
    });
    await waitFor(() => {
      expect(screen.getByAltText("photo").getAttribute("src")).toBe("cdn://img/720w.webp");
    });
  });

  it("never downgrades: a shrink keeps the already-rendered tier", async () => {
    render(<Image meta={portraitMeta()} alt="photo" />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(640, 360);
    });
    await waitFor(() => {
      expect(screen.getByAltText("photo").getAttribute("src")).toBe("cdn://img/720w.webp");
    });
    act(() => {
      ro.trigger(200, 120);
    });
    // High-water-mark + upgrade-only guard: src is untouched.
    expect(screen.getByAltText("photo").getAttribute("src")).toBe("cdn://img/720w.webp");
  });

  it("passes through img props and applies fit", async () => {
    render(<Image meta={portraitMeta()} alt="photo" fit="contain" loading="lazy" />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(640, 360);
    });
    const img = await screen.findByAltText("photo");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect((img as HTMLImageElement).style.objectFit).toBe("contain");
    // contain flips the axis for a portrait in a wide slot → h-branch (360 → 480h).
    expect(img.getAttribute("src")).toBe("cdn://img/480h.webp");
  });
});
