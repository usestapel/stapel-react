/**
 * The WIRE, not the module (CONTRIBUTING "Mock the wire, not the module").
 *
 * Every test below stubs `fetch` and hands back a real `Response` with the body
 * stapel-vocabularies actually sends, then lets the real client produce the
 * value a caller sees. Nothing here hand-shapes a `TermPage` or a
 * `StapelApiError`: the two questions this file exists to answer — what URL
 * goes out, and what comes back out of a refusal — are exactly the ones a
 * hand-built value cannot answer.
 */
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { isStapelApiError } from "@stapel/core";
import { createVocabularyClient, RESOLVE_BATCH } from "../src/client.js";

const BASE = "https://stand.example/vocabularies/api/v1/";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A stub that records every URL and answers each call from `bodies`. */
function stub(...bodies: readonly unknown[]): {
  fetch: typeof globalThis.fetch;
  urls: string[];
  inits: (RequestInit | undefined)[];
} {
  const urls: string[] = [];
  const inits: (RequestInit | undefined)[] = [];
  let at = 0;
  const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    inits.push(init);
    const body = bodies[Math.min(at, bodies.length - 1)];
    at += 1;
    return Promise.resolve(json(body));
  });
  return { fetch: fetchImpl as unknown as typeof globalThis.fetch, urls, inits };
}

const PAGE = {
  results: [
    { code: "apple", label: "Apple", level: "Vendor", has_children: true },
    { code: "samsung", label: "Samsung", level: "Vendor", has_children: true },
  ],
  total: 2,
};

describe("search — the URL that goes out", () => {
  it("carries level, q and limit, and omits parent when it is undefined", async () => {
    const s = stub(PAGE);
    const client = createVocabularyClient({ baseUrl: BASE, fetch: s.fetch });
    await client.search("phone-models", "Vendor", "app");

    expect(s.urls).toHaveLength(1);
    const url = new URL(s.urls[0] as string);
    expect(url.pathname).toBe("/vocabularies/api/v1/vocabularies/phone-models/terms/");
    expect(url.searchParams.get("level")).toBe("Vendor");
    expect(url.searchParams.get("q")).toBe("app");
    expect(url.searchParams.get("limit")).toBe("50");
    // OMITTED, not empty: `parent=` asks for the children of a term whose code
    // is the empty string, which is a level with nothing in it.
    expect(url.searchParams.has("parent")).toBe(false);
    expect(s.urls[0]).not.toContain("parent=");
    // The first page is the first page — no offset until the sheet pages.
    expect(url.searchParams.has("offset")).toBe(false);
  });

  it("sends offset when the sheet pages past the first page", async () => {
    const s = stub(PAGE);
    const client = createVocabularyClient({ baseUrl: BASE, fetch: s.fetch });
    await client.search("phone-models", "Vendor", "", undefined, undefined, 50);
    const url = new URL(s.urls[0] as string);
    expect(url.searchParams.get("offset")).toBe("50");
  });

  it("sends parent when a parent term is given, and drops an empty one", async () => {
    const s = stub(PAGE, PAGE);
    const client = createVocabularyClient({ baseUrl: BASE, fetch: s.fetch });
    await client.search("phone-models", "Model", "", "apple");
    await client.search("phone-models", "Model", "", "");

    expect(new URL(s.urls[0] as string).searchParams.get("parent")).toBe("apple");
    expect(new URL(s.urls[1] as string).searchParams.has("parent")).toBe(false);
  });

  it("percent-encodes what a person typed and what the pointer named", async () => {
    const s = stub(PAGE);
    const client = createVocabularyClient({ baseUrl: BASE, fetch: s.fetch });
    await client.search("cars/new", "Model", "A&B 100%", "vw+audi");

    const raw = s.urls[0] as string;
    expect(raw).toContain("/vocabularies/cars%2Fnew/terms/");
    const url = new URL(raw);
    // The round trip is the assertion: whatever the escaping looks like, the
    // server must read back exactly what was asked for.
    expect(url.searchParams.get("q")).toBe("A&B 100%");
    expect(url.searchParams.get("parent")).toBe("vw+audi");
  });

  it("adds the missing trailing slash to a baseUrl rather than doubling it", async () => {
    const s = stub(PAGE, PAGE);
    await createVocabularyClient({
      baseUrl: "https://stand.example/vocabularies/api/v1",
      fetch: s.fetch,
    }).search("v", "L", "");
    await createVocabularyClient({ baseUrl: BASE, fetch: s.fetch }).search("v", "L", "");

    expect(new URL(s.urls[0] as string).pathname).toBe(
      "/vocabularies/api/v1/vocabularies/v/terms/"
    );
    expect(new URL(s.urls[1] as string).pathname).toBe(
      "/vocabularies/api/v1/vocabularies/v/terms/"
    );
  });

  it("honours a custom page size", async () => {
    const s = stub(PAGE);
    await createVocabularyClient({ baseUrl: BASE, fetch: s.fetch, limit: 200 }).search(
      "v",
      "L",
      ""
    );
    expect(new URL(s.urls[0] as string).searchParams.get("limit")).toBe("200");
  });

  it("returns the page's rows, `has_children` included", async () => {
    const s = stub(PAGE);
    const terms = await createVocabularyClient({ baseUrl: BASE, fetch: s.fetch }).search(
      "phone-models",
      "Vendor",
      ""
    );
    expect(terms).toEqual([
      { code: "apple", label: "Apple", has_children: true },
      { code: "samsung", label: "Samsung", has_children: true },
    ]);
  });
});

