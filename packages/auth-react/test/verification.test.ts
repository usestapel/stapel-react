import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { StapelApiError } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import { BASE } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function envelope(): Record<string, unknown> {
  return {
    localizable_error: "error.403.verification_required",
    error: "Additional verification required",
    verification: {
      challenge_id: "chg_1",
      scope: "payout",
      factors: ["otp_email", "totp"],
      // Always in the future so the self-release timer does not fire mid-test.
      expires_at: Math.floor(Date.now() / 1000) + 300,
    },
  };
}

describe("step-up verification (flagship cross-module flow)", () => {
  it("403 envelope → otp_email factor → retries original request with X-Verification-Token", async () => {
    let sensitiveCalls = 0;
    server.use(
      http.get(`${BASE}/sensitive/`, ({ request }) => {
        sensitiveCalls += 1;
        if (request.headers.get("x-verification-token") === "vt_1") {
          return HttpResponse.json({ ok: true });
        }
        return HttpResponse.json(envelope(), { status: 403 });
      }),
      http.post(`${BASE}/verification/chg_1/initiate/`, async ({ request }) => {
        expect(await request.json()).toEqual({ factor: "otp_email" });
        return HttpResponse.json({
          factor: "otp_email",
          data: { target: "a***@b.com" },
        });
      }),
      http.post(`${BASE}/verification/chg_1/complete/`, async ({ request }) => {
        expect(await request.json()).toEqual({ factor: "otp_email", code: "1234" });
        return HttpResponse.json({ verified: true, verification_token: "vt_1" });
      })
    );

    const runtime = createAuthRuntime({ baseUrl: BASE });
    const pending = runtime.client.get<{ ok: boolean }>("/sensitive/");

    await vi.waitFor(() =>
      expect(runtime.verification.machine.getState().step).toBe("picking")
    );

    await runtime.verification.chooseFactor("otp_email");
    const awaiting = runtime.verification.machine.getState();
    expect(awaiting.step).toBe("awaitingCode");
    if (awaiting.step === "awaitingCode") expect(awaiting.target).toBe("a***@b.com");

    await runtime.verification.submitCode({ code: "1234" });

    await expect(pending).resolves.toEqual({ ok: true });
    expect(sensitiveCalls).toBe(2);
    expect(runtime.verification.machine.getState().step).toBe("verified");
  });

  it("totp factor initiate is a no-op → straight to code input", async () => {
    server.use(
      http.get(`${BASE}/sensitive/`, ({ request }) =>
        request.headers.get("x-verification-token") === "vt_2"
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json(envelope(), { status: 403 })
      ),
      http.post(`${BASE}/verification/chg_1/initiate/`, () =>
        HttpResponse.json({ factor: "totp", data: {} })
      ),
      http.post(`${BASE}/verification/chg_1/complete/`, () =>
        HttpResponse.json({ verified: true, verification_token: "vt_2" })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    const pending = runtime.client.get("/sensitive/");
    await vi.waitFor(() =>
      expect(runtime.verification.machine.getState().step).toBe("picking")
    );
    await runtime.verification.chooseFactor("totp");
    const s = runtime.verification.machine.getState();
    expect(s.step).toBe("awaitingCode");
    if (s.step === "awaitingCode") expect(s.target).toBeNull();
    await runtime.verification.submitCode({ code: "123456" });
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it("wrong proof → factorError, then a correct retry completes", async () => {
    let completeCalls = 0;
    server.use(
      http.get(`${BASE}/sensitive/`, ({ request }) =>
        request.headers.get("x-verification-token") === "vt_ok"
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json(envelope(), { status: 403 })
      ),
      http.post(`${BASE}/verification/chg_1/initiate/`, () =>
        HttpResponse.json({ factor: "otp_email", data: { target: "a***@b.com" } })
      ),
      http.post(`${BASE}/verification/chg_1/complete/`, () => {
        completeCalls += 1;
        if (completeCalls === 1) {
          return HttpResponse.json(
            { localizable_error: "error.400.verification_failed" },
            { status: 400 }
          );
        }
        return HttpResponse.json({ verified: true, verification_token: "vt_ok" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    const pending = runtime.client.get("/sensitive/");
    await vi.waitFor(() =>
      expect(runtime.verification.machine.getState().step).toBe("picking")
    );
    await runtime.verification.chooseFactor("otp_email");
    await runtime.verification.submitCode({ code: "0000" });
    const errored = runtime.verification.machine.getState();
    expect(errored.step).toBe("factorError");

    await runtime.verification.submitCode({ code: "1234" });
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it("cancel resolves retry:false → the original 403 propagates", async () => {
    server.use(
      http.get(`${BASE}/sensitive/`, () =>
        HttpResponse.json(envelope(), { status: 403 })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    const pending = runtime.client.get("/sensitive/").catch((e: unknown) => e);
    await vi.waitFor(() =>
      expect(runtime.verification.machine.getState().step).toBe("picking")
    );
    runtime.verification.cancel();
    const err = await pending;
    expect(err).toBeInstanceOf(StapelApiError);
    expect((err as StapelApiError).code).toBe("error.403.verification_required");
    expect(runtime.verification.machine.getState().step).toBe("idle");
  });
});
