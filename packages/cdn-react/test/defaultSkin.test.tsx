/**
 * The antd skin: a control that is off says why, a dedup hit says so, and no
 * UI string is a literal.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageUploadField, MediaGalleryField } from "../src/default/index.js";
import {
  COVER_CORNER,
  galleryColumns,
  MOVE_CORNER,
  PHASE_CORNER,
  REMOVE_CORNER,
} from "../src/default/MediaGalleryField.js";
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

/**
 * THE GRID (0.4.5). The demo's second screen showed one 96px thumbnail alone
 * in a full-width dashed box with three stacked word buttons under it and the
 * badges hanging off the picture's edges. The ruling: square tiles in a grid
 * whose column count comes from the CONTAINER's width, an add tile of the
 * same size carrying the only dashed border, and every badge and control
 * overlaid inside the picture.
 */
describe("<MediaGalleryField/> — a grid of square tiles", () => {
  /** Drive a real container width through `useElementWidth`'s synchronous
   * first read: jsdom lays nothing out, so the measurement has to be stated. */
  function atWidth(width: number): () => void {
    const real = Element.prototype.getBoundingClientRect;
    const spy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const rect = real.call(this) as DOMRect;
        if (this.getAttribute("data-testid") !== "cdn-gallery-grid") return rect;
        return { ...rect, width, toJSON: () => ({}) } as DOMRect;
      });
    return () => {
      spy.mockRestore();
    };
  }

  function grid(): HTMLElement {
    return screen.getByTestId("cdn-gallery-grid");
  }

  it.each([
    [320, 3],
    [479, 3],
    [480, 4],
    [767, 4],
    [768, 6],
    [1440, 6],
  ])("lays %ipx of container out in %i columns", (width, columns) => {
    const restore = atWidth(width);
    try {
      render(
        <TestHarness server={storing()}>
          <MediaGalleryField max={10} />
        </TestHarness>
      );
      expect(grid().getAttribute("data-columns")).toBe(String(columns));
      expect(grid().style.gridTemplateColumns).toBe(
        `repeat(${String(columns)}, minmax(96px, 1fr))`
      );
    } finally {
      restore();
    }
  });

  it("answers with the NARROW arm while the container is unmeasured", () => {
    // No ResizeObserver in jsdom and a zero-width first read: the grid does
    // not know yet, and three columns is the arm that fits everywhere. A
    // wide default here would reflow on the composer's first frame.
    expect(galleryColumns(undefined)).toBe(3);
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField max={10} />
      </TestHarness>
    );
    expect(grid().getAttribute("data-columns")).toBe("3");
  });

  it("puts the add tile in the grid, LAST, and gives it the only dashed edge", async () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField
          max={10}
          initialRefs={[`product/${HASH}`, `product/${"b".repeat(64)}`]}
        />
      </TestHarness>
    );

    const cells = Array.from(grid().children);
    expect(cells).toHaveLength(3); // two photos + the add tile
    expect(cells.at(-1)).toBe(screen.getByTestId("cdn-gallery-add"));
    // The picker is a real button (keyboard-reachable — a <label> is not),
    // and it is the thing carrying the dashed border.
    const pick = screen.getByTestId("cdn-gallery-drop-pick");
    expect(pick.tagName).toBe("BUTTON");
    expect(pick.style.border).toContain("dashed");
    expect(pick.getAttribute("aria-label")).toBe(cdnI18nBundleEn["cdn.pick.images"]);
    // …and no photo tile carries one.
    for (const tile of screen.getAllByTestId("cdn-gallery-tile")) {
      expect(tile.style.border).toBe("");
    }
  });

  it("keeps every cell square, filling its column, never under the floor", () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField max={10} initialRefs={[`product/${HASH}`]} />
      </TestHarness>
    );
    for (const cell of [
      screen.getByTestId("cdn-gallery-tile"),
      screen.getByTestId("cdn-gallery-add"),
    ]) {
      expect(cell.style.aspectRatio).toBe("1 / 1");
      expect(cell.style.inlineSize).toBe("100%");
      expect(cell.style.minInlineSize).toBe("96px");
    }
    /* …and the picker actually FILLS its square. The gate puts a wrapper
       between the cell and the button, and a wrapper with no height leaves
       the button at its content size — a wide, 28px-tall strip where a
       square was declared, which is what the first build of this grid
       shipped. */
    const pick = screen.getByTestId("cdn-gallery-drop-pick");
    expect(pick.style.blockSize).toBe("100%");
    const wrapper = screen.getByTestId("cdn-gallery-drop-pick-gate");
    expect(wrapper.style.blockSize).toBe("100%");
    expect(screen.getByTestId("cdn-gallery-add").contains(wrapper)).toBe(true);
  });

  it("draws no move arrows on a gallery with one photo — there is no order", () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField max={10} initialRefs={[`product/${HASH}`]} />
      </TestHarness>
    );
    expect(screen.getAllByTestId("cdn-gallery-tile")).toHaveLength(1);
    // Two permanently dimmed arrows over the only picture on the composer's
    // first screen are two dead controls, not an affordance.
    expect(screen.queryByTestId("cdn-tile-earlier")).toBeNull();
    expect(screen.queryByTestId("cdn-tile-later")).toBeNull();
    // Remove and the cover mark are still there: those mean something at one.
    expect(screen.getByTestId("cdn-tile-remove")).toBeTruthy();
    expect(screen.getByTestId("cdn-tile-cover")).toBeTruthy();
  });

  it("overlays every badge and control INSIDE the picture, one per corner", () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField
          max={10}
          initialRefs={[`product/${HASH}`, `product/${"b".repeat(64)}`]}
        />
      </TestHarness>
    );

    const tile = screen.getAllByTestId("cdn-gallery-tile")[0] as HTMLElement;
    // The tile IS the positioned box now — the picture fills it, so "inside
    // the picture" and "inside the cell" are the same statement.
    expect(tile.style.position).toBe("relative");

    const where = (testId: string): HTMLElement => {
      const owner = screen.getAllByTestId(testId)[0]?.closest("[data-corner]");
      expect(owner, `${testId} is not in a corner`).not.toBeNull();
      return owner as HTMLElement;
    };
    const corners: Record<string, string> = {
      "cdn-tile-cover": COVER_CORNER,
      "cdn-tile-remove": REMOVE_CORNER,
      "cdn-tile-earlier": MOVE_CORNER,
      "cdn-tile-later": MOVE_CORNER,
      "cdn-tile-phase": PHASE_CORNER,
    };
    for (const [testId, expected] of Object.entries(corners)) {
      const slot = where(testId);
      expect(slot.getAttribute("data-corner")).toBe(expected);
      // jsdom measures nothing, so the assertion that means something is the
      // positioning itself: absolute, at an inset, inside this tile.
      expect(slot.style.position).toBe("absolute");
      expect(
        slot.style.insetBlockStart || slot.style.insetBlockEnd
      ).not.toBe("");
      expect(
        slot.style.insetInlineStart || slot.style.insetInlineEnd
      ).not.toBe("");
      expect(tile.contains(slot)).toBe(true);
    }
    // Four distinct corners — a badge stacked on a control is the overlap
    // this layout exists to avoid.
    expect(new Set(Object.values(corners)).size).toBe(4);
  });

  it("carries the words on the icon controls, where a screen reader finds them", () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField
          max={10}
          initialRefs={[`product/${HASH}`, `product/${"b".repeat(64)}`]}
        />
      </TestHarness>
    );
    const labels: Record<string, string> = {
      "cdn-tile-remove": cdnI18nBundleEn["cdn.item.remove"] as string,
      "cdn-tile-earlier": cdnI18nBundleEn["cdn.item.move_earlier"] as string,
      "cdn-tile-later": cdnI18nBundleEn["cdn.item.move_later"] as string,
    };
    for (const [testId, label] of Object.entries(labels)) {
      const button = screen.getAllByTestId(testId)[0] as HTMLElement;
      expect(button.getAttribute("aria-label")).toBe(label);
      // Icon-only: the glyph is decorative, the name is the label.
      expect(button.textContent?.trim()).not.toBe(label);
      expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
    // The cover badge is the icon-only arm of the same rule — the star is
    // decorative and the words are in the accessibility tree.
    const cover = screen.getByTestId("cdn-tile-cover");
    expect(cover.textContent).toContain(cdnI18nBundleEn["cdn.item.cover"]);
  });

  it("shows a switched-off arrow dimmed rather than taking it away", () => {
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField
          max={10}
          initialRefs={[`product/${HASH}`, `product/${"b".repeat(64)}`]}
        />
      </TestHarness>
    );
    // The first tile cannot move earlier and the last cannot move later —
    // both are still on screen, so the pair of arrows does not move under
    // the finger as tiles are reordered.
    const earlier = screen.getAllByTestId("cdn-tile-earlier");
    const later = screen.getAllByTestId("cdn-tile-later");
    expect(earlier).toHaveLength(2);
    expect(later).toHaveLength(2);
    expect((earlier[0] as HTMLButtonElement).disabled).toBe(true);
    expect((earlier[0] as HTMLElement).style.opacity).toBe("0.45");
    expect((earlier[1] as HTMLButtonElement).disabled).toBe(false);
    expect((later[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("outlines the whole grid on a drag, and takes the files dropped on it", async () => {
    const changed: string[][] = [];
    render(
      <TestHarness server={storing()}>
        <MediaGalleryField max={10} onRefsChange={(refs) => changed.push([...refs])} />
      </TestHarness>
    );

    fireEvent.dragOver(grid(), { dataTransfer: { files: [] } });
    expect(grid().getAttribute("data-dragging")).toBe("true");
    expect(grid().style.outline).not.toBe("none");

    fireEvent.drop(grid(), { dataTransfer: { files: [imageFile()] } });
    await waitFor(() => {
      expect(changed.at(-1)).toEqual([`product/${HASH}`]);
    });
    expect(grid().getAttribute("data-dragging")).toBe("false");
  });
});
