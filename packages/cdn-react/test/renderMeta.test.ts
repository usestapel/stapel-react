/**
 * The `render_meta` READ — D-1, the blocker this pair's whole wave turned on.
 *
 * `toStapelImage` is the ONE boundary the fleet renders images through. Before
 * this it recomputed the geometry the server had already answered (two answers
 * to "how big is this picture", rounded differently) and hardcoded
 * `preview_b64: null` under a comment claiming stapel-cdn generated no inline
 * placeholder — false since 0.16. So the micro-preview the backend produced in
 * the same pass that stored the bytes was thrown away for every image in the
 * fleet, at the one line that could throw it away for all of them.
 *
 * These tests pin the read itself: the snapshot wins, the local arithmetic is
 * the fallback for a server that has not shipped one, and the four §83.2 facts
 * arrive at `<Image>` instead of stopping here.
 */
import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDurationMs,
  refOf,
  renderMetaToStapelImage,
  toStapelImage,
  variantsReadyAtOf,
  variantsStatusOf,
} from "../src/index.js";
import type { CdnImage, CdnMediaRow, CdnRenderMeta } from "../src/index.js";
import { fileRow, imageRow, renderMeta, videoRow } from "./fixtures.js";

const HASH = "a".repeat(64);

const asImage = (row: Record<string, unknown>): CdnImage =>
  row as unknown as CdnImage;
const asRow = (row: Record<string, unknown>): CdnMediaRow =>
  row as unknown as CdnMediaRow;
const asMeta = (meta: Record<string, unknown>): CdnRenderMeta =>
  meta as unknown as CdnRenderMeta;

describe("toStapelImage reads the snapshot", () => {
  it("takes the inline placeholder from the server instead of hardcoding null", () => {
    const meta = toStapelImage(asImage(imageRow({ hash: HASH })));
    expect(meta.preview_b64).toBe("data:image/webp;base64,UklGRg==");
    expect(meta.preview_kind).toBe("blur");
  });

  it("takes the ASPECT the server rounded, not a second one computed here", () => {
    // The row says 1600x1200; the snapshot says 1.5 — a deliberate
    // disagreement, so the test can tell which one was read. In production the
    // two agree to 6dp and it is precisely because they agree that a recompute
    // looked harmless for four minors.
    const row = imageRow({ hash: HASH });
    row["render_meta"] = renderMeta({ aspect: 1.5 });
    expect(toStapelImage(asImage(row)).aspect).toBe(1.5);
  });

  it("falls back to the row's own arithmetic for a server with no snapshot", () => {
    // A host may be running 0.15. Reading `render_meta` as possibly-absent is
    // the difference between degrading to computed geometry and rendering
    // `undefined` into a layout.
    const row = imageRow({ hash: HASH });
    delete row["render_meta"];
    const meta = toStapelImage(asImage(row));
    expect(meta.aspect).toBeCloseTo(1600 / 1200);
    expect(meta.preview_b64).toBeNull();
    expect(meta.mime).toBeNull();
  });

  it("carries mime, kind, meta_status and meta_reason through", () => {
    const row = imageRow({ hash: HASH });
    row["render_meta"] = renderMeta({
      metaStatus: "partial",
      metaReason: "preview_over_budget",
      previewB64: null,
    });
    const meta = toStapelImage(asImage(row));
    expect(meta.mime).toBe("image/jpeg");
    expect(meta.kind).toBe("image");
    expect(meta.meta_status).toBe("partial");
    expect(meta.meta_reason).toBe("preview_over_budget");
    // `preview_kind` is known while `preview_b64` is still null — that is what
    // lets a box be reserved in the right SHAPE before the preview exists.
    expect(meta.preview_b64).toBeNull();
    expect(meta.preview_kind).toBe("blur");
  });

  it("prefers the snapshot's ladder, which is the only one with `original`", () => {
    const meta = toStapelImage(asImage(imageRow({ hash: HASH })));
    expect(meta.variants.map((v) => v.tier)).toContain("original");
  });

  it("falls back to variants_meta when the snapshot carries no ladder", () => {
    const row = imageRow({ hash: HASH });
    row["render_meta"] = renderMeta({ variants: [] });
    const meta = toStapelImage(asImage(row));
    expect(meta.variants.map((v) => v.tier)).toEqual(["120", "480"]);
  });
});

