import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse, OtpChannel } from "../api/types.js";
import { createFlowMachine } from "./createFlowMachine.js";
import type { FlowMachine } from "./createFlowMachine.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Unauthenticated password reset (auth-sa.md §5). User proves ownership of an
 * email/phone via OTP and receives a fresh session with the new password. The
 * verify step carries the new password, so this is a two-input human-wait
 * (`codeSent`): code + new password together.
 */
export type PasswordResetState =
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
    };

export interface PasswordResetFlow {
  readonly machine: FlowMachine<PasswordResetState>;
  request(channel: OtpChannel, value: string): Promise<void>;
  resend(): Promise<void>;
  submit(code: string, newPassword: string): Promise<void>;
  reset(): void;
}

export interface PasswordResetFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

export function createPasswordResetFlow(
  deps: PasswordResetFlowDeps
): PasswordResetFlow {
  const machine = createFlowMachine<PasswordResetState>({
    id: "auth.password_reset",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function request(channel: OtpChannel, value: string): Promise<void> {
    await machine.run(
      { step: "requesting", channel, value },
      () => deps.api.passwordResetRequest(channel, value),
      {
        resolve: (r): PasswordResetState => ({
          step: "codeSent",
          channel,
          value,
          target: r.target,
        }),
        reject: (error): PasswordResetState => ({
          step: "requestError",
          channel,
          value,
          error: toFlowError(error),
        }),
      }
    );
  }

  async function resend(): Promise<void> {
    const s = machine.getState();
    if (
      s.step === "codeSent" ||
      s.step === "codeError" ||
      s.step === "requestError"
    ) {
      await request(s.channel, s.value);
    }
  }

  async function submit(code: string, newPassword: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "codeSent" && s.step !== "codeError") return;
    const { channel, value, target } = s;
    await machine.run(
      { step: "verifying", channel, value, target },
      () => deps.api.passwordResetVerify(channel, value, code, newPassword),
      {
        resolve: (result): PasswordResetState => {
          deps.onAuthenticated?.(result);
          return { step: "authenticated", result };
        },
        reject: (error): PasswordResetState => ({
          step: "codeError",
          channel,
          value,
          target,
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, request, resend, submit, reset };
}