describe("search — abort", () => {
  it("forwards the signal to the transport", async () => {
    const s = stub(PAGE);
    const controller = new AbortController();
    await createVocabularyClient({ baseUrl: BASE, fetch: s.fetch }).search(
      "v",
      "L",
      "",
      undefined,
      controller.signal
    );
    expect(s.inits[0]?.signal).toBe(controller.signal);
  });

  it("rethrows an abort AS an abort, not as a backend failure", async () => {
    // The real `fetch` rejects with an AbortError when the signal fires; a
    // superseded keystroke folded into the error dialect would look to a caller
    // exactly like a dead backend, which is the one thing it is not.
    const controller = new AbortController();
    const aborting = ((_input: RequestInfo | URL, init?: RequestInit) => {
      controller.abort();
      return Promise.reject(
        Object.assign(new Error("The operation was aborted."), {
          name: "AbortError",
          signal: init?.signal,
        })
      );
    }) as unknown as typeof globalThis.fetch;

    const client = createVocabularyClient({ baseUrl: BASE, fetch: aborting });
    const caught = await client
      .search("v", "L", "q", undefined, controller.signal)
      .then(() => undefined)
      .catch((error: unknown) => error);

    expect((caught as Error).name).toBe("AbortError");
    expect(isStapelApiError(caught)).toBe(false);
    expect(controller.signal.aborted).toBe(true);
  });
});

describe("resolve", () => {
  it("sends the codes as one comma-separated parameter and reads the map back", async () => {
    const s = stub({ apple: "Apple", samsung: "Samsung" });
    const labels = await createVocabularyClient({ baseUrl: BASE, fetch: s.fetch }).resolve(
      "phone-models",
      "Vendor",
      ["apple", "samsung", "nokia"]
    );

    const url = new URL(s.urls[0] as string);
    expect(url.pathname).toBe(
      "/vocabularies/api/v1/vocabularies/phone-models/terms/resolve/"
    );
    expect(url.searchParams.get("level")).toBe("Vendor");
    expect(url.searchParams.get("codes")).toBe("apple,samsung,nokia");
    // Unknown codes are omitted by the server — the caller falls back to the
    // code, which is what the stored answer literally is.
    expect(labels).toEqual({ apple: "Apple", samsung: "Samsung" });
  });

  it("asks for nothing when there is nothing to ask about", async () => {
    const s = stub({});
    const labels = await createVocabularyClient({ baseUrl: BASE, fetch: s.fetch }).resolve(
      "v",
      "L",
      ["", ""]
    );
    expect(s.urls).toEqual([]);
    expect(labels).toEqual({});
  });

  it("splits past the server's cap instead of losing the tail", async () => {
    // The endpoint takes at most 200 codes and IGNORES the rest — silently, so
    // a single request would come back missing labels nobody asked twice for.
    const codes = Array.from({ length: RESOLVE_BATCH + 5 }, (_, i) => `c${String(i)}`);
    const s = stub(
      Object.fromEntries(codes.slice(0, RESOLVE_BATCH).map((c) => [c, c.toUpperCase()])),
      Object.fromEntries(codes.slice(RESOLVE_BATCH).map((c) => [c, c.toUpperCase()]))
    );
    const labels = await createVocabularyClient({ baseUrl: BASE, fetch: s.fetch }).resolve(
      "v",
      "L",
      codes
    );

    expect(s.urls).toHaveLength(2);
    expect(
      (new URL(s.urls[0] as string).searchParams.get("codes") ?? "").split(",")
    ).toHaveLength(RESOLVE_BATCH);
    expect(
      (new URL(s.urls[1] as string).searchParams.get("codes") ?? "").split(",")
    ).toHaveLength(5);
    expect(Object.keys(labels)).toHaveLength(RESOLVE_BATCH + 5);
  });
});

describe("a refusal arrives in ONE dialect", () => {
  it("folds the backend envelope into a StapelApiError carrying its code", async () => {
    const refusing = (() =>
      Promise.resolve(
        json(
          {
            localizable_error: "error.404.vocabularies_vocabulary_not_found",
            error: "Vocabulary not found",
            params: {},
          },
          404
        )
      )) as unknown as typeof globalThis.fetch;

    const caught = await createVocabularyClient({ baseUrl: BASE, fetch: refusing })
      .search("nope", "Vendor", "")
      .then(() => undefined)
      .catch((error: unknown) => error);

    expect(isStapelApiError(caught)).toBe(true);
    expect((caught as { code: string }).code).toBe(
      "error.404.vocabularies_vocabulary_not_found"
    );
    expect((caught as { status: number }).status).toBe(404);
  });

  it("a transport that never reached the backend says so, with status 0", async () => {
    const dead = (() =>
      Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof globalThis.fetch;

    const caught = await createVocabularyClient({ baseUrl: BASE, fetch: dead })
      .resolve("v", "L", ["a"])
      .then(() => undefined)
      .catch((error: unknown) => error);

    expect(isStapelApiError(caught)).toBe(true);
    expect((caught as { status: number }).status).toBe(0);
  });
});
