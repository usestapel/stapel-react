/**
 * The antd skin: a control that is off says why, a dedup hit says so, and no
 * UI string is a literal.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageUploadField, MediaGalleryField } from "../src/default/index.js";
import { COVER_CORNER, PHASE_CORNER } from "../src/default/MediaGalleryField.js";
import { cdnI18nBundleEn } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { hit, imageFile, imageRow, MISS, uploaded } from "./fixtures.js";

const HASH = "a".repeat(64);

function storing() {
  return mockServer({
    "/file/exists/": { body: MISS },
    "/upload/image/": { status: 201, body: uploaded(imageRow({ hash: HASH })) },
    "/upload/avatar/": {
      status: 201,
      body: uploaded(imageRow({ hash: HASH, type: "avatar" })),
    },
  });
}

describe("<ImageUploadField/>", () => {
  it("uploads a pick and reports the phase in words", async () => {
    const server = storing();
    const seen: string[] = [];
    render(
      <TestHarness server={server}>
        <ImageUploadField
          target={{ kind: "avatar" }}
          onUploaded={(ref) => seen.push(ref)}
        />
      </TestHarness>
    );

    const input = screen.getByTestId("cdn-image-input");
    fireEvent.change(input, { target: { files: [imageFile()] } });

    await waitFor(() => {
      expect(seen).toEqual([`avatar/${HASH}`]);
    });
    expect(screen.getByTestId("cdn-image-phase").textContent).toBe(
      cdnI18nBundleEn["cdn.phase.done"]
    );
  });

  it("says the bytes were already stored, instead of pretending to upload", async () => {
    const server = mockServer({
      "/file/exists/": { body: { exists: true, type: "image", file: imageRow({ hash: HASH, type: "avatar" }) } },
    });
    render(
      <TestHarness server={server}>
        <ImageUploadField target={{ kind: "avatar" }} />
      </TestHarness>
    );

    fireEvent.change(screen.getByTestId("cdn-image-input"), {
      target: { files: [imageFile()] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("cdn-image-deduped")).toBeTruthy();
    });
    expect(server.count("/upload/avatar/")).toBe(0);
  });

  it("renders the refusal, not a silent nothing", async () => {
    const server = storing();
    render(
      <TestHarness server={server}>
        <ImageUploadField />
      </TestHarness>
    );

    fireEvent.change(screen.getByTestId("cdn-image-input"), {
      target: { files: [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("cdn-image-error")).toBeTruthy();
    });
    expect(screen.getByTestId("cdn-image-error").textContent).toContain(
      cdnI18nBundleEn["error.400.invalid_format"]
    );
  });
});

describe("<MediaGalleryField/>", () => {
  it("shows the count and the empty state", () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField max={10} />
      </TestHarness>
    );

    expect(screen.getByTestId("cdn-gallery-count").textContent).toBe("0 of 10 photos");
    expect(screen.getByTestId("cdn-gallery-empty")).toBeTruthy();
  });

  it("a full gallery switches Add off AND says why", () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField max={1} initialRefs={[`product/${HASH}`]} />
      </TestHarness>
    );

    expect(
      screen.getByTestId("cdn-gallery-drop-pick").getAttribute("aria-disabled")
    ).toBe("true");
    // The reason is TEXT beside the control (GatedControl), and it names the
    // ceiling without a counted noun — `useActionGate` resolves a block's code
    // with `t`, which cannot select a plural form.
    expect(
      screen.getByTestId("cdn-gallery-drop-pick-gate").textContent
    ).toContain("This gallery is full");
  });

  it("labels the first tile as the cover — the order is the meaning", async () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField
          max={10}
          initialRefs={[`product/${HASH}`, `product/${"b".repeat(64)}`]}
        />
      </TestHarness>
    );

    expect(screen.getAllByTestId("cdn-tile-cover")).toHaveLength(1);
  });

  it("the move buttons reorder without a drag — a phone has no drag", async () => {
    const changed: string[][] = [];
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField
          max={10}
          initialRefs={[`product/${HASH}`, `product/${"b".repeat(64)}`]}
          onRefsChange={(refs) => changed.push([...refs])}
        />
      </TestHarness>
    );

    fireEvent.click(screen.getAllByTestId("cdn-tile-earlier")[1] as HTMLElement);

    await waitFor(() => {
      expect(changed.at(-1)).toEqual([`product/${"b".repeat(64)}`, `product/${HASH}`]);
    });
  });

  it("a reopened draft's tile paints the picture once its row resolves (D383)", async () => {
    const server = mockServer({ "/file/exists/": { body: hit(imageRow({ hash: HASH })) } });
    render(
      <TestHarness server={server}>
        <MediaGalleryField max={10} initialRefs={[`product/${HASH}`]} />
      </TestHarness>
    );

    // Before the read settles: a skeleton, not an empty frame and not a
    // broken-image glyph — the reference has not been found gone.
    expect(screen.getByTestId("cdn-tile-thumbnail-skeleton")).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByTestId("cdn-tile-thumbnail-skeleton")).toBeNull();
    });
    // The row arrived: `<CdnThumbnail>` now has real metadata and hands it to
    // `<Image>`, which paints its inline preview at once — no empty frame and
    // no broken-image glyph for a reference that DID resolve.
    expect(screen.queryByTestId("cdn-tile-thumbnail-broken")).toBeNull();
    expect(screen.getByTestId("stapel-image-preview")).toBeTruthy();
  });

  it("a reopened draft's reference that no longer resolves draws the broken-image fallback, not a hang", async () => {
    const server = mockServer({ "/file/exists/": { body: MISS } });
    render(
      <TestHarness server={server}>
        <MediaGalleryField max={10} initialRefs={[`product/${HASH}`]} />
      </TestHarness>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cdn-tile-thumbnail-broken")).toBeTruthy();
    });
    expect(screen.queryByTestId("cdn-tile-thumbnail-skeleton")).toBeNull();
    // Still counted, still removable — only the picture is missing.
    expect(screen.getByTestId("cdn-gallery-count").textContent).toBe("1 of 10 photos");
  });

  it("uploads picked files and reports them as references", async () => {
    const server = storing();
    const changed: string[][] = [];
    render(
      <TestHarness server={server}>
        <MediaGalleryField max={10} onRefsChange={(refs) => changed.push([...refs])} />
      </TestHarness>
    );

    fireEvent.change(screen.getByTestId("cdn-gallery-drop-input"), {
      target: { files: [imageFile()] },
    });

    await waitFor(() => {
      expect(changed.at(-1)).toEqual([`product/${HASH}`]);
    });
    expect(screen.getByTestId("cdn-gallery-count").textContent).toBe("1 of 10 photos");
  });
});

/**
 * The run-on tile (demo, 2026-09-12).
 *
 * At 390px the uploaded tile printed "ReadyCover photoAlready uploaded —
 * nothing was sent again" as one unseparated blob wrapped into a 96px
 * column: a status, a role and an outcome, three different kinds of
 * thing, all rendered as loose text inside the tile. The status and the role
 * are badges in opposite corners of the picture; the outcome is a sentence
 * and belongs to the GRID, in the notice slot beside the one `settled`
 * already owns.
 */
