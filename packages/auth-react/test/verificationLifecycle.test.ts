import { afterEach, describe, expect, it, vi } from "vitest";
import { StapelApiError } from "@stapel/core";
import type { VerificationChallenge } from "@stapel/core";
import { createVerificationController } from "../src/flows/verificationFlow.js";
import type { AuthApi } from "../src/api/authApi.js";

afterEach(() => {
  vi.useRealTimers();
});

function challenge(
  id: string,
  factors: string[],
  expiresInSec: number
): VerificationChallenge {
  return {
    challenge_id: id,
    scope: "payout",
    factors,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  };
}

/** Build a fake AuthApi exposing only the two methods the controller calls. */
function fakeApi(
  overrides: Partial<
    Pick<AuthApi, "verificationInitiate" | "verificationComplete">
  >
): AuthApi {
  return {
    verificationInitiate: overrides.verificationInitiate ?? vi.fn(),
    verificationComplete: overrides.verificationComplete ?? vi.fn(),
  } as unknown as AuthApi;
}

describe("verification lifecycle (A2)", () => {
  it("self-releases on expiry and unwedges future challenges", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const controller = createVerificationController({
      api: () => fakeApi({}),
    });

    const outcome = controller.handler(challenge("c1", ["totp"], 300));
    expect(controller.machine.getState().step).toBe("picking");

    await vi.advanceTimersByTimeAsync(300_000);
    await expect(outcome).resolves.toEqual({ retry: false });
    expect(controller.machine.getState().step).toBe("expired");

    // The subsystem is NOT wedged: a new challenge is handled, not declined.
    const outcome2 = controller.handler(challenge("c2", ["totp"], 300));
    expect(controller.machine.getState().step).toBe("picking");
    controller.cancel();
    await expect(outcome2).resolves.toEqual({ retry: false });
  });

  it("a locked factor returns to the picker; another factor still verifies", async () => {
    const api = fakeApi({
      verificationInitiate: vi.fn((_id: string, factor: string) => {
        if (factor === "otp_email") {
          return Promise.reject(
            new StapelApiError({
              code: "error.423.verification_locked",
              message: "locked",
              status: 423,
            })
          );
        }
        return Promise.resolve({ factor: "totp", data: {} });
      }),
      verificationComplete: vi.fn(() =>
        Promise.resolve({ verified: true, verification_token: "vt" })
      ),
    });
    const controller = createVerificationController({ api: () => api });

    const outcome = controller.handler(
      challenge("c1", ["otp_email", "totp"], 300)
    );
    await controller.chooseFactor("otp_email");
    const picking = controller.machine.getState();
    expect(picking.step).toBe("picking");
    if (picking.step === "picking") {
      expect(picking.error?.code).toBe("error.423.verification_locked");
      expect(picking.challenge.challenge_id).toBe("c1"); // still alive
    }

    await controller.chooseFactor("totp");
    expect(controller.machine.getState().step).toBe("awaitingCode");
    await controller.submitCode({ code: "123456" });
    await expect(outcome).resolves.toEqual({ retry: true, token: "vt" });
  });

  it("a 404 on initiate ends the whole challenge (settles retry:false)", async () => {
    const api = fakeApi({
      verificationInitiate: vi.fn(() =>
        Promise.reject(
          new StapelApiError({
            code: "error.404.verification_challenge_not_found",
            message: "gone",
            status: 404,
          })
        )
      ),
    });
    const controller = createVerificationController({ api: () => api });
    const outcome = controller.handler(challenge("c1", ["otp_email"], 300));
    await controller.chooseFactor("otp_email");
    expect(controller.machine.getState().step).toBe("unavailable");
    await expect(outcome).resolves.toEqual({ retry: false });
  });

  it("cancel during an in-flight verify wins over the late success (R1 in the controller)", async () => {
    let releaseComplete!: (v: {
      verified: boolean;
      verification_token: string;
    }) => void;
    const api = fakeApi({
      verificationInitiate: vi.fn(() =>
        Promise.resolve({ factor: "totp", data: {} })
      ),
      verificationComplete: vi.fn(
        () =>
          new Promise((res) => {
            releaseComplete = res;
          })
      ),
    });
    const controller = createVerificationController({ api: () => api });

    const outcome = controller.handler(challenge("c1", ["totp"], 300));
    await controller.chooseFactor("totp");
    const submit = controller.submitCode({ code: "111111" });
    expect(controller.machine.getState().step).toBe("verifying");

    controller.cancel();
    expect(controller.machine.getState().step).toBe("idle");

    // The verify resolves AFTER the cancel — it must not show "verified".
    releaseComplete({ verified: true, verification_token: "vt" });
    await submit;
    expect(controller.machine.getState().step).toBe("idle");
    await expect(outcome).resolves.toEqual({ retry: false });
  });
});
