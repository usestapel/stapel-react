/**
 * An image upload always names its asset type — there is no silent default.
 *
 * The generic intake used to store the FIRST configured asset type when the
 * client named none, so every photo a listing composer attached was filed as
 * an avatar: wrong policies, no watermark. The type now travels with the
 * bytes, and a caller that forgets it fails before a byte moves.
 */
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { requireTarget, runUpload, useUploadQueue, CDN_DEFAULT_LIMITS } from "../src/index.js";
import type { CdnUploadTarget } from "../src/index.js";
import { createHarnessRuntime, mockServer, TestHarness } from "./harness.js";
import { hashOf, imageFile, imageRow, MISS, uploaded } from "./fixtures.js";

const limits = CDN_DEFAULT_LIMITS.image;

describe("image uploads carry their asset type", () => {
  it("sends the named type with the file, and the ref carries it", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image", assetType: "product" },
      limits,
    });

    const post = server.calls.find((call) => call.url.includes("/upload/image/"));
    expect(post?.assetType).toBe("product");
    expect(outcome.ref).toBe(`product/${hash}`);
  });

  it("an image target without an asset type is refused before any request", async () => {
    const server = mockServer({ "/file/exists/": { body: MISS } });
    const runtime = createHarnessRuntime({ server });

    await expect(
      runUpload(runtime.api, imageFile(), {
        target: { kind: "image" } as unknown as CdnUploadTarget,
        limits,
      })
    ).rejects.toThrow(/assetType/);
    expect(server.count("/upload/image/")).toBe(0);
  });

  it("requireTarget refuses a missing target and an untyped image target", () => {
    expect(() => requireTarget(undefined)).toThrow(/target is required/);
    expect(() => requireTarget({ kind: "image", assetType: " " })).toThrow(/assetType/);
    expect(requireTarget({ kind: "avatar" })).toEqual({ kind: "avatar" });
  });

  it("useUploadQueue with no target throws instead of defaulting", () => {
    const server = mockServer({});
    expect(() =>
      renderHook(
        () => useUploadQueue({ max: 10 } as unknown as Parameters<typeof useUploadQueue>[0]),
        { wrapper: ({ children }) => <TestHarness server={server}>{children}</TestHarness> }
      )
    ).toThrow(/target is required/);
  });
});