describe("renderMetaToStapelImage — a ref this client did not upload", () => {
  it("takes the display url from the `original` rung when there is one", () => {
    const meta = renderMetaToStapelImage(
      asMeta(
        renderMeta({
          variants: [
            { tier: 120, branch: null, url: "/small.webp", width: 120, height: 90 },
            { tier: "original", branch: null, url: "/full.webp", width: 1600, height: 1200 },
          ],
        })
      )
    );
    expect(meta.url).toBe("/full.webp");
    expect(meta.variants).toHaveLength(2);
  });

  it("takes the largest rung when the ladder has no original", () => {
    const meta = renderMetaToStapelImage(
      asMeta(
        renderMeta({
          variants: [
            { tier: 120, branch: null, url: "/small.webp" },
            { tier: 480, branch: "w", url: "/big.webp" },
          ],
        })
      )
    );
    expect(meta.url).toBe("/big.webp");
  });

  it("leaves the url EMPTY for a medium that has none — audio, a document", () => {
    // `<Image>` reads an empty url as "nothing to load" and answers with the
    // placeholder `preview_kind` asks for. Inventing a url here is the one
    // thing this pair refuses to do: a reference is opaque.
    const meta = renderMetaToStapelImage(
      asMeta(renderMeta({ kind: "audio", previewKind: "waveform", durationMs: 7_200 }))
    );
    expect(meta.url).toBe("");
    expect(meta.kind).toBe("audio");
    expect(meta.preview_kind).toBe("waveform");
    expect(meta.duration_ms).toBe(7_200);
  });

  it("carries a video's poster, which is the only thing an <img> may load", () => {
    const row = videoRow({ hash: HASH });
    const meta = renderMetaToStapelImage(
      asMeta(row["render_meta"] as Record<string, unknown>)
    );
    expect(meta.kind).toBe("video");
    expect(meta.poster_url).toContain("/posters/");
    expect(meta.duration_ms).toBe(12_500);
  });
});

describe("refOf — the reference in order of decreasing authority", () => {
  it("reads the snapshot's own `ref`, produced by the backend's media_ref()", () => {
    expect(refOf(asRow(imageRow({ hash: HASH })), "image")).toBe(`product/${HASH}`);
  });

  it("falls back to `prefix` for an older server", () => {
    const row = imageRow({ hash: HASH });
    delete row["render_meta"];
    expect(refOf(asRow(row), "image")).toBe(`product/${HASH}`);
  });

  it("reaches a VIDEO's reference, which no serializer publishes as a prefix", () => {
    // Video rows carry neither `prefix` nor (before 0.16) anything else, so
    // this was the one model whose references were unreachable.
    expect(refOf(asRow(videoRow({ hash: HASH })), "video")).toBe(`video/${HASH}`);
    expect(refOf(asRow(fileRow({ hash: HASH })), "file")).toBe(`file/${HASH}`);
  });
});

describe("variants_status is the field the contract says to read", () => {
  it("is published by the image row and read from it", () => {
    expect(variantsStatusOf(asRow(imageRow({ hash: HASH })))).toBe("ready");
    expect(
      variantsStatusOf(asRow(imageRow({ hash: HASH, processed: false })))
    ).toBe("pending");
    expect(variantsReadyAtOf(asRow(imageRow({ hash: HASH })))).toBe(
      "2026-08-22T10:00:05Z"
    );
  });

  it("is NULL — not a guessed 'ready' — for the two models with no ladder", () => {
    expect(variantsStatusOf(asRow(videoRow({ hash: HASH })))).toBeNull();
    expect(variantsStatusOf(asRow(fileRow({ hash: HASH })))).toBeNull();
  });
});

describe("the two numbers a person reads", () => {
  it("formats a duration as a clock, flooring the seconds", () => {
    expect(formatDurationMs(7_000)).toBe("0:07");
    expect(formatDurationMs(243_000)).toBe("4:03");
    expect(formatDurationMs(3_750_000)).toBe("1:02:30");
    expect(formatDurationMs(59_600)).toBe("0:59");
  });

  it("keeps UNMEASURED and EMPTY apart, because the contract does", () => {
    // `null` is "no probe ran"; `0` is a real, measured, empty recording.
    expect(formatDurationMs(null)).toBeNull();
    expect(formatDurationMs(undefined)).toBeNull();
    expect(formatDurationMs(0)).toBe("0:00");
  });

  it("splits a byte count into a number and a UNIT NAME, never a string", () => {
    expect(formatBytes(512, "en")).toEqual({ value: "512", unit: "b" });
    expect(formatBytes(1024, "en")).toEqual({ value: "1", unit: "kb" });
    expect(formatBytes(1_500_000, "en")).toEqual({ value: "1.4", unit: "mb" });
    // The unit is a key suffix so the locale can spell it; the NUMBER is
    // Intl's, so a locale that writes 1,4 writes 1,4.
    expect(formatBytes(1_500_000, "ru")?.value).toBe("1,4");
    expect(formatBytes(null, "en")).toBeNull();
  });
});
