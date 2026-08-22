/**
 * The property this pair exists for, asserted by COUNTING REQUESTS: when the
 * CDN already holds the bytes, no upload happens at all.
 *
 * Every case below runs the real flow against the real client, so the hash the
 * pre-check is asked with is the hash the file actually has. A flow that
 * skipped the check, or asked with the wrong digest, fails these.
 */
import { describe, expect, it } from "vitest";
import { StapelApiError } from "@stapel/core";
import { runUpload, CDN_DEFAULT_LIMITS } from "../src/index.js";
import { createHarnessRuntime, mockServer } from "./harness.js";
import { hashOf, hit, imageFile, imageRow, MISS, refusal, uploaded } from "./fixtures.js";

const limits = CDN_DEFAULT_LIMITS.image;

describe("dedup pre-check (spec §8.2 — the CDN already has it)", () => {
  it("a hit short-circuits: file/exists/ is asked, upload/image/ is NOT", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: hit(imageRow({ hash })) },
      "/upload/image/": { body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
    });

    expect(outcome.deduped).toBe(true);
    expect(outcome.ref).toBe(`product/${hash}`);
    expect(server.count("/file/exists/")).toBe(1);
    expect(server.count("/upload/image/")).toBe(0);
  });

  it("asks with the file's real SHA-256, as a query parameter", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: hit(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    await runUpload(runtime.api, file, { target: { kind: "image" }, limits });

    expect(server.calls[0]?.url).toContain(`file_hash=${hash}`);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a miss uploads, and the multipart body carries the file", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
    });

    expect(outcome.deduped).toBe(false);
    expect(outcome.ref).toBe(`product/${hash}`);
    expect(server.count("/upload/image/")).toBe(1);
    expect(server.calls[1]?.file?.name).toBe("photo.jpg");
  });

  it("the same bytes stored as a VIDEO are not an image hit — it still uploads", async () => {
    // `file/exists/` answers about any object with these bytes. A pair that
    // read `exists` alone would hand a listing composer a `video/<hash>`
    // reference and call it a photo.
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: hit({ file_hash: hash }, "video") },
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
    });

    expect(outcome.deduped).toBe(false);
    expect(server.count("/upload/image/")).toBe(1);
  });

  it("an image of a DIFFERENT asset type is not a hit — the upload views scope dedup by type", async () => {
    // My own avatar's bytes, re-used as a listing photo: the server would
    // store a second row (`type="product"`), so short-circuiting on the
    // avatar row would hand back a reference the listing must not carry.
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: hit(imageRow({ hash, type: "avatar" })) },
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
    });

    expect(outcome.deduped).toBe(false);
    expect(outcome.ref).toBe(`product/${hash}`);
  });

  it("matches on the asset type the TARGET produces, not on a fixed one", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: hit(imageRow({ hash, type: "avatar" })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "avatar" },
      limits,
    });

    expect(outcome.deduped).toBe(true);
    expect(outcome.ref).toBe(`avatar/${hash}`);
    expect(server.count("/upload/avatar/")).toBe(0);
  });
});

describe("the pre-check is an optimisation and never fails the upload", () => {
  it("401 (a guest may upload but may not pre-check) falls through and says so", async () => {
    // `file/exists/` is IsAuthenticated; `/upload/image/` is
    // IsNotAnonymousUser. The asymmetry is stapel-cdn's, and a guest hitting
    // it must still be able to post a photo.
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": {
        status: 401,
        body: refusal("error.401.unauthorized", "Authentication required"),
      },
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
    });

    expect(outcome.dedupSkipped).toBe("unauthorized");
    expect(outcome.deduped).toBe(false);
    expect(outcome.ref).toBe(`product/${hash}`);
  });

  it("any other failure of the check also falls through, under its own reason", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { status: 500, body: refusal("error.500.internal", "boom") },
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
    });

    expect(outcome.dedupSkipped).toBe("check_failed");
    expect(outcome.ref).toBe(`product/${hash}`);
  });

  it("`dedup: false` skips the check entirely and reports the reason", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
      dedup: false,
    });

    expect(outcome.dedupSkipped).toBe("disabled");
    expect(server.count("/file/exists/")).toBe(0);
  });
});

describe("a refusal from the upload itself reaches the caller in one dialect", () => {
  it("413 arrives as a StapelApiError carrying cdn's own code", async () => {
    const file = imageFile();
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": {
        status: 413,
        body: refusal("error.413.file_too_large", "File is too large"),
      },
    });
    const runtime = createHarnessRuntime({ server });

    await expect(
      runUpload(runtime.api, file, { target: { kind: "image" }, limits })
    ).rejects.toMatchObject({ code: "error.413.file_too_large", status: 413 });
  });

  it("a transport fault is folded too, never left as a bare Error", async () => {
    const file = imageFile();
    const server = mockServer({ "/file/exists/": { body: MISS } });
    const runtime = createHarnessRuntime({ server });

    // No `/upload/image/` route → the harness answers 404 with a real envelope.
    const failure = await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StapelApiError);
  });
});

describe("the phase sequence is the flow, said out loud", () => {
  it("a miss walks hashing → checking → uploading", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": { status: 201, body: uploaded(imageRow({ hash })) },
    });
    const runtime = createHarnessRuntime({ server });
    const phases: string[] = [];

    await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
      onPhase: (next) => phases.push(next),
    });

    expect(phases).toEqual(["hashing", "checking", "uploading", "done"]);
  });

  it("a hit stops at checking — there is no uploading phase to report", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({ "/file/exists/": { body: hit(imageRow({ hash })) } });
    const runtime = createHarnessRuntime({ server });
    const phases: string[] = [];

    await runUpload(runtime.api, file, {
      target: { kind: "image" },
      limits,
      onPhase: (next) => phases.push(next),
    });

    expect(phases).toEqual(["hashing", "checking", "done"]);
  });
});
