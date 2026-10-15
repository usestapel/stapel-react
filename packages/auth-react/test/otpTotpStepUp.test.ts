import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createOtpFlow } from "../src/flows/otpFlow.js";
import { BASE, authResponse, makeApi } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function sentAndVerify(channel: "email" | "phone", verifyBody: unknown): void {
  server.use(
    http.post(`${BASE}/${channel}/request/`, () =>
      HttpResponse.json({ message: "sent", target: "a***" })
    ),
    http.post(`${BASE}/${channel}/verify/`, () => HttpResponse.json(verifyBody))
  );
}

const TOTP_CHALLENGE = {
  status: "TOTP_REQUIRED",
  challenge_token: "ct_otp",
  expires_in: 300,
};

describe("otpFlow — verify answers the login union", () => {
  it("TOTP_REQUIRED parks in totpRequired and adopts no session", async () => {
    sentAndVerify("email", TOTP_CHALLENGE);
    const onAuthenticated = vi.fn();
    const flow = createOtpFlow({ api: makeApi(), onAuthenticated });
    await flow.requestCode("email", "a@b.com");
    await flow.submitCode("123456");
    const s = flow.machine.getState();
    expect(s.step).toBe("totpRequired");
    if (s.step === "totpRequired") {
      expect(s.challengeToken).toBe("ct_otp");
      expect(s.expiresIn).toBe(300);
    }
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("submitTotp success → authenticated and the session is adopted", async () => {
    sentAndVerify("phone", TOTP_CHALLENGE);
    server.use(
      http.post(`${BASE}/totp/challenge/verify/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          challenge_token: "ct_otp",
          code: "654321",
        });
        return HttpResponse.json(authResponse("LOGGED_IN"));
      })
    );
    const onAuthenticated = vi.fn();
    const flow = createOtpFlow({ api: makeApi(), onAuthenticated });
    await flow.requestCode("phone", "+79990000000");
    await flow.submitCode("123456");
    await flow.submitTotp({ code: "654321" });
    expect(flow.machine.getState().step).toBe("authenticated");
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(onAuthenticated.mock.calls[0]?.[0].status).toBe("LOGGED_IN");
  });

  it("a wrong TOTP code → totpError, keeps the challenge for retry", async () => {
    sentAndVerify("email", TOTP_CHALLENGE);
    server.use(
      http.post(`${BASE}/totp/challenge/verify/`, () =>
        HttpResponse.json(
          { localizable_error: "error.400.invalid_code" },
          { status: 400 }
        )
      )
    );
    const flow = createOtpFlow({ api: makeApi() });
    await flow.requestCode("email", "a@b.com");
    await flow.submitCode("123456");
    await flow.submitTotp({ code: "000000" });
    const s = flow.machine.getState();
    expect(s.step).toBe("totpError");
    if (s.step === "totpError") expect(s.challengeToken).toBe("ct_otp");
  });

  it("423 during TOTP verify → totpLocked (challenge invalidated)", async () => {
    sentAndVerify("email", TOTP_CHALLENGE);
    server.use(
      http.post(`${BASE}/totp/challenge/verify/`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.423.account_locked",
            params: { retry_after_minutes: 15 },
          },
          { status: 423 }
        )
      )
    );
    const onAuthenticated = vi.fn();
    const flow = createOtpFlow({ api: makeApi(), onAuthenticated });
    await flow.requestCode("email", "a@b.com");
    await flow.submitCode("123456");
    await flow.submitTotp({ backup_code: "abcd-efgh" });
    expect(flow.machine.getState().step).toBe("totpLocked");
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("FIRST_LOGIN_REQUIRED password_change → passwordChangeRequired, no session", async () => {
    sentAndVerify("email", {
      status: "FIRST_LOGIN_REQUIRED",
      requires: "password_change",
      challenge_token: "flc-1",
      expires_in: 600,
    });
    const onAuthenticated = vi.fn();
    const flow = createOtpFlow({ api: makeApi(), onAuthenticated });
    await flow.requestCode("email", "a@b.com");
    await flow.submitCode("123456");
    const s = flow.machine.getState();
    expect(s.step).toBe("passwordChangeRequired");
    if (s.step === "passwordChangeRequired") expect(s.challengeToken).toBe("flc-1");
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("FIRST_LOGIN_REQUIRED mfa_enroll → mfaEnrollRequired", async () => {
    sentAndVerify("email", {
      status: "FIRST_LOGIN_REQUIRED",
      requires: "mfa_enroll",
      challenge_token: "flc-2",
      expires_in: 600,
    });
    const flow = createOtpFlow({ api: makeApi() });
    await flow.requestCode("email", "a@b.com");
    await flow.submitCode("123456");
    expect(flow.machine.getState().step).toBe("mfaEnrollRequired");
  });

  it("submitTotp outside a TOTP step is a no-op", async () => {
    const flow = createOtpFlow({ api: makeApi() });
    await flow.submitTotp({ code: "123456" });
    expect(flow.machine.getState().step).toBe("idle");
  });
});
