/**
 * `<MediaGalleryField bag={…}>` — the prop the README documented and the
 * package did not have.
 *
 * The claim under test is not "the prop is accepted". It is that the gallery
 * and the CONSUMER see one queue: what a person adds through the tiles reaches
 * `bag.refs` (which a listing composer stores as `images_draft`) and moves
 * `bag.settled` (which is that composer's publish gate). A field that mounts
 * its own uploader passes a smoke test and fails this one, which is exactly
 * what shipped: the composer's queue stayed empty while photos uploaded on
 * screen, so the gate talked about pictures it could not see and the draft
 * went out with none.
 *
 * The second test is a drift gate on the README itself: every prop its
 * examples spell must exist in the props declaration. The defect this file
 * exists for was DOCUMENTED for a whole release — the sentence was right and
 * the package was wrong — and nothing in the suite could tell.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useUploadQueue } from "../src/index.js";
import type { UploadQueueBag } from "../src/index.js";
import { MediaGalleryField } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { imageFile, imageRow, MISS, uploaded } from "./fixtures.js";

const HASH = "b".repeat(64);

function storing() {
  return mockServer({
    "/file/exists/": { body: MISS },
    "/upload/image/": { status: 201, body: uploaded(imageRow({ hash: HASH })) },
  });
}

/**
 * A stand-in for the listing composer: it owns the queue and reads the two
 * members it consumes, without importing `@stapel/listings-react` (L2 pairs
 * never import each other — the CONTAINER is the seam, and this test plays it).
 */
function ComposerWithGallery(): ReactElement {
  const gallery: UploadQueueBag = useUploadQueue({ max: 10 });
  return (
    <>
      <MediaGalleryField bag={gallery} />
      <span data-testid="composer-refs">{gallery.refs.join(",")}</span>
      <span data-testid="composer-settled">
        {String(gallery.settled.available)}
      </span>
    </>
  );
}

describe("<MediaGalleryField bag>", () => {
  it("draws the caller's queue, so a pick reaches the caller's refs", async () => {
    const server = storing();
    render(
      <TestHarness server={server}>
        <ComposerWithGallery />
      </TestHarness>
    );

    expect(screen.getByTestId("composer-refs").textContent).toBe("");

    fireEvent.change(screen.getByTestId("cdn-gallery-input"), {
      target: { files: [imageFile()] },
    });

    // The reference the consumer stores as `images_draft` — from the queue it
    // was handed, not from a second one this field made for itself.
    await waitFor(() => {
      expect(screen.getByTestId("composer-refs").textContent).toBe(
        `product/${HASH}`
      );
    });
    // One tile on screen, one reference in the bag: one queue.
    expect(screen.getAllByTestId("cdn-gallery-tile")).toHaveLength(1);
    expect(screen.getByTestId("composer-settled").textContent).toBe("true");
  });

  it("moves the consumer's publish gate while the photo is in flight", async () => {
    // The upload cannot complete, so the queue never settles — and the gate
    // the composer reads must say so from the same object the tiles draw.
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": () => {
        throw new Error("no answer in this test");
      },
    });
    render(
      <TestHarness server={server}>
        <ComposerWithGallery />
      </TestHarness>
    );

    fireEvent.change(screen.getByTestId("cdn-gallery-input"), {
      target: { files: [imageFile()] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("composer-settled").textContent).toBe("false");
    });
    // And the gallery says the same thing in words, from the same bag.
    expect(screen.getByTestId("cdn-gallery-unsettled")).toBeTruthy();
  });

  it("still owns its queue when no bag is handed in", async () => {
    const server = storing();
    const refs: string[][] = [];
    render(
      <TestHarness server={server}>
        <MediaGalleryField max={10} onRefsChange={(next) => refs.push([...next])} />
      </TestHarness>
    );

    fireEvent.change(screen.getByTestId("cdn-gallery-input"), {
      target: { files: [imageFile()] },
    });

    await waitFor(() => {
      expect(refs[refs.length - 1]).toEqual([`product/${HASH}`]);
    });
  });
});

describe("the README documents props this package has", () => {
  // Paths are package-relative: vitest runs with the package as its cwd, the
  // way `pair.test.ts` already reads `manifest.json`.
  const readme = readFileSync("README.md", "utf8");
  const source = readFileSync("src/default/MediaGalleryField.tsx", "utf8");

  /** Attribute names spelled on `<MediaGalleryField …>` anywhere in the README. */
  function documentedProps(): readonly string[] {
    const found = new Set<string>();
    for (const match of readme.matchAll(/<MediaGalleryField([^/>]*)/g)) {
      for (const attr of match[1].matchAll(/([A-Za-z][A-Za-z0-9]*)=/g)) {
        found.add(attr[1] as string);
      }
    }
    return [...found];
  }

  it("spells at least the bag prop, and every prop it spells exists", () => {
    const props = documentedProps();
    expect(props).toContain("bag");
    for (const prop of props) {
      expect(
        new RegExp(`^\\s+${prop}[?]?:`, "m").test(source),
        `README documents <MediaGalleryField ${prop}={…}> but the props declaration has no ${prop}`
      ).toBe(true);
    }
  });
});
