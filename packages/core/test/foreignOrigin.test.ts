/**
 * `putToForeignOrigin` — the middle step of every direct-to-storage upload.
 *
 * The suite drives REAL `Response` objects carrying the body an object store
 * actually sends (S3's XML `<Error>`, not a Stapel envelope), because the
 * whole reason this primitive exists is that the store speaks a different
 * dialect than the API and every caller was folding that difference by hand,
 * differently. A hand-shaped `{ ok: false, status: 403 }` would agree with
 * whatever the code already believes; a real `Response` does not.
 */
import { describe, expect, it, vi } from "vitest";
import { isStapelApiError, putToForeignOrigin, toStapelApiError } from "../src/index.js";
import type { StapelApiError } from "../src/index.js";

const S3_ACCESS_DENIED = `<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>`;

function storeThatAnswers(response: Response): typeof globalThis.fetch {
  return vi.fn(async () => response) as unknown as typeof globalThis.fetch;
}

describe("putToForeignOrigin", () => {
  it("PUTs the bytes and resolves the store's own response", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 200, headers: { ETag: '"abc123"' } })
    );
    const blob = new Blob(["hello"], { type: "image/png" });

    const response = await putToForeignOrigin("https://store.example/put/1", blob, {
      contentType: "image/png",
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });

    // The ETag is why the Response travels back rather than a bare `void`:
    // a multipart completion needs it, and nothing should have to re-read
    // the body to learn whether the PUT worked.
    expect(response.headers.get("ETag")).toBe('"abc123"');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://store.example/put/1");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(blob);
    expect(init.headers).toEqual({ "Content-Type": "image/png" });
  });

  it("sends no Content-Type when the caller names none", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    await putToForeignOrigin("https://store.example/put/1", new Blob(["x"]), {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });
    // Not an empty string, not "application/octet-stream": a presigned URL is
    // often signed over the header set, and a header the signature does not
    // cover comes back as a 403 from the store.
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual({});
  });

  it("folds a store failure into the one dialect", async () => {
    const fetchMock = storeThatAnswers(
      new Response(S3_ACCESS_DENIED, {
        status: 403,
        headers: { "Content-Type": "application/xml" },
      })
    );

    const caught = await putToForeignOrigin("https://store.example/put/1", new Blob(["x"]), {
      fetch: fetchMock,
    }).catch((e: unknown) => e);

    // The failure a caller sees is a StapelApiError — not a `Response` it has
    // to remember to check, which is how an upload gets awaited and then
    // treated as done.
    expect(isStapelApiError(caught)).toBe(true);
    const error = caught as StapelApiError;
    expect(error.code).toBe("stapel.http.403");
    expect(error.status).toBe(403);
  });

  it("keeps the status honest for every class the floor knows", async () => {
    for (const status of [400, 404, 413, 500, 503]) {
      const caught = await putToForeignOrigin("https://store.example/p", new Blob(["x"]), {
        fetch: storeThatAnswers(new Response("nope", { status })),
      }).catch((e: unknown) => e);
      expect((caught as StapelApiError).code).toBe(`stapel.http.${String(status)}`);
    }
  });

  it("lets a transport fault stay a transport fault", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof globalThis.fetch;

    const caught = await putToForeignOrigin("https://store.example/p", new Blob(["x"]), {
      fetch: offline,
    }).catch((e: unknown) => e);

    // Never reached an HTTP outcome, so `stapel.http.0` would be a lie about
    // who failed; core's own folder says so too.
    const folded = toStapelApiError(caught);
    expect(folded.code).toBe("stapel.transport.failed");
    expect(folded.status).toBe(0);
  });

  it("passes an abort signal through to the store", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const controller = new AbortController();
    await putToForeignOrigin("https://store.example/p", new Blob(["x"]), {
      signal: controller.signal,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBe(controller.signal);
  });
});
