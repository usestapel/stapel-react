/**
 * `posture` — the deployment's own declaration of what kind of installation
 * this is (stapel-auth ≥0.36.0, carrying stapel-core 0.64.0's posture stage).
 *
 * It is a READ-ONLY PASS-THROUGH: `GET /capabilities/` carries it, the pair
 * hands it to the host verbatim, and NOTHING in this package branches on it.
 * These tests are the teeth of that sentence — they assert the value survives
 * the api layer and the query hook unchanged, including the "no posture
 * declared" shape (both fields null) and a field the pair has never heard of,
 * which must not be dropped on the way through.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { createAuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { useCapabilities } from "../src/model/queries.js";
import type { Capabilities, PostureInfo } from "../src/api/types.js";
import { BASE, makeApi } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** The minimum body `AuthCapabilities` requires, plus whatever posture we test. */
function capabilitiesBody(posture: unknown): Record<string, unknown> {
  return {
    registration: {
      phone: true,
      email: true,
      password: false,
      oauth: [],
      sso: false,
      anonymous: true,
    },
    login: {
      phone: true,
      email: true,
      password: true,
      oauth: [],
      sso: false,
      qr: false,
      passkey: false,
      magic_link: false,
    },
    methods: [
      {
        id: "email",
        enabled: true,
        placement: "main",
        order: 0,
        interaction: "inline",
        can_login: true,
        can_register: true,
      },
    ],
    mfa: { totp: false, passkey: false },
    otp: {
      email_code_length: 6,
      phone_code_length: 6,
      totp_code_length: 6,
      ttl_seconds: 600,
      resend_cooldown_seconds: 60,
    },
    posture,
  };
}

function PostureProbe(): ReactElement {
  const { data } = useCapabilities();
  return (
    <span data-testid="posture">
      {data ? `${String(data.posture.preset)}/${String(data.posture.stage)}` : "none"}
    </span>
  );
}

describe("posture rides through the capabilities bag untouched", () => {
  it("the api layer hands back preset and stage exactly as the deployment declared them", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json(
          capabilitiesBody({ preset: "public_space", stage: "prototype" })
        )
      )
    );

    const caps = await makeApi().capabilities();

    expect(caps.posture).toEqual({ preset: "public_space", stage: "prototype" });
  });

  it("a deployment that declares NO posture answers nulls, and nulls are what the caller gets", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json(capabilitiesBody({ preset: null, stage: null }))
      )
    );

    const caps = await makeApi().capabilities();

    // Not coerced to undefined, not defaulted to "live": a deployment with no
    // declaration is a distinct answer from one that declared a live stage.
    expect(caps.posture.preset).toBeNull();
    expect(caps.posture.stage).toBeNull();
  });

  it("useCapabilities exposes it to the host without the pair reading or rewriting it", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json(capabilitiesBody({ preset: "private_space", stage: "live" }))
      )
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider runtime={createAuthRuntime({ baseUrl: BASE })}>
          <PostureProbe />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("posture").textContent).toBe("private_space/live")
    );
  });

  it("a posture field this pair has never heard of survives the trip", async () => {
    // Pass-through means pass-through: the pair does not project the object
    // onto a hand-written shape, so a field a newer backend adds reaches the
    // host instead of being silently dropped.
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json(
          capabilitiesBody({
            preset: "public_space",
            stage: "live",
            announced_at: "2026-09-11T00:00:00Z",
          })
        )
      )
    );

    const caps = await makeApi().capabilities();

    expect((caps.posture as Record<string, unknown>).announced_at).toBe(
      "2026-09-11T00:00:00Z"
    );
  });

  it("PostureInfo is the generated shape, and it is what the bag carries", () => {
    // Type-level: a compile error here is the failure. `PostureInfo` must be
    // exactly `Capabilities["posture"]` — if the pair ever re-typed or
    // narrowed the field by hand, these assignments stop compiling.
    const declared: PostureInfo = { preset: "public_space", stage: "prototype" };
    const fromBag: Capabilities["posture"] = declared;
    const backAgain: PostureInfo = fromBag;

    expect(backAgain.stage).toBe("prototype");
  });
});
