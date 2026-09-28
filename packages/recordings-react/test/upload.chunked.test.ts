// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  ChunkedTransportError,
  UploadInterruptedError,
  UploadRestartRequiredError,
  createChunkedTransport,
  hashParts,
  runChunkedUpload,
  sha256Hex,
  type ChunkedUploadTransport,
  type PartPutter,
  type RunChunkedUploadOptions,
  type StoredPart,
} from "../src/upload/index.js";

const hexToB64 = (hex: string): string => Buffer.from(hex, "hex").toString("base64");

function bytes(n: number, seed = 1): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 31 + seed) & 0xff;
  return out;
}

/**
 * An in-memory server + store with the contract's semantics: bound part URLs
 * (the store refuses bytes that do not hash to the minted sha256), a manifest
 * from what the store holds, and a complete that verifies every part.
 */
function fakeServer(opts: { partSize: number; size: number }) {
  const total = Math.max(1, Math.ceil(opts.size / opts.partSize));
  const stored = new Map<number, { etag: string; size: number; sha256: string }>();
  const log: string[] = [];
  const mintBatches: number[][] = [];
  let completeFailures: ChunkedTransportError[] = [];
  let mintFailure: ChunkedTransportError | undefined;
  let putCount = new Map<number, number>();
  let etagSeq = 0;
  const expected = (n: number): number =>
    Math.min(n * opts.partSize, opts.size) - (n - 1) * opts.partSize;

  const manifest = () => {
    const uploaded_parts: StoredPart[] = [...stored.entries()]
      .sort(([a], [b]) => a - b)
      .map(([part_number, p]) => ({ part_number, etag: p.etag, size: p.size, sha256: p.sha256 }));
    const missing: number[] = [];
    for (let n = 1; n <= total; n++) {
      const p = stored.get(n);
      if (!p || p.size !== expected(n)) missing.push(n);
    }
    return { uploaded_parts, missing };
  };

  const transport: ChunkedUploadTransport = {
    lookup: async () => ({
      found: false, state: null, recording_id: null, upload_id: null,
      part_size_bytes: null, total_parts: null, uploaded_parts: [], missing: [], expires_at: null,
    }),
    start: async (recording_id, body) => {
      log.push(`start:${body.fingerprint ?? ""}`);
      return {
        upload_id: "up-1", recording_id, storage_key: "k", part_size_bytes: opts.partSize,
        total_parts: total, parts: [], expires_at: "2099-01-01T00:00:00Z",
      };
    },
    mint: async (_rid, _uid, parts) => {
      if (mintFailure) throw mintFailure;
      mintBatches.push(parts.map((p) => p.part_number));
      return {
        parts: parts.map((p) => ({
          part_number: p.part_number,
          presigned_url: `https://store.test/part/${p.part_number}`,
          headers: { "x-amz-checksum-sha256": hexToB64(p.sha256), "x-amz-sdk-checksum-algorithm": "SHA256" },
        })),
        expires_at: "2099-01-01T00:00:00Z",
      };
    },
    manifest: async (recording_id, upload_id) => {
      log.push("manifest");
      return {
        upload_id, recording_id, part_size_bytes: opts.partSize, total_parts: total,
        expires_at: "2099-01-01T00:00:00Z", parts: [], ...manifest(),
      };
    },
    complete: async (recording_id, _uid, parts) => {
      log.push("complete");
      const fail = completeFailures.shift();
      if (fail) throw fail;
      const { missing } = manifest();
      if (missing.length) {
        throw new ChunkedTransportError(409, "error.409.recording_upload_parts_missing", {
          count: missing.length, missing: missing.join(","),
        });
      }
      for (const p of parts) {
        if (p.sha256 && stored.get(p.part_number)?.sha256 !== p.sha256) {
          throw new ChunkedTransportError(409, "error.409.recording_upload_part_mismatch", {
            part_number: p.part_number,
          });
        }
      }
      return { id: recording_id } as never;
    },
    abort: async () => undefined,
  };

  /** Store-side PUT: verifies the bound checksum like S3 does. */
  const storePut = async (url: string, headers: Record<string, string>, body: Blob) => {
    const n = Number(url.split("/").pop());
    putCount.set(n, (putCount.get(n) ?? 0) + 1);
    const actual = await sha256Hex(await body.arrayBuffer());
    if (hexToB64(actual) !== headers["x-amz-checksum-sha256"]) {
      return { status: 400, etag: null, body: "<Error><Code>XAmzContentChecksumMismatch</Code></Error>" };
    }
    const etag = `"e${++etagSeq}"`;
    stored.set(n, { etag, size: body.size, sha256: actual });
    return { status: 200, etag, body: "" };
  };

  return {
    total, stored, log, mintBatches, transport, storePut,
    get putCount() { return putCount; },
    resetPutCount: () => { putCount = new Map(); },
    failComplete: (...errs: ChunkedTransportError[]) => { completeFailures = errs; },
    failMint: (e: ChunkedTransportError | undefined) => { mintFailure = e; },
  };
}

