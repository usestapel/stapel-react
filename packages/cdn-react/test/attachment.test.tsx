/**
 * The READ side of the pair, skinned: the four arms of `<MediaAttachment/>`,
 * the video/document intake, and the drop target both of them stand on.
 *
 * The claims under test are the ones a reviewer cannot see in a screenshot:
 * that a video never reaches an `<img src="clip.mp4">`, that a resolved-to-
 * nothing reference says so instead of failing, that a snapshot handed in costs
 * no request, and that the count agrees with its noun.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MediaAttachment, MediaGalleryField, MediaUploadField } from "../src/default/index.js";
import { createI18n } from "@stapel/core";
import { CDN_I18N_KEYS, cdnI18nBundleEn } from "../src/index.js";
import { cdnI18nBundleRu } from "../src/i18n/ru.js";
import type { CdnRenderMeta } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import {
  describeResponse,
  documentFile,
  fileRow,
  imageRow,
  renderMeta,
  uploadedFile,
  uploadedVideo,
  videoFile,
  videoRow,
  MISS,
} from "./fixtures.js";

const HASH = "a".repeat(64);
const IMAGE_REF = `product/${HASH}`;
const VIDEO_REF = `video/${HASH}`;
const FILE_REF = `file/${HASH}`;
const GONE = `product/${"c".repeat(64)}`;

const asMeta = (meta: Record<string, unknown>): CdnRenderMeta =>
  meta as unknown as CdnRenderMeta;

const quiet = () => mockServer({});

describe("<MediaAttachment/> — the arms are the media kind", () => {
  it("draws an image from the ladder, with the server's own placeholder", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaAttachment
          mediaRef={IMAGE_REF}
          meta={asMeta(renderMeta({ ref: IMAGE_REF }))}
        />
      </TestHarness>
    );
    expect(screen.getByTestId("cdn-attachment-image")).toBeTruthy();
    // The size line proves the snapshot was READ, not merely accepted: `bytes`
    // exists nowhere but `render_meta`.
    expect(screen.getByTestId("cdn-attachment-size").textContent).toBe("1 KB");
  });

  it("never puts a video in an <img>: the poster is what is loadable", () => {
    const meta = asMeta(
      videoRow({ hash: HASH })["render_meta"] as Record<string, unknown>
    );
    const { container } = render(
      <TestHarness server={quiet()}>
        <MediaAttachment mediaRef={VIDEO_REF} meta={meta} />
      </TestHarness>
    );
    expect(screen.getByTestId("cdn-attachment-video")).toBeTruthy();
    for (const img of container.querySelectorAll("img")) {
      expect(img.getAttribute("src") ?? "").not.toContain(".mp4");
    }
    // The length is a clock reading, not `12500`.
    expect(screen.getByTestId("cdn-attachment-duration").textContent).toBe("0:12");
  });

  it("says a clip was never MEASURED rather than calling it empty", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaAttachment
          mediaRef={`audio/${HASH}`}
          meta={asMeta(
            renderMeta({ kind: "audio", previewKind: "waveform", durationMs: null })
          )}
        />
      </TestHarness>
    );
    expect(screen.getByTestId("cdn-attachment-duration").textContent).toBe(
      cdnI18nBundleEn["cdn.attachment.duration_unmeasured"]
    );
  });

  it("draws a document as facts, not as a broken picture", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaAttachment
          mediaRef={FILE_REF}
          meta={asMeta(fileRow({ hash: HASH })["render_meta"] as Record<string, unknown>)}
          href="https://cdn.test/media/cdn/files/aaaaaaaa.pdf"
        />
      </TestHarness>
    );
    expect(screen.getByTestId("cdn-attachment-ext").textContent).toBe("PDF");
    // 250 000 bytes with a BINARY step, the same one the backend writes its
    // ceilings in — decimal steps would show 21.0 MB for a file the server
    // refuses at "20 MB".
    expect(screen.getByTestId("cdn-attachment-size").textContent).toBe("244 KB");
    expect(screen.getByTestId("cdn-attachment-download")).toBeTruthy();
  });

  it("offers no open control for a snapshot that carries no url, rather than inventing one", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaAttachment
          mediaRef={FILE_REF}
          meta={asMeta(fileRow({ hash: HASH })["render_meta"] as Record<string, unknown>)}
        />
      </TestHarness>
    );
    expect(screen.queryByTestId("cdn-attachment-download")).toBeNull();
  });

  it("names an incomplete snapshot AND quotes the pipeline's own reason", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaAttachment
          mediaRef={IMAGE_REF}
          meta={asMeta(
            renderMeta({
              metaStatus: "partial",
              metaReason: "preview_over_budget",
              previewB64: null,
            })
          )}
        />
      </TestHarness>
    );
    expect(screen.getByTestId("cdn-attachment-meta-status").textContent).toContain(
      cdnI18nBundleEn["cdn.attachment.meta_partial"]
    );
    expect(screen.getByTestId("cdn-attachment-meta-reason").textContent).toBe(
      "preview_over_budget"
    );
  });

  it("a snapshot handed in costs NO request — the parent already asked", () => {
    const server = mockServer({ "/describe/": { body: describeResponse({}) } });
    render(
      <TestHarness server={server}>
        <MediaAttachment mediaRef={IMAGE_REF} meta={asMeta(renderMeta({ ref: IMAGE_REF }))} />
      </TestHarness>
    );
    expect(server.count("/describe/")).toBe(0);
  });
});

describe("<MediaAttachment/> — resolving a bare reference", () => {
  it("reserves the slot's shape while describe is in flight", () => {
    const server = mockServer({
      "/describe/": { body: describeResponse({ [IMAGE_REF]: renderMeta({ ref: IMAGE_REF }) }) },
    });
    render(
      <TestHarness server={server}>
        <MediaAttachment mediaRef={IMAGE_REF} />
      </TestHarness>
    );
    // Before the snapshot lands NOTHING is known — not even the medium — so
    // this is the one movement the component cannot remove, and it holds a box
    // rather than collapsing to zero and pushing the page around later.
    expect(screen.getByTestId("cdn-attachment-reserved")).toBeTruthy();
  });

  it("resolves and draws what came back", async () => {
    const server = mockServer({
      "/describe/": { body: describeResponse({ [IMAGE_REF]: renderMeta({ ref: IMAGE_REF }) }) },
    });
    render(
      <TestHarness server={server}>
        <MediaAttachment mediaRef={IMAGE_REF} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("cdn-attachment-image")).toBeTruthy();
    });
    expect(server.count("/describe/")).toBe(1);
  });

  it("says a dead reference is GONE — a different sentence from 'we could not ask'", async () => {
    const server = mockServer({
      "/describe/": { body: describeResponse({}, [GONE]) },
    });
    render(
      <TestHarness server={server}>
        <MediaAttachment mediaRef={GONE} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("cdn-attachment-missing")).toBeTruthy();
    });
    expect(screen.getByTestId("cdn-attachment-missing").textContent).toContain(
      cdnI18nBundleEn["cdn.attachment.missing"]
    );
  });

  it("offers a retry when the ASKING failed, not a 'gone'", async () => {
    const server = mockServer({
      "/describe/": { status: 500, body: { localizable_error: "error.500.x", error: "x" } },
    });
    render(
      <TestHarness server={server}>
        <MediaAttachment mediaRef={IMAGE_REF} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("cdn-attachment-load-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("cdn-attachment-missing")).toBeNull();
  });

  it("self-themes from the live document rather than a hardcoded side", async () => {
    render(
      <TestHarness server={quiet()}>
        <MediaAttachment mediaRef={IMAGE_REF} meta={asMeta(renderMeta({ ref: IMAGE_REF }))} />
      </TestHarness>
    );
    const root = screen.getByTestId("cdn-attachment");
    expect(root.getAttribute("data-stapel-skin-mode")).toBe("light");
    document.documentElement.setAttribute("data-theme", "dark");
    await act(async () => {
      await Promise.resolve();
    });
    expect(root.getAttribute("data-stapel-skin-mode")).toBe("dark");
    document.documentElement.removeAttribute("data-theme");
    await act(async () => {
      await Promise.resolve();
    });
  });
});

describe("<MediaUploadField/> — the two intakes that had no widget", () => {
  it("uploads a video and draws the result from the snapshot it already has", async () => {
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/video/": { status: 201, body: uploadedVideo(videoRow({ hash: HASH })) },
    });
    const refs: string[] = [];
    render(
      <TestHarness server={server}>
        <MediaUploadField kind="video" onUploaded={(ref) => refs.push(ref)} />
      </TestHarness>
    );

    fireEvent.change(screen.getByTestId("cdn-video-drop-input"), {
      target: { files: [videoFile()] },
    });

    await waitFor(() => {
      expect(refs).toEqual([VIDEO_REF]);
    });
    // The result is the attachment renderer over the snapshot the upload
    // response carried: no describe request follows an upload.
    expect(server.count("/describe/")).toBe(0);
    expect(screen.getByTestId("cdn-attachment-video")).toBeTruthy();
  });

  it("validates a document against the DOCUMENT ceilings, not the image ones", async () => {
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/file/": { status: 201, body: uploadedFile(fileRow({ hash: HASH })) },
    });
    const refs: string[] = [];
    render(
      <TestHarness server={server}>
        <MediaUploadField kind="file" onUploaded={(ref) => refs.push(ref)} />
      </TestHarness>
    );

    const input = screen.getByTestId("cdn-file-drop-input") as HTMLInputElement;
    // The `accept` string is built from the same allowlist the refusal is, so
    // the picker and the gate cannot disagree.
    expect(input.getAttribute("accept")).toContain(".pdf");
    expect(input.getAttribute("accept")).not.toContain(".jpg");

    fireEvent.change(input, { target: { files: [documentFile()] } });
    await waitFor(() => {
      expect(refs).toEqual([FILE_REF]);
    });
    expect(screen.getByTestId("cdn-attachment-document")).toBeTruthy();
  });

  it("announces the step in a live region instead of only painting it", async () => {
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/video/": { status: 201, body: uploadedVideo(videoRow({ hash: HASH })) },
    });
    render(
      <TestHarness server={server}>
        <MediaUploadField kind="video" />
      </TestHarness>
    );
    const phase = screen.getByTestId("cdn-video-phase");
    expect(phase.getAttribute("aria-live")).toBe("polite");
    fireEvent.change(screen.getByTestId("cdn-video-drop-input"), {
      target: { files: [videoFile()] },
    });
    await waitFor(() => {
      expect(phase.textContent).toBe(cdnI18nBundleEn["cdn.phase.done"]);
    });
  });
});

describe("the drop target", () => {
  it("gives the hidden input the <label> association it never had", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaUploadField kind="file" />
      </TestHarness>
    );
    const input = screen.getByTestId("cdn-file-drop-input");
    const frame = screen.getByTestId("cdn-file-drop-frame");
    expect(frame.tagName.toLowerCase()).toBe("label");
    expect(frame.getAttribute("for")).toBe(input.getAttribute("id"));
  });

  it("takes a DROP, which is the affordance the control was missing entirely", async () => {
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/file/": { status: 201, body: uploadedFile(fileRow({ hash: HASH })) },
    });
    const refs: string[] = [];
    render(
      <TestHarness server={server}>
        <MediaUploadField kind="file" onUploaded={(ref) => refs.push(ref)} />
      </TestHarness>
    );
    const zone = screen.getByTestId("cdn-file-drop");
    fireEvent.dragOver(zone);
    expect(zone.getAttribute("data-dragging")).toBe("true");
    fireEvent.drop(zone, { dataTransfer: { files: [documentFile()] } });
    await waitFor(() => {
      expect(refs).toEqual([FILE_REF]);
    });
  });
});

describe("the gallery counts in words that agree with the number", () => {
  it("says 'photo' for one and 'photos' for ten", () => {
    const { unmount } = render(
      <TestHarness server={quiet()}>
        <MediaGalleryField max={1} />
      </TestHarness>
    );
    expect(screen.getByTestId("cdn-gallery-count").textContent).toBe("0 of 1 photo");
    unmount();

    render(
      <TestHarness server={quiet()}>
        <MediaGalleryField max={10} />
      </TestHarness>
    );
    expect(screen.getByTestId("cdn-gallery-count").textContent).toBe("0 of 10 photos");
  });

  it("selects the form with Intl.PluralRules, not with `n === 1`", () => {
    // English is the language a hand-rolled ternary is right in, which is why
    // the check has to be made somewhere the categories differ. Russian has
    // four; `tPlural` asks Intl for which one, and the family answers.
    const engine = createI18n({ locale: "ru" });
    engine.registerBundle("ru", cdnI18nBundleRu);
    expect(engine.tPlural(CDN_I18N_KEYS.galleryCount, { count: 1, used: 1, max: 1 })).toBe(
      cdnI18nBundleRu["cdn.gallery.count.one"]?.replace(/\{used\}/, "1").replace(/\{max\}/, "1")
    );
    expect(
      engine.tPlural(CDN_I18N_KEYS.galleryCount, { count: 5, used: 0, max: 5 })
    ).not.toContain("cdn.gallery.count");
  });

  it("shows the empty gallery as a designed state inside the drop target", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaGalleryField max={10} />
      </TestHarness>
    );
    const empty = screen.getByTestId("cdn-gallery-empty");
    expect(empty.getAttribute("data-stapel-empty")).not.toBeNull();
    expect(empty.textContent).toContain(cdnI18nBundleEn["cdn.gallery.empty_hint"]);
  });

  it("shows the ROW's variants_status while the ladder's URLs are a prediction", async () => {
    const server = mockServer({ "/file/exists/": { body: MISS } });
    render(
      <TestHarness server={server}>
        <MediaGalleryField max={10} initialRefs={[IMAGE_REF]} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(server.count("/file/exists/")).toBe(1);
    });
    // Resolved to nothing: no row and therefore no status. The absence is the
    // honest answer, not a "pending" invented for a tile nobody uploaded.
    expect(screen.queryByTestId("cdn-tile-variants-pending")).toBeNull();
  });

  it("keeps the tile controls at the skin's own size, not `small`", () => {
    render(
      <TestHarness server={mockServer({ "/file/exists/": { body: MISS } })}>
        <MediaGalleryField max={10} initialRefs={[IMAGE_REF]} />
      </TestHarness>
    );
    // `size="small"` opted every tile control out of the 44px phone rule
    // `SkinTheme` exists to apply, on the surface that rule is for.
    for (const id of ["cdn-tile-remove", "cdn-tile-earlier", "cdn-tile-later"]) {
      expect(screen.getByTestId(id).className).not.toContain("ant-btn-sm");
    }
  });
});

describe("the image slot is a slot", () => {
  it("renders the phase only once something is happening", () => {
    render(
      <TestHarness server={quiet()}>
        <MediaGalleryField max={10} />
      </TestHarness>
    );
    // "Waiting its turn" under an untouched control described a queue position
    // for something that was never queued.
    expect(screen.queryByTestId("cdn-image-phase")).toBeNull();
  });

  it("reads the ROW's variants_status after an upload, not is_processed", async () => {
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": {
        status: 201,
        body: { image: imageRow({ hash: HASH, processed: false }), message: "ok" },
      },
    });
    const { ImageUploadField } = await import("../src/default/index.js");
    render(
      <TestHarness server={server}>
        <ImageUploadField />
      </TestHarness>
    );
    fireEvent.change(screen.getByTestId("cdn-image-input"), {
      target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => {
      expect(screen.getByTestId("cdn-image-variants-pending")).toBeTruthy();
    });
  });
});
