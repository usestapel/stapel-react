/**
 * The antd skin: a control that is off says why, a dedup hit says so, and no
 * UI string is a literal.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageUploadField, MediaGalleryField } from "../src/default/index.js";
import { cdnI18nBundleEn } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { imageFile, imageRow, MISS, uploaded } from "./fixtures.js";

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

    expect(screen.getByTestId("cdn-gallery-drop-pick")).toHaveProperty("disabled", true);
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
