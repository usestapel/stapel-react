import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createOtpFlow } from "../src/flows/otpFlow.js";
import { BASE, authResponse, makeApi } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("otpFlow (email/phone passwordless)", () => {
  it("request → codeSent → verify → authenticated (happy path)", async () => {
    server.use(
      http.post(`${BASE}/email/request/`, async ({ request }) => {
        expect(request.headers.get("x-requested-with")).toBe("XMLHttpRequest");
        expect(await request.json()).toEqual({ email: "a@b.com" });
        return HttpResponse.json({ message: "sent", target: "a***@b.com" });
      }),
      http.post(`${BASE}/email/verify/`, async ({ request }) => {
        expect(await request.json()).toEqual({ email: "a@b.com", code: "1234" });
        return HttpResponse.json(authResponse("LOGGED_IN"));
      })
    );

    const adopted: string[] = [];
    const flow = createOtpFlow({
      api: makeApi(),
      onAuthenticated: (r) => adopted.push(r.status),
    });

    await flow.requestCode("email", "a@b.com");
    const sent = flow.machine.getState();
    expect(sent.step).toBe("codeSent");
    if (sent.step === "codeSent") expect(sent.target).toBe("a***@b.com");

    await flow.submitCode("1234");
    expect(flow.machine.getState().step).toBe("authenticated");
    expect(adopted).toEqual(["LOGGED_IN"]);
  });

  it("wrong code → codeError, keeps identifier for retry", async () => {
    server.use(
      http.post(`${BASE}/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/email/verify/`, () =>
        HttpResponse.json(
          { localizable_error: "error.400.invalid_code", error: "bad" },
          { status: 400 }
        )
      )
    );
    const flow = createOtpFlow({ api: makeApi() });
    await flow.requestCode("email", "a@b.com");
    await flow.submitCode("0000");
    const s = flow.machine.getState();
    expect(s.step).toBe("codeError");
    if (s.step === "codeError") {
      expect(s.error.code).toBe("error.400.invalid_code");
      expect(s.value).toBe("a@b.com");
    }
  });

  it("423 lockout on verify → locked with retry_after_minutes", async () => {
    server.use(
      http.post(`${BASE}/phone/request/`, () =>
        HttpResponse.json({ message: "sent", target: "+7***67" })
      ),
      http.post(`${BASE}/phone/verify/`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.423.account_locked",
            params: { retry_after_minutes: 15 },
          },
          { status: 423 }
        )
      )
    );
    const flow = createOtpFlow({ api: makeApi() });
    await flow.requestCode("phone", "+79991234567");
    await flow.submitCode("0000");
    const s = flow.machine.getState();
    expect(s.step).toBe("locked");
    if (s.step === "locked") {
      expect(s.error.params["retry_after_minutes"]).toBe(15);
    }
  });

  it("resend re-requests for the current identifier", async () => {
    let requests = 0;
    server.use(
      http.post(`${BASE}/email/request/`, () => {
        requests += 1;
        return HttpResponse.json({ message: "sent", target: "a***@b.com" });
      })
    );
    const flow = createOtpFlow({ api: makeApi() });
    await flow.requestCode("email", "a@b.com");
    await flow.resend();
    expect(requests).toBe(2);
  });

  it("emits flow analytics for each transition", async () => {
    server.use(
      http.post(`${BASE}/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      )
    );
    const track = vi.fn();
    const analytics = {
      track,
      identify: vi.fn(),
      page: vi.fn(),
      flush: vi.fn(),
      setConsent: vi.fn(),
      getConsent: () => "granted" as const,
      register: vi.fn(),
      unregister: vi.fn(),
    };
    const flow = createOtpFlow({ api: makeApi(), analytics });
    await flow.requestCode("email", "a@b.com");
    const names = track.mock.calls.map((c) => c[0] as string);
    // Canonical flow id from flows.json (email/phone OTP = passwordless_login).
    expect(names).toContain("flow.auth.passwordless_login.requesting");
    expect(names).toContain("flow.auth.passwordless_login.codeSent");
  });
});
