/**
 * The client-side mirror: refuse early, in the backend's own vocabulary, and
 * never refuse what the backend would accept.
 */
import { describe, expect, it } from "vitest";
import {
  acceptAttribute,
  CDN_DEFAULT_LIMITS,
  fileExtension,
  resolveCdnLimits,
  runUpload,
  validateFile,
} from "../src/index.js";
import { createHarnessRuntime, mockServer } from "./harness.js";
import { bigImageFile, imageFile } from "./fixtures.js";

const limits = CDN_DEFAULT_LIMITS.image;

describe("the size ceiling (spec §8.2 — over the limit)", () => {
  it("refuses over MAX_IMAGE_SIZE with cdn's own 413 code, before any request", async () => {
    const server = mockServer({});
    const runtime = createHarnessRuntime({ server });
    const over = bigImageFile(limits.maxBytes + 1);

    await expect(
      runUpload(runtime.api, over, { target: { kind: "image" }, limits })
    ).rejects.toMatchObject({ code: "error.413.file_too_large", status: 413 });

    // The whole point of mirroring: the bytes never left.
    expect(server.calls).toHaveLength(0);
  });

  it("a file exactly AT the ceiling is accepted — the backend's test is `>`", () => {
    const exact = bigImageFile(limits.maxBytes);
    expect(validateFile(exact, limits)).toBeNull();
  });

  it("an empty pick is `error.400.no_file`, not a size failure", () => {
    const empty = new File([], "nothing.jpg", { type: "image/jpeg" });
    expect(validateFile(empty, limits)?.code).toBe("error.400.no_file");
  });
});

describe("the extension allowlist", () => {
  it("refuses an extension outside ALLOWED_IMAGE_EXTENSIONS", () => {
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    expect(validateFile(svg, limits)?.code).toBe("error.400.invalid_format");
  });

  it("is case-insensitive, as the backend's `os.path.splitext(...).lower()` is", () => {
    expect(validateFile(imageFile("PHOTO.JPG"), limits)).toBeNull();
    expect(fileExtension("PHOTO.JPG")).toBe(".jpg");
  });

  it("a name with no extension at all is refused, not waved through", () => {
    expect(validateFile(imageFile("photo"), limits)?.code).toBe(
      "error.400.invalid_format"
    );
  });
});

describe("MIME is only checked where the backend checks it", () => {
  it("the generic-file intake narrows on MIME", () => {
    const odd = new File(["x"], "doc.pdf", { type: "application/x-evil" });
    expect(validateFile(odd, CDN_DEFAULT_LIMITS.file)?.code).toBe(
      "error.400.invalid_format"
    );
  });

  it("a BLANK Content-Type passes — it is not evidence of a bad file", () => {
    const noType = new File(["x"], "doc.pdf", { type: "" });
    expect(validateFile(noType, CDN_DEFAULT_LIMITS.file)).toBeNull();
  });

  it("the image intake has no MIME list at all, so a browser's guess cannot block a valid photo", () => {
    const weirdType = new File(["x"], "photo.heic", { type: "application/octet-stream" });
    expect(CDN_DEFAULT_LIMITS.image.mimeTypes).toBeUndefined();
    expect(validateFile(weirdType, CDN_DEFAULT_LIMITS.image)).toBeNull();
  });
});

describe("the mirror is configurable, because the backend's ceilings are settings", () => {
  it("a deployment that RAISED MAX_IMAGE_SIZE is not refused by a stale constant", () => {
    const raised = resolveCdnLimits({ image: { maxBytes: 40 * 1024 * 1024 } });
    const file = bigImageFile(30 * 1024 * 1024);
    expect(validateFile(file, raised.image)).toBeNull();
    expect(validateFile(file, CDN_DEFAULT_LIMITS.image)?.code).toBe(
      "error.413.file_too_large"
    );
  });

  it("an override of one intake leaves the others at their defaults", () => {
    const merged = resolveCdnLimits({ image: { maxBytes: 1 } });
    expect(merged.image.extensions).toEqual(CDN_DEFAULT_LIMITS.image.extensions);
    expect(merged.video.maxBytes).toBe(CDN_DEFAULT_LIMITS.video.maxBytes);
    expect(merged.file.mimeTypes).toEqual(CDN_DEFAULT_LIMITS.file.mimeTypes);
  });
});

describe("the picker and the gate cannot disagree", () => {
  it("`accept` is built from the same allowlist the refusal is built from", () => {
    expect(acceptAttribute(CDN_DEFAULT_LIMITS.image)).toBe(
      CDN_DEFAULT_LIMITS.image.extensions.join(",")
    );
    expect(acceptAttribute(CDN_DEFAULT_LIMITS.file)).toContain("application/pdf");
  });
});
