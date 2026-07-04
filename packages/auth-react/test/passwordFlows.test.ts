import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createPasswordLoginFlow } from "../src/flows/passwordLoginFlow.js";
import { createPasswordChangeFlow } from "../src/flows/passwordChangeFlow.js";
import { createPasswordResetFlow } from "../src/flows/passwordResetFlow.js";
import { BASE, authResponse, makeApi } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("passwordLoginFlow", () => {
  it("logs in without TOTP", async () => {
    server.use(
      http.post(`${BASE}/password/login/`, () =>
        HttpResponse.json(authResponse("LOGGED_IN"))
      )
    );
    const flow = createPasswordLoginFlow({ api: makeApi() });
    await flow.login("ada", "hunter2");
    expect(flow.machine.getState().step).toBe("authenticated");
  });

  it("branches to TOTP then completes via challenge verify", async () => {
    server.use(
      http.post(`${BASE}/password/login/`, () =>
        HttpResponse.json({
          status: "TOTP_REQUIRED",
          challenge_token: "ct_1",
          expires_in: 300,
        })
      ),
      http.post(`${BASE}/totp/challenge/verify/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          challenge_token: "ct_1",
          code: "123456",
        });
        return HttpResponse.json(authResponse("LOGGED_IN"));
      })
    );
    const flow = createPasswordLoginFlow({ api: makeApi() });
    await flow.login("ada", "hunter2");
    const totp = flow.machine.getState();
    expect(totp.step).toBe("totpRequired");
    if (totp.step === "totpRequired") expect(totp.challengeToken).toBe("ct_1");

    await flow.submitTotp({ code: "123456" });
    expect(flow.machine.getState().step).toBe("authenticated");
  });

  it("423 during TOTP verify invalidates the challenge (totpLocked)", async () => {
    server.use(
      http.post(`${BASE}/password/login/`, () =>
        HttpResponse.json({
          status: "TOTP_REQUIRED",
          challenge_token: "ct_1",
          expires_in: 300,
        })
      ),
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
    const flow = createPasswordLoginFlow({ api: makeApi() });
    await flow.login("ada", "hunter2");
    await flow.submitTotp({ code: "000000" });
    expect(flow.machine.getState().step).toBe("totpLocked");
  });

  it("wrong credentials → error", async () => {
    server.use(
      http.post(`${BASE}/password/login/`, () =>
        HttpResponse.json(
          { localizable_error: "error.401.invalid_credentials" },
          { status: 401 }
        )
      )
    );
    const flow = createPasswordLoginFlow({ api: makeApi() });
    await flow.login("ada", "wrong");
    const s = flow.machine.getState();
    expect(s.step).toBe("error");
    if (s.step === "error")
      expect(s.error.code).toBe("error.401.invalid_credentials");
  });
});

describe("passwordChangeFlow", () => {
  it("changes via old password", async () => {
    server.use(
      http.post(`${BASE}/password/change/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          old_password: "old",
          new_password: "new",
        });
        return HttpResponse.json({ status: "password_changed" });
      })
    );
    const flow = createPasswordChangeFlow({ api: makeApi() });
    await flow.changeWithPassword("old", "new");
    expect(flow.machine.getState().step).toBe("changed");
  });

  it("changes via email OTP tab", async () => {
    server.use(
      http.post(`${BASE}/password/change/otp/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/password/change/otp/verify/`, () =>
        HttpResponse.json({ status: "password_changed" })
      )
    );
    const flow = createPasswordChangeFlow({ api: makeApi() });
    await flow.requestOtp("email");
    expect(flow.machine.getState().step).toBe("otpSent");
    await flow.submitOtp("1234", "new");
    expect(flow.machine.getState().step).toBe("changed");
  });

  it("wrong old password → error", async () => {
    server.use(
      http.post(`${BASE}/password/change/`, () =>
        HttpResponse.json(
          { localizable_error: "error.400.wrong_password" },
          { status: 400 }
        )
      )
    );
    const flow = createPasswordChangeFlow({ api: makeApi() });
    await flow.changeWithPassword("bad", "new");
    const s = flow.machine.getState();
    expect(s.step).toBe("error");
  });
});

describe("passwordResetFlow", () => {
  it("request → verify with new password → authenticated", async () => {
    server.use(
      http.post(`${BASE}/password/reset/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/password/reset/email/verify/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          email: "a@b.com",
          code: "1234",
          new_password: "new",
        });
        return HttpResponse.json(authResponse("LOGGED_IN"));
      })
    );
    const flow = createPasswordResetFlow({ api: makeApi() });
    await flow.request("email", "a@b.com");
    await flow.submit("1234", "new");
    expect(flow.machine.getState().step).toBe("authenticated");
  });
});
