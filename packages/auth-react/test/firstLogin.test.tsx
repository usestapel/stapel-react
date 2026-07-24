/**
 * First-login enforcement (org-program §C2, stapel-auth 0.12.0): the login
 * intermediates' routing in passwordLoginFlow, the forced-password-change
 * machine (incl. the both-flags chain), the mfa-enroll machine, and the two
 * headless components — ForcedPasswordChange's submit and MfaEnrollGate's
 * end-to-end completion (enroll-scoped client → TotpSetup → full session).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createPasswordLoginFlow } from "../src/flows/passwordLoginFlow.js";
import {
  createForcedPasswordChangeFlow,
  createMfaEnrollFlow,
} from "../src/flows/firstLoginFlow.js";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { ForcedPasswordChange, MfaEnrollGate } from "../src/headless/FirstLogin.js";
import { TotpSetup } from "../src/headless/TotpSetup.js";
import { registerAuthI18n } from "../src/i18n/keys.js";
import { BASE, authResponse, makeApi, testUser } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function firstLoginChallenge(
  requires: "password_change" | "mfa_enroll",
  token = "flc-1"
) {
  return {
    status: "FIRST_LOGIN_REQUIRED",
    requires,
    challenge_token: token,
    expires_in: 600,
  };
}

// ── passwordLoginFlow routes the intermediates ───────────────────────────────

describe("passwordLoginFlow — FIRST_LOGIN_REQUIRED intermediates", () => {
  it("requires=password_change parks in passwordChangeRequired (no session adopted)", async () => {
    server.use(
      http.post(`${BASE}/password/login/`, () =>
        HttpResponse.json(firstLoginChallenge("password_change"))
      )
    );
    const onAuthenticated = vi.fn();
    const flow = createPasswordLoginFlow({ api: makeApi(), onAuthenticated });
    await flow.login("acme/pat", "temp-password");
    const s = flow.machine.getState();
    expect(s.step).toBe("passwordChangeRequired");
    if (s.step === "passwordChangeRequired") {
      expect(s.challengeToken).toBe("flc-1");
      expect(s.requires).toBe("password_change");
    }
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("requires=mfa_enroll parks in mfaEnrollRequired", async () => {
    server.use(
      http.post(`${BASE}/password/login/`, () =>
        HttpResponse.json(firstLoginChallenge("mfa_enroll"))
      )
    );
    const flow = createPasswordLoginFlow({ api: makeApi() });
    await flow.login("acme/pat", "temp-password");
    expect(flow.machine.getState().step).toBe("mfaEnrollRequired");
  });
});

// ── forcedPasswordChangeFlow ─────────────────────────────────────────────────

describe("forcedPasswordChangeFlow", () => {
  it("submits the challenge + new password and adopts the session", async () => {
    server.use(
      http.post(`${BASE}/password/forced-change/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          challenge_token: "flc-1",
          new_password: "my-own-password",
        });
        return HttpResponse.json(authResponse("LOGGED_IN"));
      })
    );
    const onAuthenticated = vi.fn();
    const flow = createForcedPasswordChangeFlow({
      api: makeApi(),
      challengeToken: "flc-1",
      onAuthenticated,
    });
    await flow.submit("my-own-password");
    expect(flow.machine.getState().step).toBe("authenticated");
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("a rejected password does not consume the challenge — error is retryable", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/password/forced-change/`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { localizable_error: "error.400.validation_error" },
            { status: 400 }
          );
        }
        return HttpResponse.json(authResponse("LOGGED_IN"));
      })
    );
    const flow = createForcedPasswordChangeFlow({
      api: makeApi(),
      challengeToken: "flc-1",
    });
    await flow.submit("short");
    const s = flow.machine.getState();
    expect(s.step).toBe("error");
    if (s.step === "error") expect(s.error.code).toBe("error.400.validation_error");

    await flow.submit("long-enough-now");
    expect(flow.machine.getState().step).toBe("authenticated");
  });

  it("both policy flags: the change chains into the mfa_enroll challenge", async () => {
    server.use(
      http.post(`${BASE}/password/forced-change/`, () =>
        HttpResponse.json(firstLoginChallenge("mfa_enroll", "flc-2"))
      )
    );
    const onAuthenticated = vi.fn();
    const flow = createForcedPasswordChangeFlow({
      api: makeApi(),
      challengeToken: "flc-1",
      onAuthenticated,
    });
    await flow.submit("my-own-password");
    const s = flow.machine.getState();
    expect(s.step).toBe("mfaEnrollRequired");
    if (s.step === "mfaEnrollRequired") expect(s.challengeToken).toBe("flc-2");
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});

// ── mfaEnrollFlow ────────────────────────────────────────────────────────────

describe("mfaEnrollFlow", () => {
  it("exchanges the challenge for the limited enroll session", async () => {
    server.use(
      http.post(`${BASE}/mfa/enroll/exchange/`, async ({ request }) => {
        expect(await request.json()).toEqual({ challenge_token: "flc-2" });
        return HttpResponse.json({
          status: "MFA_ENROLL_SESSION",
          access: "enroll-access",
          expires_in: 3600,
        });
      })
    );
    const flow = createMfaEnrollFlow({ api: makeApi(), challengeToken: "flc-2" });
    await flow.exchange();
    const s = flow.machine.getState();
    expect(s.step).toBe("enrolling");
    if (s.step === "enrolling") expect(s.session.access).toBe("enroll-access");
  });

  it("an invalid challenge is terminal (exchangeError)", async () => {
    server.use(
      http.post(`${BASE}/mfa/enroll/exchange/`, () =>
        HttpResponse.json(
          { localizable_error: "error.400.first_login_challenge_invalid" },
          { status: 400 }
        )
      )
    );
    const flow = createMfaEnrollFlow({ api: makeApi(), challengeToken: "dead" });
    await flow.exchange();
    const s = flow.machine.getState();
    expect(s.step).toBe("exchangeError");
    if (s.step === "exchangeError") {
      expect(s.error.code).toBe("error.400.first_login_challenge_invalid");
    }
  });

  it("complete(tokens) settles authenticated through onAuthenticated; complete(null) is a wiring error", async () => {
    server.use(
      http.post(`${BASE}/mfa/enroll/exchange/`, () =>
        HttpResponse.json({
          status: "MFA_ENROLL_SESSION",
          access: "enroll-access",
          expires_in: 3600,
        })
      )
    );
    const onAuthenticated = vi.fn();
    const flow = createMfaEnrollFlow({
      api: makeApi(),
      challengeToken: "flc-2",
      onAuthenticated,
    });
    await flow.exchange();
    flow.complete({ access: "acc-full", refresh: "ref-full" });
    expect(flow.machine.getState().step).toBe("authenticated");
    expect(onAuthenticated).toHaveBeenCalledWith({
      access: "acc-full",
      refresh: "ref-full",
    });

    // The null branch, on a fresh machine.
    const flow2 = createMfaEnrollFlow({ api: makeApi(), challengeToken: "flc-2" });
    await flow2.exchange();
    flow2.complete(null);
    const s2 = flow2.machine.getState();
    expect(s2.step).toBe("completeError");
    if (s2.step === "completeError") {
      expect(s2.error.code).toBe("auth.mfaEnroll.error.no_tokens");
    }
  });
});

// ── headless components ──────────────────────────────────────────────────────

function wrap(runtime: AuthRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerAuthI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <AuthProvider runtime={runtime}>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("<ForcedPasswordChange> (headless)", () => {
  it("submits and adopts the session through the runtime", async () => {
    server.use(
      http.post(`${BASE}/password/forced-change/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          challenge_token: "flc-1",
          new_password: "brand-new-pass",
        });
        return HttpResponse.json(authResponse("LOGGED_IN"));
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <ForcedPasswordChange challengeToken="flc-1">
          {(bag) => (
            <div>
              <span data-testid="step">{bag.state.step}</span>
              <button onClick={() => bag.submit("brand-new-pass")}>go</button>
            </div>
          )}
        </ForcedPasswordChange>
      )
    );
    screen.getByText("go").click();
    await waitFor(() =>
      expect(screen.getByTestId("step").textContent).toBe("authenticated")
    );
    // The runtime session adopted the AuthResponse (user + tokens).
    expect(runtime.session.getState().status).toBe("authenticated");
    expect(runtime.session.getState().user?.username).toBe(testUser().username);
  });

  it("fires onEnrollRequired once when the change chains into mfa_enroll", async () => {
    server.use(
      http.post(`${BASE}/password/forced-change/`, () =>
        HttpResponse.json(firstLoginChallenge("mfa_enroll", "flc-2"))
      )
    );
    const onEnrollRequired = vi.fn();
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <ForcedPasswordChange challengeToken="flc-1" onEnrollRequired={onEnrollRequired}>
          {(bag) => (
            <div>
              <span data-testid="step">{bag.state.step}</span>
              <button onClick={() => bag.submit("brand-new-pass")}>go</button>
            </div>
          )}
        </ForcedPasswordChange>
      )
    );
    screen.getByText("go").click();
    await waitFor(() =>
      expect(screen.getByTestId("step").textContent).toBe("mfaEnrollRequired")
    );
    await waitFor(() =>
      expect(onEnrollRequired).toHaveBeenCalledWith("flc-2", 600)
    );
    expect(onEnrollRequired).toHaveBeenCalledOnce();
  });
});

describe("<MfaEnrollGate> (headless, end-to-end completion)", () => {
  it("exchanges, scopes the enroll token onto the wrapped TotpSetup, and commits the full session on complete", async () => {
    server.use(
      http.post(`${BASE}/mfa/enroll/exchange/`, () =>
        HttpResponse.json({
          status: "MFA_ENROLL_SESSION",
          access: "enroll-access",
          expires_in: 3600,
        })
      ),
      http.post(`${BASE}/totp/setup/`, ({ request }) => {
        // THE POINT of the nested runtime: the wrapped TotpSetup's calls ride
        // the LIMITED enroll session's access token, not the (absent) full one.
        expect(request.headers.get("authorization")).toBe("Bearer enroll-access");
        return HttpResponse.json({
          secret: "SECRET",
          qr_uri: "otpauth://totp/demo",
          expires_in: 300,
        });
      }),
      http.post(`${BASE}/totp/setup/confirm/`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer enroll-access");
        // Enroll-mode confirm returns the full-session pair (0.12.0 contract).
        return HttpResponse.json({
          backup_codes: ["11111111", "22222222"],
          tokens: { access: "acc-full", refresh: "ref-full" },
        });
      }),
      // session.setTokens resolves the user via me() before settling.
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser()))
    );

    const onAuthenticated = vi.fn();
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    render(
      wrap(
        runtime,
        <MfaEnrollGate challengeToken="flc-2" onAuthenticated={onAuthenticated}>
          {(bag) => (
            <div>
              <span data-testid="gate-step">{bag.state.step}</span>
              <span data-testid="gate-methods">{bag.methods.join(",")}</span>
              {(bag.state.step === "enrolling" ||
                bag.state.step === "completing" ||
                bag.state.step === "authenticated") && (
                <TotpSetup>
                  {(setup) => (
                    <div>
                      <span data-testid="setup-step">{setup.state.step}</span>
                      <button onClick={() => setup.start()}>start</button>
                      <button onClick={() => setup.confirm("123456")}>confirm</button>
                      {setup.state.step === "done" && (
                        <button
                          onClick={() =>
                            bag.complete(
                              setup.state.step === "done" ? setup.state.tokens : null
                            )
                          }
                        >
                          finish
                        </button>
                      )}
                    </div>
                  )}
                </TotpSetup>
              )}
            </div>
          )}
        </MfaEnrollGate>
      )
    );

    // The gate auto-exchanges on mount.
    await waitFor(() =>
      expect(screen.getByTestId("gate-step").textContent).toBe("enrolling")
    );
    expect(screen.getByTestId("gate-methods").textContent).toBe("totp,passkey");

    screen.getByText("start").click();
    await waitFor(() =>
      expect(screen.getByTestId("setup-step").textContent).toBe("enrolling")
    );
    screen.getByText("confirm").click();
    await waitFor(() =>
      expect(screen.getByTestId("setup-step").textContent).toBe("done")
    );

    screen.getByText("finish").click();
    await waitFor(() =>
      expect(screen.getByTestId("gate-step").textContent).toBe("authenticated")
    );
    // Full session committed through the runtime (setTokens → me()).
    await waitFor(() =>
      expect(runtime.session.getState().status).toBe("authenticated")
    );
    expect(runtime.session.getAccessToken()).toBe("acc-full");
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
  });
});
