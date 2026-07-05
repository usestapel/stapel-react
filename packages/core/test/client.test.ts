import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createStapelClient } from "../src/client.js";
import { StapelApiError } from "../src/errors.js";
import type { VerificationChallenge } from "../src/verification.js";

const BASE = "https://api.stapel.test";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("createStapelClient", () => {
  it("performs JSON requests against the base URL with auth header", async () => {
    server.use(
      http.get(`${BASE}/v1/me`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer tok-123");
        return HttpResponse.json({ id: "u1" });
      })
    );
    const client = createStapelClient({
      baseUrl: BASE,
      getToken: () => "tok-123",
    });
    await expect(client.get("/v1/me")).resolves.toEqual({ id: "u1" });
  });

  it("cookie mode: passes credentials through to fetch on every request (incl. retries)", async () => {
    const inits: (RequestInit | undefined)[] = [];
    const fetchSpy: typeof globalThis.fetch = async (input, init) => {
      inits.push(init);
      if (inits.length === 1) {
        return new Response(
          JSON.stringify({ localizable_error: "auth.expired", error: "x" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createStapelClient({
      baseUrl: BASE,
      credentials: "include",
      fetch: fetchSpy,
      onAuthRefresh: () => Promise.resolve("tok-2"),
    });
    await expect(client.get("/v1/me")).resolves.toEqual({ ok: true });
    // HTTP-only cookies must ride BOTH the original request and the
    // post-refresh retry.
    expect(inits).toHaveLength(2);
    expect(inits[0]?.credentials).toBe("include");
    expect(inits[1]?.credentials).toBe("include");
  });

  it("leaves fetch credentials untouched when the option is not set", async () => {
    const inits: (RequestInit | undefined)[] = [];
    const fetchSpy: typeof globalThis.fetch = async (_input, init) => {
      inits.push(init);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createStapelClient({ baseUrl: BASE, fetch: fetchSpy });
    await client.get("/v1/me");
    expect(inits[0]?.credentials).toBeUndefined();
  });

  it("throws StapelApiError parsed from the error envelope", async () => {
    server.use(
      http.post(`${BASE}/v1/otp`, () =>
        HttpResponse.json(
          {
            localizable_error: "auth.otp.invalid",
            error: "Invalid one-time code",
            params: { attempts_left: 1 },
          },
          { status: 400 }
        )
      )
    );
    const client = createStapelClient({ baseUrl: BASE });
    const error = await client
      .post("/v1/otp", { code: "000000" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StapelApiError);
    const apiError = error as StapelApiError;
    expect(apiError.code).toBe("auth.otp.invalid");
    expect(apiError.params).toEqual({ attempts_left: 1 });
    expect(apiError.status).toBe(400);
  });

  it("intercepts verification-403, runs the challenge handler, retries once with X-Verification-Token", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/v1/payouts`, ({ request }) => {
        calls += 1;
        if (request.headers.get("x-verification-token") !== "vt-9") {
          return HttpResponse.json(
            {
              localizable_error: "verification.required",
              error: "Step-up verification required",
              verification: {
                challenge_id: "ch-42",
                scope: "billing.payout",
                factors: ["totp", "webauthn"],
              },
            },
            { status: 403 }
          );
        }
        return HttpResponse.json({ payout: "ok" });
      })
    );

    const seen: VerificationChallenge[] = [];
    const onVerificationChallenge = vi.fn(
      async (challenge: VerificationChallenge) => {
        seen.push(challenge);
        return { retry: true, token: "vt-9" };
      }
    );
    const client = createStapelClient({ baseUrl: BASE, onVerificationChallenge });

    await expect(client.post("/v1/payouts", { amount: 100 })).resolves.toEqual({
      payout: "ok",
    });
    expect(calls).toBe(2);
    expect(onVerificationChallenge).toHaveBeenCalledTimes(1);
    expect(seen[0]?.challenge_id).toBe("ch-42");
    expect(seen[0]?.scope).toBe("billing.payout");
    expect(seen[0]?.factors).toEqual(["totp", "webauthn"]);
  });

  it("throws the envelope error when the challenge handler declines", async () => {
    server.use(
      http.get(`${BASE}/v1/secrets`, () =>
        HttpResponse.json(
          {
            localizable_error: "verification.required",
            error: "Step-up verification required",
            verification: { challenge_id: "ch-1", factors: ["totp"] },
          },
          { status: 403 }
        )
      )
    );
    const client = createStapelClient({
      baseUrl: BASE,
      onVerificationChallenge: async () => ({ retry: false }),
    });
    const error = await client.get("/v1/secrets").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StapelApiError);
    expect((error as StapelApiError).code).toBe("verification.required");
  });

  it("retries the verification challenge at most once", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/loop`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            localizable_error: "verification.required",
            verification: { challenge_id: `ch-${String(calls)}` },
          },
          { status: 403 }
        );
      })
    );
    const handler = vi.fn(async () => ({ retry: true, token: "nope" }));
    const client = createStapelClient({
      baseUrl: BASE,
      onVerificationChallenge: handler,
    });
    await expect(client.get("/v1/loop")).rejects.toBeInstanceOf(StapelApiError);
    expect(calls).toBe(2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not treat a plain 403 (no verification object) as a challenge", async () => {
    server.use(
      http.get(`${BASE}/v1/forbidden`, () =>
        HttpResponse.json(
          { localizable_error: "workspace.forbidden", error: "Forbidden" },
          { status: 403 }
        )
      )
    );
    const handler = vi.fn(async () => ({ retry: true }));
    const client = createStapelClient({
      baseUrl: BASE,
      onVerificationChallenge: handler,
    });
    await expect(client.get("/v1/forbidden")).rejects.toMatchObject({
      code: "workspace.forbidden",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("refreshes the token once on 401 and retries", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/me`, ({ request }) => {
        calls += 1;
        if (request.headers.get("authorization") !== "Bearer fresh") {
          return HttpResponse.json(
            { localizable_error: "auth.token.expired" },
            { status: 401 }
          );
        }
        return HttpResponse.json({ id: "u1" });
      })
    );
    const onAuthRefresh = vi.fn(async () => "fresh");
    const client = createStapelClient({
      baseUrl: BASE,
      getToken: () => "stale",
      onAuthRefresh,
    });
    await expect(client.get("/v1/me")).resolves.toEqual({ id: "u1" });
    expect(calls).toBe(2);
    expect(onAuthRefresh).toHaveBeenCalledTimes(1);
  });

  it("serializes query params and skips undefined", async () => {
    server.use(
      http.get(`${BASE}/v1/items`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("2");
        expect(url.searchParams.get("archived")).toBe("false");
        expect(url.searchParams.has("cursor")).toBe(false);
        return HttpResponse.json([]);
      })
    );
    const client = createStapelClient({ baseUrl: BASE });
    await client.get("/v1/items", {
      query: { page: 2, archived: false, cursor: undefined },
    });
  });
});
