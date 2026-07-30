import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStapelQueryClient } from "../src/query.js";
import { StapelApiError } from "../src/errors.js";

// jsdom has no IndexedDB, so the runtime falls back to the localStorage
// adapter — which is exactly the fallback path we want covered.

beforeEach(() => {
  localStorage.clear();
});

describe("createStapelQueryClient persistence", () => {
  it("persists under a per-user namespace", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    runtime.queryClient.setQueryData(["profile"], { name: "Ada" });
    await runtime.flushPersist();

    expect(localStorage.getItem("stapel-query:user-a")).not.toBeNull();
    expect(localStorage.getItem("stapel-query:user-b")).toBeNull();

    await runtime.setPersistUser("user-b");
    runtime.queryClient.setQueryData(["settings"], { theme: "dark" });
    await runtime.flushPersist();
    expect(localStorage.getItem("stapel-query:user-b")).not.toBeNull();
  });

  it("restores persisted state for the same user and version", async () => {
    const writer = createStapelQueryClient({ cacheVersion: "1" });
    await writer.setPersistUser("user-a");
    writer.queryClient.setQueryData(["profile"], { name: "Ada" });
    await writer.flushPersist();

    const reader = createStapelQueryClient({ cacheVersion: "1" });
    await reader.setPersistUser("user-a");
    expect(reader.queryClient.getQueryData(["profile"])).toEqual({
      name: "Ada",
    });
  });

  it("discards persisted state written under another cache version", async () => {
    const writer = createStapelQueryClient({ cacheVersion: "1" });
    await writer.setPersistUser("user-a");
    writer.queryClient.setQueryData(["profile"], { name: "Ada" });
    await writer.flushPersist();

    const reader = createStapelQueryClient({ cacheVersion: "2" });
    await reader.setPersistUser("user-a");
    expect(reader.queryClient.getQueryData(["profile"])).toBeUndefined();
    expect(localStorage.getItem("stapel-query:user-a")).toBeNull();
  });

  it("does not leak one user's cache into another user's namespace", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    runtime.queryClient.setQueryData(["profile"], { name: "Ada" });
    await runtime.flushPersist();
    await runtime.setPersistUser(null);

    const fresh = createStapelQueryClient({ cacheVersion: "1" });
    await fresh.setPersistUser("user-b");
    expect(fresh.queryClient.getQueryData(["profile"])).toBeUndefined();
  });

  it("stops persisting after setPersistUser(null)", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    await runtime.setPersistUser(null);
    runtime.queryClient.setQueryData(["profile"], { name: "Eve" });
    await runtime.flushPersist();

    const raw = localStorage.getItem("stapel-query:user-a");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("Eve");
  });

  it("purgePersistedCache removes every namespace and clears memory (logout/GDPR)", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    runtime.queryClient.setQueryData(["profile"], { name: "Ada" });
    await runtime.flushPersist();
    await runtime.setPersistUser("user-b");
    runtime.queryClient.setQueryData(["settings"], { theme: "dark" });
    await runtime.flushPersist();
    localStorage.setItem("unrelated-key", "keep-me");

    await runtime.purgePersistedCache();

    expect(localStorage.getItem("stapel-query:user-a")).toBeNull();
    expect(localStorage.getItem("stapel-query:user-b")).toBeNull();
    expect(localStorage.getItem("unrelated-key")).toBe("keep-me");
    expect(runtime.queryClient.getQueryData(["profile"])).toBeUndefined();
    expect(runtime.queryClient.getQueryData(["settings"])).toBeUndefined();
  });

  it("respects a custom cacheKeyPrefix", async () => {
    const runtime = createStapelQueryClient({
      cacheKeyPrefix: "acme-cache",
      cacheVersion: "1",
    });
    await runtime.setPersistUser("u");
    runtime.queryClient.setQueryData(["x"], 1);
    await runtime.flushPersist();
    expect(localStorage.getItem("acme-cache:u")).not.toBeNull();
  });
});

// ── default retry predicate, across BOTH error dialects ─────────────────────
//
// Mock THE WIRE, not the module (CONTRIBUTING.md): every case below drives a
// real HTTP response with a real backend envelope body through a transport
// written the way products actually write one. Hand-shaping the caught value
// (`{ status: 404 }`) would reproduce the very assumption this suite exists
// to disprove — production's second transport rethrows the parsed BODY, and
// a body has no `.status`.

const NOT_FOUND_ENVELOPE = {
  localizable_error: "error.404.meeting_intelligence_not_found",
  error: "No intelligence has been extracted for this recording",
  params: {},
};

function wire(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { "Content-Type": "application/json" },
            })
          );
        })
    )
  );
}

/**
 * The SECOND transport: no `@stapel/core` client, so a failure reaches the
 * caller as the raw envelope object (`if (error) throw error`) — exactly what
 * an `openapi-fetch`-style `{ data, error }` result does at its rethrow point.
 */
async function secondTransportGet(url: string): Promise<unknown> {
  const response = await fetch(url);
  const body: unknown = await response.json();
  if (!response.ok) throw body;
  return body;
}

async function attempts(
  queryFn: () => Promise<unknown>
): Promise<{ calls: number; error: unknown }> {
  const runtime = createStapelQueryClient({ cacheVersion: "1" });
  let calls = 0;
  let error: unknown = null;
  try {
    await runtime.queryClient.fetchQuery({
      queryKey: ["retry-probe", Math.random()],
      queryFn: async () => {
        calls += 1;
        return queryFn();
      },
      // Only the DELAY is overridden — the predicate under test is the
      // client's own default.
      retryDelay: 0,
    });
  } catch (e) {
    error = e;
  }
  return { calls, error };
}

describe("default retry predicate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does NOT retry a 4xx that arrives as the RAW envelope (no .status)", async () => {
    wire(404, NOT_FOUND_ENVELOPE);
    const { calls, error } = await attempts(() =>
      secondTransportGet("https://api.test/recordings/1/intelligence/")
    );

    // The caught value is the bare envelope — this is what call sites see.
    expect(error).not.toBeInstanceOf(StapelApiError);
    expect(error).toMatchObject({
      localizable_error: "error.404.meeting_intelligence_not_found",
    });
    expect(error).not.toHaveProperty("status");

    // …and it must still be recognised as a 4xx: one attempt, no retries.
    // Before `errorStatus`, `(error as {status?: number}).status` read
    // `undefined` here and this doomed request was fired three times.
    expect(calls).toBe(1);
  });

  it("does NOT retry a 4xx that arrives as StapelApiError", async () => {
    wire(400, { localizable_error: "auth.otp.invalid", error: "Invalid code" });
    const { calls } = await attempts(async () => {
      const response = await fetch("https://api.test/auth/otp/");
      throw new StapelApiError({
        code: "auth.otp.invalid",
        message: "Invalid code",
        status: response.status,
      });
    });
    expect(calls).toBe(1);
  });

  it("still retries a 5xx envelope (transient — the app cannot handle it)", async () => {
    wire(503, { localizable_error: "error.503.search_unavailable", error: "off" });
    const { calls } = await attempts(() =>
      secondTransportGet("https://api.test/search/")
    );
    expect(calls).toBe(3);
  });

  it("still retries a fault with no status information at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch")))
    );
    const { calls } = await attempts(() => secondTransportGet("https://api.test/x/"));
    expect(calls).toBe(3);
  });
});
