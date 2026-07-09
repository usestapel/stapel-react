// Typed-analytics demonstration on the auth pair (frontend-guardrails §3,
// item 6). Deliberately NOT a full annotation of the pair — just enough to
// prove the three moving parts end to end:
//   1. flow-machine auto-instrumentation → the passwordless login funnel emits
//      flow.auth.passwordless_login.<step> (incl. the terminal success) for
//      free, no hand-written tracking;
//   2. a typed defineEvent + tracked() click (the one hand-authored example);
//   3. the double-count guard: tracked() wrapping a flow-stepping handler warns.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  createAnalytics,
  createTracked,
  defineEvent,
  prop,
} from "@stapel/analytics";
import type { AnalyticsProvider, PersistStorage } from "@stapel/core";
import { createOtpFlow } from "../src/flows/otpFlow.js";
import { BASE, authResponse, makeApi } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Per-test in-memory storage — avoids the shared default persist key. */
function memStore(): PersistStorage {
  const m = new Map<string, unknown>();
  return {
    get: (k) => Promise.resolve(m.get(k)),
    set: (k, v) => {
      m.set(k, v);
      return Promise.resolve();
    },
    del: (k) => {
      m.delete(k);
      return Promise.resolve();
    },
  };
}

function collector(): { names: string[]; provider: AnalyticsProvider } {
  const names: string[] = [];
  return { names, provider: { track: (e) => void names.push(e.name) } };
}

/** A defineEvent an app might declare next to an auth screen. */
const signInCtaClicked = defineEvent({
  name: "auth.sign_in_cta.clicked",
  description: "User clicked the sign-in CTA on the marketing header",
  props: {
    placement: prop.oneOf(["header", "hero", "footer"], "Where the CTA sat"),
  },
  flow: "auth.passwordless_login",
});

describe("auth typed analytics (demonstration)", () => {
  it("passwordless login funnel auto-instruments to the terminal success", async () => {
    server.use(
      http.post(`${BASE}/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/email/verify/`, () =>
        HttpResponse.json(authResponse("LOGGED_IN"))
      )
    );
    const { names, provider } = collector();
    const analytics = createAnalytics({
      providers: { c: provider },
      consent: "granted",
      storage: memStore(),
    });
    const flow = createOtpFlow({ api: makeApi(), analytics });

    await flow.requestCode("email", "a@b.com");
    await flow.submitCode("1234");
    await analytics.flush();

    // The funnel exists without a single hand-written track() call.
    expect(names).toContain("flow.auth.passwordless_login.requesting");
    expect(names).toContain("flow.auth.passwordless_login.codeSent");
    expect(names).toContain("flow.auth.passwordless_login.verifying");
    // …up to the terminal success step ("auth.login.succeeded", §6 item 6).
    expect(names).toContain("flow.auth.passwordless_login.authenticated");
  });

  it("tracked() emits the typed event then runs the handler", async () => {
    const { names, provider } = collector();
    const analytics = createAnalytics({
      providers: { c: provider },
      consent: "granted",
      storage: memStore(),
    });
    const { tracked } = createTracked(analytics);
    let ran = false;
    const onClick = tracked(signInCtaClicked, { placement: "header" }, () => {
      ran = true;
    });

    onClick();
    await analytics.flush();

    expect(ran).toBe(true);
    expect(names).toEqual(["auth.sign_in_cta.clicked"]);
  });

  it("warns when tracked() wraps a handler that steps the flow (double count)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const analytics = createAnalytics({ consent: "granted", storage: memStore() });
      const { tracked } = createTracked(analytics);
      const flow = createOtpFlow({ api: makeApi(), analytics });
      // The anti-pattern G4 forbids statically; the runtime backs it in dev.
      const onClick = tracked(signInCtaClicked, { placement: "hero" }, () => {
        flow.reset(); // steps the machine → emits flow.auth.passwordless_login.idle
      });
      onClick();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("double-count"));
    } finally {
      warn.mockRestore();
    }
  });
});
