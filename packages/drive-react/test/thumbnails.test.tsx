/**
 * Previews: the URL, the ladder, and the three ways a preview declines.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  THUMBNAIL_TIERS,
  hasImagePreview,
  thumbnailTierFor,
  thumbnailUrl,
} from "../src/index.js";
import { DriveThumbnail } from "../src/default/index.js";
import { BASE, harness, wire } from "./helpers.js";
import { DOC_A, DOC_B } from "./fixtures.js";

describe("the thumbnail URL", () => {
  it("is the content endpoint's neighbour, with the tier in the query", () => {
    expect(thumbnailUrl(BASE, "d-a", 160)).toBe(
      `${BASE.slice(0, -1)}/documents/d-a/thumbnail?tier=160`
    );
  });

  it("escapes the id — a path segment is never interpolated raw", () => {
    expect(thumbnailUrl(BASE, "a/b", 480)).toContain("/documents/a%2Fb/thumbnail");
  });

  it("does not double the slash when the base carries one", () => {
    expect(thumbnailUrl("https://x/docs/api/v1/", "d", 160)).toBe(
      "https://x/docs/api/v1/documents/d/thumbnail?tier=160"
    );
  });
});

describe("the tier ladder is fixed and walked upward", () => {
  it("is exactly the backend's two rungs", () => {
    expect([...THUMBNAIL_TIERS]).toEqual([160, 480]);
  });

  it("asks for the next rung UP, so a box downscales instead of upscaling", () => {
    expect(thumbnailTierFor(40)).toBe(160);
    expect(thumbnailTierFor(160)).toBe(160);
    expect(thumbnailTierFor(200)).toBe(480);
  });

  it("stops at the ceiling — there is no third tier to grow into", () => {
    expect(thumbnailTierFor(4000)).toBe(480);
  });
});

describe("hasImagePreview — the predicate that stops the pointless requests", () => {
  it("is true only for an image FILE document", () => {
    expect(hasImagePreview(DOC_A)).toBe(true);
    expect(hasImagePreview(DOC_B)).toBe(false);
    expect(hasImagePreview({ ...DOC_A, type: "md" })).toBe(false);
  });
});

describe("<DriveThumbnail/> falls back rather than showing a broken image", () => {
  it("renders an <img> at the authorized URL for an image document", async () => {
    const { wrapper } = harness(wire({}));
    render(<DriveThumbnail document={DOC_A} size={40} />, { wrapper });
    const image = await screen.findByTestId("drive-thumbnail-image");
    expect(image.getAttribute("src")).toContain("/documents/d-a/thumbnail?tier=160");
  });

  it("draws the mime glyph WITHOUT asking for a non-image document", () => {
    const stub = wire({});
    const { wrapper } = harness(stub);
    render(<DriveThumbnail document={DOC_B} size={40} />, { wrapper });
    expect(screen.getByTestId("drive-thumbnail-fallback")).toBeDefined();
    expect(stub.calls).toHaveLength(0);
  });

  it("swaps to the glyph when the preview errors (404 / 503 alike)", async () => {
    const { wrapper } = harness(wire({}));
    render(<DriveThumbnail document={DOC_A} size={40} />, { wrapper });
    const image = await screen.findByTestId("drive-thumbnail-image");
    fireEvent.error(image);
    await waitFor(() => {
      expect(screen.getByTestId("drive-thumbnail-fallback")).toBeDefined();
    });
  });

  it("forgets a previous row's failure when the document changes", async () => {
    const { wrapper } = harness(wire({}));
    const { rerender } = render(<DriveThumbnail document={DOC_A} size={40} />, {
      wrapper,
    });
    fireEvent.error(await screen.findByTestId("drive-thumbnail-image"));
    await waitFor(() => {
      expect(screen.getByTestId("drive-thumbnail-fallback")).toBeDefined();
    });
    rerender(
      <DriveThumbnail document={{ ...DOC_A, id: "d-other" }} size={40} />
    );
    await waitFor(() => {
      expect(screen.getByTestId("drive-thumbnail-image")).toBeDefined();
    });
  });
});
