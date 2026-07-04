import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse, OtpChannel } from "../api/types.js";
import { createFlowMachine } from "./createFlowMachine.js";
import type { FlowMachine } from "./createFlowMachine.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Email / Phone OTP passwordless login (auth-sa.md §1–2). One machine serves
 * both channels — the only difference is the endpoint, carried in `channel`.
 *
 * Steps:
 *  - `idle`         → nothing requested yet
 *  - `requesting`   → POST /<channel>/request/ in flight
 *  - `codeSent`     → human-wait: enter the code (or resend)
 *  - `verifying`    → POST /<channel>/verify/ in flight
 *  - `authenticated`→ terminal success (AuthResponse)
 *  - `requestError` → request failed; retry
 *  - `codeError`    → wrong/expired code; human-wait, retry or resend
 *  - `locked`       → 423 lockout with `retry_after_minutes`
 */
export type OtpState =
  | { readonly step: "idle" }
  | { readonly step: "requesting"; readonly channel: OtpChannel; readonly value: string }
  | {
      readonly step: "codeSent";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly target: string;
    }
  | { readonly step: "verifying"; readonly channel: OtpChannel; readonly value: string; readonly target: string }
  | { readonly step: "authenticated"; readonly result: AuthResponse }
  | {
      readonly step: "requestError";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly error: FlowError;
    }
  | {
      readonly step: "codeError";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly target: string;
      readonly error: FlowError;
    }
  | {
      readonly step: "locked";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly error: FlowError;
    };

export interface OtpFlow {
  readonly machine: FlowMachine<OtpState>;
  /** Request a code for the identifier. `captchaToken` when the backend needs it. */
  requestCode(channel: OtpChannel, value: string, captchaToken?: string): Promise<void>;
  /** Resend the code for the current identifier (respect the 30 s rate limit). */
  resend(captchaToken?: string): Promise<void>;
  /** Verify the entered code. */
  submitCode(code: string): Promise<void>;
  /** Return to `idle`. */
  reset(): void;
}

export interface OtpFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  /** Called with the session-bearing response on success (token persistence). */
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

const LOCKED_STATUS = 423;

export function createOtpFlow(deps: OtpFlowDeps): OtpFlow {
  const machine = createFlowMachine<OtpState>({
    id: "auth.otp",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function requestCode(
    channel: OtpChannel,
    value: string,
    captchaToken?: string
  ): Promise<void> {
    await machine.run(
      { step: "requesting", channel, value },
      () => deps.api.otpRequest(channel, value, captchaToken),
      {
        resolve: (r): OtpState => ({
          step: "codeSent",
          channel,
          value,
          target: r.target,
        }),
        reject: (error): OtpState => {
          const flowError = toFlowError(error);
          if (flowError.status === LOCKED_STATUS) {
            return { step: "locked", channel, value, error: flowError };
          }
          return { step: "requestError", channel, value, error: flowError };
        },
      }
    );
  }

  function currentIdentifier(): { channel: OtpChannel; value: string } | null {
    const s = machine.getState();
    if (
      s.step === "codeSent" ||
      s.step === "verifying" ||
      s.step === "codeError" ||
      s.step === "requestError" ||
      s.step === "requesting"
    ) {
      return { channel: s.channel, value: s.value };
    }
    return null;
  }

  async function resend(captchaToken?: string): Promise<void> {
    const id = currentIdentifier();
    if (id === null) return;
    await requestCode(id.channel, id.value, captchaToken);
  }

  async function submitCode(code: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "codeSent" && s.step !== "codeError") return;
    const { channel, value, target } = s;
    await machine.run(
      { step: "verifying", channel, value, target },
      () => deps.api.otpVerify(channel, value, code),
      {
        resolve: (result): OtpState => {
          deps.onAuthenticated?.(result);
          return { step: "authenticated", result };
        },
        reject: (error): OtpState => {
          const flowError = toFlowError(error);
          if (flowError.status === LOCKED_STATUS) {
            return { step: "locked", channel, value, error: flowError };
          }
          return { step: "codeError", channel, value, target, error: flowError };
        },
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, requestCode, resend, submitCode, reset };
}