describe("<MediaGalleryField/> — badges on the tile, sentences under the grid", () => {
  /**
   * Every text node inside the tile whose nearest element is neither a badge
   * nor a control nor the error alert. A run-on blob would show up here — and
   * did, before this pass.
   */
  function looseTextIn(tile: HTMLElement): string[] {
    const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
    const loose: string[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      if (text === "") continue;
      const owner = node.parentElement;
      if (owner === null) continue;
      if (
        owner.closest("[data-stapel-status]") !== null ||
        owner.closest("button") !== null ||
        owner.closest('[data-testid="cdn-tile-error"]') !== null
      ) {
        continue;
      }
      loose.push(text);
    }
    return loose;
  }

  it("puts the phase and the cover badge in OPPOSITE corners, and no free text between them", async () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField
          max={10}
          initialRefs={[`product/${HASH}`, `product/${"b".repeat(64)}`]}
        />
      </TestHarness>
    );

    const cover = screen.getByTestId("cdn-tile-cover");
    const phase = screen.getAllByTestId("cdn-tile-phase")[0] as HTMLElement;

    // Both are the fleet's status chip, not a paragraph: the family is
    // stamped, so the assertion reads a role rather than a colour.
    expect(cover.getAttribute("data-stapel-status")).toBe("info");
    expect(phase.getAttribute("data-stapel-status")).not.toBeNull();

    const coverCorner = cover.closest("[data-corner]")?.getAttribute("data-corner");
    const phaseCorner = phase.closest("[data-corner]")?.getAttribute("data-corner");
    expect(coverCorner).toBe(COVER_CORNER);
    expect(phaseCorner).toBe(PHASE_CORNER);
    expect(coverCorner).not.toBe(phaseCorner);

    // Both hang off the SAME positioned box — the picture — so "opposite
    // corner" is a corner of the photograph and not of two stacked columns.
    const frame = cover.closest("[data-corner]")?.parentElement;
    expect(frame).not.toBeNull();
    expect(frame?.contains(phase)).toBe(true);
    // Whatever the thumbnail resolved to — picture, skeleton or the
    // broken-image fallback — it is the box the badges are pinned to.
    expect(frame?.querySelector('[data-testid^="cdn-tile-thumbnail"]')).not.toBeNull();

    for (const tile of screen.getAllByTestId("cdn-gallery-tile")) {
      expect(looseTextIn(tile)).toEqual([]);
    }
  });

  it("says a file was already stored ONCE, under the grid — never inside a 96px tile", async () => {
    const server = mockServer({
      "/file/exists/": { body: hit(imageRow({ hash: HASH })) },
    });
    render(
      <TestHarness server={server}>
        <MediaGalleryField max={10} />
      </TestHarness>
    );

    fireEvent.change(screen.getByTestId("cdn-gallery-drop-input"), {
      target: { files: [imageFile()] },
    });

    const notice = await screen.findByTestId("cdn-gallery-notice");
    expect(notice.textContent).toContain(cdnI18nBundleEn["cdn.outcome.deduped"]);
    // Announced, and announced once — it is the queue's outcome, not a
    // property of the corner of one photograph.
    expect(notice.getAttribute("aria-live")).toBe("polite");
    expect(screen.getAllByTestId("cdn-gallery-notice")).toHaveLength(1);

    expect(screen.queryByTestId("cdn-tile-deduped")).toBeNull();
    expect(screen.queryByTestId("cdn-tile-variants-pending")).toBeNull();
    expect(looseTextIn(screen.getByTestId("cdn-gallery-tile"))).toEqual([]);
  });

  it("the variants ladder is the grid's line too, and the tile stays a picture", async () => {
    const server = mockServer({
      "/file/exists/": { body: hit(imageRow({ hash: HASH, processed: false })) },
    });
    render(
      <TestHarness server={server}>
        <MediaGalleryField max={10} initialRefs={[`product/${HASH}`]} />
      </TestHarness>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cdn-gallery-notice").textContent).toContain(
        cdnI18nBundleEn["cdn.outcome.variants_pending"]
      );
    });
    expect(screen.queryByTestId("cdn-tile-variants-pending")).toBeNull();
    expect(looseTextIn(screen.getByTestId("cdn-gallery-tile"))).toEqual([]);
  });

  it("no outcome, no notice — the slot does not print an empty line", async () => {
    render(
      <TestHarness server={mockServer({ "/file/exists/": { body: MISS } })}>
        <MediaGalleryField max={10} initialRefs={[`product/${HASH}`]} />
      </TestHarness>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cdn-gallery-tile")).toBeTruthy();
    });
    expect(screen.queryByTestId("cdn-gallery-notice")).toBeNull();
  });
});
