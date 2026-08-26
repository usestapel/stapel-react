/**
 * The variant ladder is produced by a background task, so the flow waits for
 * it — bounded, and honest about what happened when the budget runs out.
 */
import { describe, expect, it } from "vitest";
import { runUpload, smallestVariantUrl, toStapelImage, CDN_DEFAULT_LIMITS } from "../src/index.js";
import type { CdnImage } from "../src/index.js";
import { createHarnessRuntime, mockServer } from "./harness.js";
import { hashOf, hit, imageFile, imageRow, MISS, uploaded } from "./fixtures.js";

const limits = CDN_DEFAULT_LIMITS.image;
const immediate = { attempts: 8, intervalMs: 0, wait: (): Promise<void> => Promise.resolve() };

describe("waiting for the ladder", () => {
  it("polls file/exists/ until the row reports is_processed", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    let checks = 0;
    const server = mockServer({
      "/file/exists/": () => {
        checks += 1;
        // 1: the pre-check (a miss). 2-3: still processing. 4: ready.
        if (checks === 1) return { body: MISS };
        return {
          body: hit(imageRow({ hash, processed: checks >= 4 })),
        };
      },
      "/upload/image/": {
        status: 201,
        body: uploaded(imageRow({ hash, processed: false })),
      },
    });
    const runtime = createHarnessRuntime({ server, variants: immediate });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
      variants: immediate,
    });

    expect(outcome.variantsReady).toBe(true);
    expect((outcome.row as { variants_meta: unknown[] }).variants_meta).toHaveLength(2);
    expect(checks).toBe(4);
  });

  it("gives up after the budget and reports variantsReady:false — the reference is still valid", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    let checks = 0;
    const server = mockServer({
      "/file/exists/": () => {
        checks += 1;
        return checks === 1
          ? { body: MISS }
          : { body: hit(imageRow({ hash, processed: false })) };
      },
      "/upload/image/": {
        status: 201,
        body: uploaded(imageRow({ hash, processed: false })),
      },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
      variants: { attempts: 2, intervalMs: 0, wait: () => Promise.resolve() },
    });

    expect(outcome.variantsReady).toBe(false);
    expect(outcome.ref).toBe(`product/${hash}`);
    // A stated outcome, not a hang: exactly the budget, then stop.
    expect(server.count("/file/exists/")).toBe(3);
  });

  it("a failing poll ends the wait instead of failing a stored upload", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    let checks = 0;
    const server = mockServer({
      "/file/exists/": () => {
        checks += 1;
        return checks === 1 ? { body: MISS } : { status: 503, body: {} };
      },
      "/upload/image/": {
        status: 201,
        body: uploaded(imageRow({ hash, processed: false })),
      },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
      variants: immediate,
    });

    expect(outcome.ref).toBe(`product/${hash}`);
    expect(outcome.variantsReady).toBe(false);
  });

  it("`attempts: 0` does not wait at all", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": {
        status: 201,
        body: uploaded(imageRow({ hash, processed: false })),
      },
    });
    const runtime = createHarnessRuntime({ server });

    await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
      variants: { attempts: 0 },
    });

    expect(server.count("/file/exists/")).toBe(1);
  });
});

describe("the ladder is read from variants_meta, never from the flat fields", () => {
  it("an unprocessed row has flat URLs but no variants — and yields no thumbnail", () => {
    const row = imageRow({ hash: "a".repeat(64), processed: false }) as unknown as CdnImage;
    expect(row.variant_120_url).toBeTruthy();
    expect(smallestVariantUrl(row)).toBeNull();
  });

  it("the smallest generated tier wins", () => {
    const row = imageRow({ hash: "a".repeat(64) }) as unknown as CdnImage;
    expect(smallestVariantUrl(row)).toContain("/120/");
  });
});

describe("handing the row to @stapel/image", () => {
  it("stringifies the tier — the two contracts spell it differently", () => {
    const row = imageRow({ hash: "a".repeat(64) }) as unknown as CdnImage;
    const meta = toStapelImage(row);
    // `original` is here because the LADDER READ NOW PREFERS `render_meta`,
    // which is the only list carrying that rung — past the top of the ladder no
    // tier avoids an upscale, so a hero rendered from `variants_meta` alone
    // could never be served. Both spellings of `tier` arrive in that one array
    // (an int for the rungs, the string sentinel for `original`) and both come
    // out as the decimal string `@stapel/image` wants.
    expect(meta.variants.map((variant) => variant.tier)).toEqual([
      "120",
      "480",
      "original",
    ]);
    expect(meta.variants[0]?.branch).toBeNull();
    expect(meta.variants[1]?.branch).toBe("w");
  });

  it("carries the geometry so a slot can be reserved before the pixels arrive", () => {
    const row = imageRow({ hash: "a".repeat(64) }) as unknown as CdnImage;
    const meta = toStapelImage(row);
    expect(meta.source).toBe("cdn");
    expect(meta.aspect).toBeCloseTo(1600 / 1200);
    expect(meta.square).toBe(false);
    // D-1, the blocker: this used to be a hardcoded `null` under a comment
    // claiming stapel-cdn generated no placeholder — false since 0.16, and
    // false at the ONE boundary the whole fleet renders images through.
    expect(meta.preview_b64).toBe("data:image/webp;base64,UklGRg==");
    expect(meta.preview_kind).toBe("blur");
  });
});
