/**
 * §83.2 at the render boundary: what the placeholder IS, and what an `<img>`
 * may load.
 *
 * The three defects these pin, in the order they would otherwise ship:
 *
 *  1. one treatment for every placeholder — a waveform blurred like a photo;
 *  2. a shape reserved only when geometry happens to be known, so a voice note
 *     (no width, no height, ever) collapses to nothing and jumps when its strip
 *     arrives;
 *  3. `<img src="clip.mp4">` — a broken image where a video was meant, which is
 *     what a chat attachment renderer gets for free the moment `kind` is not
 *     read.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Image } from "../src/Image.js";
import { PREVIEW_KIND_ASPECT } from "../src/tiers.js";
import type { StapelImage } from "../src/tiers.js";

const PREVIEW = "data:image/webp;base64,UklGRi4A";

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function base(overrides: Partial<StapelImage>): StapelImage {
  return {
    source: "cdn",
    url: "cdn://media/original",
    mime: null,
    width: null,
    height: null,
    aspect: null,
    square: false,
    preview_b64: null,
    variants: [],
    ...overrides,
  };
}

function container(): HTMLElement {
  const el = document.querySelector<HTMLElement>("[data-stapel-preview-kind]");
  if (el === null) throw new Error("no element carrying data-stapel-preview-kind");
  return el;
}

describe("preview_kind branches the placeholder", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    vi.stubGlobal("devicePixelRatio", 1);
  });

  it("blurs a photo's micro thumbnail", () => {
    render(
      <Image
        alt="a photo"
        meta={base({ kind: "image", preview_kind: "blur", preview_b64: PREVIEW, aspect: 1.5 })}
      />
    );
    const preview = screen.getByTestId("stapel-image-preview");
    expect(preview.style.filter).toBe("blur(12px)");
    expect(preview.style.objectFit).toBe("cover");
  });

  it("does NOT blur a video poster — it is a frame somebody chose", () => {
    render(
      <Image
        alt="a clip"
        meta={base({
          kind: "video",
          preview_kind: "poster",
          preview_b64: PREVIEW,
          aspect: 1.777778,
        })}
      />
    );
    const preview = screen.getByTestId("stapel-image-preview");
    expect(preview.style.filter).toBe("");
    expect(preview.style.transform).toBe("");
  });

  it("draws a waveform whole, unblurred — a cropped amplitude strip has no amplitudes", () => {
    render(
      <Image
        alt="a voice note"
        meta={base({ kind: "audio", preview_kind: "waveform", preview_b64: PREVIEW, duration_ms: 4200 })}
      />
    );
    const preview = screen.getByTestId("stapel-image-preview");
    expect(preview.style.filter).toBe("");
    expect(preview.style.objectFit).toBe("contain");
  });

  it("blurs a legacy snapshot that carries a preview and no kind", () => {
    render(<Image alt="a photo" meta={base({ preview_b64: PREVIEW, aspect: 1 })} />);
    expect(screen.getByTestId("stapel-image-preview").style.filter).toBe("blur(12px)");
  });
});

describe("the box is reserved before the preview exists", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    vi.stubGlobal("devicePixelRatio", 1);
  });

  it("reserves a waveform's shape while preview_b64 is still null", () => {
    render(
      <Image
        alt="a voice note"
        meta={base({
          kind: "audio",
          preview_kind: "waveform",
          preview_b64: null,
          meta_status: "partial",
          meta_reason: "not_generated",
        })}
      />
    );
    expect(screen.getByTestId("stapel-image-preview-skeleton")).toBeDefined();
    expect(container().style.aspectRatio).toBe(String(PREVIEW_KIND_ASPECT.waveform));
  });

  it("prefers real geometry over the shape guess", () => {
    render(
      <Image
        alt="a clip"
        meta={base({ kind: "video", preview_kind: "poster", aspect: 1.25, preview_b64: null })}
      />
    );
    expect(container().style.aspectRatio).toBe("1.25");
  });

  it("guesses nothing for a still photo — a wrong box would have to jump twice", () => {
    const { container: dom } = render(
      <Image alt="a photo" meta={base({ kind: "image", preview_kind: "blur", preview_b64: null })} />
    );
    const box = dom.firstElementChild as HTMLElement;
    expect(box.style.aspectRatio).toBe("");
    expect(screen.getByTestId("stapel-image-preview-skeleton")).toBeDefined();
  });
});

describe("a time-based medium never loads its own bytes into an <img>", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    vi.stubGlobal("devicePixelRatio", 1);
    // jsdom does not load images; decode() must resolve so the swap commits.
    Object.defineProperty(window.HTMLImageElement.prototype, "decode", {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("shows nothing but the waveform for audio, whose url is an audio file", () => {
    render(
      <Image
        alt="a voice note"
        meta={base({
          kind: "audio",
          preview_kind: "waveform",
          preview_b64: PREVIEW,
          url: "cdn://media/note.m4a",
        })}
      />
    );
    for (const img of document.querySelectorAll("img")) {
      expect(img.getAttribute("src")).not.toBe("cdn://media/note.m4a");
    }
  });

  it("loads a video's poster_url, not the video", async () => {
    render(
      <Image
        alt="a clip"
        meta={base({
          kind: "video",
          preview_kind: "poster",
          preview_b64: PREVIEW,
          poster_url: "cdn://media/poster.webp",
          url: "cdn://media/clip.mp4",
          aspect: 1.777778,
        })}
      />
    );
    await vi.waitFor(() => {
      const loaded = screen.getByAltText("a clip");
      expect(loaded.getAttribute("src")).toBe("cdn://media/poster.webp");
    });
  });
});

describe("preview_b64 is a trust boundary", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    vi.stubGlobal("devicePixelRatio", 1);
  });

  it("refuses a placeholder that is not a data:image URI", () => {
    render(
      <Image
        alt="a photo"
        meta={base({
          kind: "image",
          preview_kind: "blur",
          preview_b64: "https://example.invalid/tracker.gif",
          aspect: 1,
        })}
      />
    );
    expect(screen.queryByTestId("stapel-image-preview")).toBeNull();
    // Refused, not dropped: the shape decision still stands on preview_kind.
    expect(screen.getByTestId("stapel-image-preview-skeleton")).toBeDefined();
  });
});