async function setup(size: number, partSize: number) {
  const data = bytes(size);
  const source = new Blob([data]);
  const { fingerprint, partHashes } = await hashParts(source, partSize);
  const server = fakeServer({ partSize, size });
  const put: PartPutter = ({ url, headers, body }) => server.storePut(url, headers, body);
  const base: RunChunkedUploadOptions = {
    transport: server.transport,
    source,
    name: "a.m4a",
    contentType: "audio/mp4",
    partSize,
    hashes: partHashes,
    fingerprint,
    recordingId: "rec-1",
    putPart: put,
    sleep: async () => undefined,
    waitUntilReady: async () => undefined,
  };
  return { server, source, partHashes, fingerprint, base, data };
}

describe("runChunkedUpload", () => {
  it("fresh upload: starts with the fingerprint, mints in batches of ≤100, completes", async () => {
    const { server, base, fingerprint } = await setup(1000, 4); // 250 parts
    const progress: number[] = [];
    const r = await runChunkedUpload({ ...base, concurrency: 8, onProgress: (p) => progress.push(p.loaded) });
    expect(r.uploadId).toBe("up-1");
    expect(r.partsSent).toBe(250);
    expect(server.log[0]).toBe(`start:${fingerprint}`);
    expect(server.log.at(-1)).toBe("complete");
    expect(server.mintBatches.every((b) => b.length <= 100)).toBe(true);
    expect(server.mintBatches.flat().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 250 }, (_, i) => i + 1)
    );
    expect(server.stored.size).toBe(250);
    expect(progress.at(-1)).toBe(1000);
  });

  it("resume uploads only the missing parts (and a stored part with the wrong hash)", async () => {
    const { server, base, partHashes } = await setup(50, 10); // 5 parts
    server.stored.set(1, { etag: '"old1"', size: 10, sha256: partHashes[0] as string });
    server.stored.set(2, { etag: '"bad2"', size: 10, sha256: "0".repeat(64) });
    server.stored.set(3, { etag: '"old3"', size: 10, sha256: partHashes[2] as string });
    server.stored.set(4, { etag: '"short4"', size: 3, sha256: partHashes[3] as string }); // wrong size = missing
    const sessions: string[] = [];
    const completeSpy = vi.spyOn(server.transport, "complete");
    const r = await runChunkedUpload({ ...base, uploadId: "up-1", onSession: (id) => sessions.push(id) });
    expect(sessions).toEqual(["up-1"]);
    expect(server.log).not.toContain("start:");
    expect([...server.putCount.keys()].sort()).toEqual([2, 4, 5]);
    expect(r.partsSent).toBe(3);
    // Resolved up front from the manifest, not after a mismatch round trip.
    expect(completeSpy).toHaveBeenCalledTimes(1);
    const sent = (completeSpy.mock.calls[0] as unknown[])[2] as Array<{ part_number: number; etag: string; sha256?: string }>;
    expect(sent.find((p) => p.part_number === 1)?.etag).toBe('"old1"');
    expect(sent.find((p) => p.part_number === 3)?.etag).toBe('"old3"');
    expect(sent.map((p) => p.sha256)).toEqual(partHashes);
  });

  it("a checksum-refused part is re-sent", async () => {
    const { server, base } = await setup(40, 10);
    let corruptOnce = true;
    const put: PartPutter = async ({ url, headers, body }) => {
      if (url.endsWith("/2") && corruptOnce) {
        corruptOnce = false;
        return server.storePut(url, headers, new Blob([new Uint8Array(10)])); // bytes damaged in flight
      }
      return server.storePut(url, headers, body);
    };
    await runChunkedUpload({ ...base, putPart: put });
    expect(server.putCount.get(2)).toBe(2);
    expect(server.stored.size).toBe(4);
  });

  it("gives up re-sending after the checksum budget and interrupts", async () => {
    const { server, base } = await setup(40, 10);
    const put: PartPutter = ({ url, headers, body }) =>
      server.storePut(url, headers, url.endsWith("/2") ? new Blob([new Uint8Array(10)]) : body);
    const err = await runChunkedUpload({ ...base, putPart: put, concurrency: 1, retry: { checksumResends: 2 } }).catch((e) => e);
    expect(err).toBeInstanceOf(UploadInterruptedError);
    expect(server.putCount.get(2)).toBe(3);
    expect(server.log).not.toContain("complete");
  });

  it("source bytes no longer matching the hashes → restart signal", async () => {
    const { base } = await setup(40, 10);
    const changed = new Blob([bytes(40, 99)]);
    const err = await runChunkedUpload({ ...base, source: changed }).catch((e) => e);
    expect(err).toBeInstanceOf(UploadRestartRequiredError);
    expect((err as UploadRestartRequiredError).reason).toBe("source_changed");
  });

  it("complete is retried on 5xx", async () => {
    const { server, base } = await setup(30, 10);
    server.failComplete(new ChunkedTransportError(502, undefined), new ChunkedTransportError(0, undefined));
    const r = await runChunkedUpload(base);
    expect(r.recording).toEqual({ id: "rec-1" });
    expect(server.log.filter((l) => l === "complete")).toHaveLength(3);
  });

  it("parts_missing at complete → re-list and send the missing set", async () => {
    const { server, base } = await setup(30, 10);
    const orig = server.transport.complete.bind(server.transport);
    let first = true;
    server.transport.complete = async (...args) => {
      if (first) {
        first = false;
        server.stored.delete(3); // the store lost a part
      }
      return orig(...args);
    };
    server.resetPutCount();
    await runChunkedUpload(base);
    expect(server.putCount.get(3)).toBe(2);
    expect(server.putCount.get(1)).toBe(1);
    expect(server.log.filter((l) => l === "manifest")).toHaveLength(1);
  });

  it("part_mismatch for a single part re-sends it; part 0 means restart", async () => {
    const { server, base } = await setup(30, 10);
    server.failComplete(
      new ChunkedTransportError(409, "error.409.recording_upload_part_mismatch", { part_number: 2 })
    );
    await runChunkedUpload(base);
    expect(server.putCount.get(2)).toBe(2);

    const again = await setup(30, 10);
    again.server.failComplete(
      new ChunkedTransportError(409, "error.409.recording_upload_part_mismatch", { part_number: 0 })
    );
    const err = await runChunkedUpload(again.base).catch((e) => e);
    expect(err).toBeInstanceOf(UploadRestartRequiredError);
    expect((err as UploadRestartRequiredError).reason).toBe("fingerprint_mismatch");
  });

  it("expired session → restart signal, not a retry", async () => {
    const { server, base } = await setup(30, 10);
    server.failMint(new ChunkedTransportError(409, "error.409.recording_upload_expired"));
    const mint = vi.spyOn(server.transport, "mint");
    const err = await runChunkedUpload(base).catch((e) => e);
    expect(err).toBeInstanceOf(UploadRestartRequiredError);
    expect((err as UploadRestartRequiredError).reason).toBe("expired");
    expect(mint).toHaveBeenCalledTimes(1);

    const c = await setup(30, 10);
    c.server.failComplete(new ChunkedTransportError(409, "error.409.recording_upload_expired"));
    const err2 = await runChunkedUpload(c.base).catch((e) => e);
    expect((err2 as UploadRestartRequiredError).reason).toBe("expired");
  });

  it("a session cut with another part size cannot be resumed", async () => {
    const { base } = await setup(30, 10);
    const err = await runChunkedUpload({ ...base, partSize: 15, hashes: ["a".repeat(64), "b".repeat(64)], uploadId: "up-1" }).catch((e) => e);
    expect((err as UploadRestartRequiredError).reason).toBe("layout_mismatch");
  });

  it("network loss → UploadInterruptedError after the attempt budget, waiting for readiness between tries", async () => {
    const { server, base } = await setup(40, 10);
    const ready = vi.fn(async () => undefined);
    let tries3 = 0;
    const put: PartPutter = async ({ url, headers, body }) => {
      if (!url.endsWith("/3")) return server.storePut(url, headers, body);
      tries3++;
      return { status: 0, etag: null, body: "" };
    };
    const err = await runChunkedUpload({ ...base, putPart: put, waitUntilReady: ready, concurrency: 1, retry: { attempts: 4 } }).catch((e) => e);
    expect(err).toBeInstanceOf(UploadInterruptedError);
    const ie = err as UploadInterruptedError;
    expect(ie.partsTotal).toBe(4);
    expect(ie.partsDone).toBe(2);
    expect(ie.uploadId).toBe("up-1");
    expect(tries3).toBe(4);
    expect(ready).toHaveBeenCalledTimes(3);
    expect(server.log).not.toContain("complete");
  });

  it("an abort interrupts; a later resume finishes with only what is left", async () => {
    const { server, base } = await setup(60, 10);
    const ctl = new AbortController();
    const put: PartPutter = async (a) => {
      const r = await server.storePut(a.url, a.headers, a.body);
      if (server.stored.size === 2) ctl.abort();
      return r;
    };
    const err = await runChunkedUpload({ ...base, putPart: put, signal: ctl.signal, concurrency: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(UploadInterruptedError);
    server.resetPutCount();
    const r = await runChunkedUpload({ ...base, uploadId: "up-1" });
    expect(r.partsSent).toBe(4);
    expect([...server.putCount.keys()].sort()).toEqual([3, 4, 5, 6]);
  });

  it("an expired part URL (403) is minted again", async () => {
    const { server, base } = await setup(20, 10);
    let denied = false;
    const put: PartPutter = async (a) => {
      if (!denied && a.url.endsWith("/1")) {
        denied = true;
        return { status: 403, etag: null, body: "<Code>AccessDenied</Code>" };
      }
      return server.storePut(a.url, a.headers, a.body);
    };
    await runChunkedUpload({ ...base, putPart: put, concurrency: 1 });
    expect(server.mintBatches.flat().filter((n) => n === 1)).toHaveLength(2);
  });
});

describe("createChunkedTransport", () => {
  it("maps calls onto an openapi-fetch-style client, and envelopes onto errors", async () => {
    const calls: Array<{ m: string; path: string; init: unknown }> = [];
    const ok = (data: unknown, status = 200) => ({ data, response: { status } });
    const client = {
      GET: vi.fn(async (path: string, init?: unknown) => {
        calls.push({ m: "GET", path, init });
        return ok({ found: false });
      }),
      POST: vi.fn(async (path: string, init?: unknown) => {
        calls.push({ m: "POST", path, init });
        if (path.endsWith("/complete")) {
          return {
            error: { localizable_error: "error.409.recording_upload_parts_missing", error: "x", params: { count: 1, missing: "2" } },
            response: { status: 409 },
          };
        }
        return ok({ parts: [] }, 201);
      }),
      DELETE: vi.fn(async (path: string, init?: unknown) => {
        calls.push({ m: "DELETE", path, init });
        return { data: undefined, response: { status: 204 } };
      }),
    };
    const t = createChunkedTransport(client, { prefix: "/recordings/api/v1" });
    await t.lookup({ fingerprint: "f".repeat(64), workspaceId: "w 1" });
    await t.start("r/1", { file_size_bytes: 5, fingerprint: "f".repeat(64) });
    await t.mint("r1", "u1", [{ part_number: 1, sha256: "a".repeat(64) }]);
    await t.manifest("r1", "u1");
    await t.abort("r1", "u1");
    const err = await t.complete("r1", "u1", [{ part_number: 1, etag: "e" }]).catch((e) => e);

    expect(calls.map((c) => `${c.m} ${c.path}`)).toEqual([
      `GET /recordings/api/v1/recordings/uploads/lookup?fingerprint=${"f".repeat(64)}&workspace_id=w%201`,
      "POST /recordings/api/v1/recordings/r%2F1/multipart",
      "POST /recordings/api/v1/recordings/r1/multipart/u1/parts",
      "GET /recordings/api/v1/recordings/r1/multipart/u1/parts?mint=none",
      "DELETE /recordings/api/v1/recordings/r1/multipart/u1/abort",
      "POST /recordings/api/v1/recordings/r1/multipart/u1/complete",
    ]);
    expect(calls[2]?.init).toMatchObject({
      body: { parts: [{ part_number: 1, sha256: "a".repeat(64) }] },
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    expect(err).toBeInstanceOf(ChunkedTransportError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("error.409.recording_upload_parts_missing");
    expect(err.params).toEqual({ count: 1, missing: "2" });
  });

  it("a thrown network fault becomes status 0", async () => {
    const boom = async () => {
      throw new TypeError("Failed to fetch");
    };
    const t = createChunkedTransport({ GET: boom, POST: boom, DELETE: boom });
    const err = await t.manifest("r", "u").catch((e) => e);
    expect(err).toBeInstanceOf(ChunkedTransportError);
    expect(err.status).toBe(0);
  });
});
