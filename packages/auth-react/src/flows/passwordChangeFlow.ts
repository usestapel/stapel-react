import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { OtpChannel } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Authenticated password change (auth-sa.md §4). Two host-selected paths that
 * converge on `changed`:
 *  - **old password** — `changeWithPassword(old, new)`.
 *  - **email / SMS code** — `requestOtp(method)` → `submitOtp(code, new)`.
 *
 * Which tabs to show is a host decision driven by `GET /password/methods/`
 * (see `usePasswordMethods`); the machine serves whichever path is invoked.
 */
export type PasswordChangeState =
  | { readonly step: "idle" }
  | { readonly step: "changing" }
  | { readonly step: "requestingOtp"; readonly method: OtpChannel }
  | { readonly step: "otpSent"; readonly method: OtpChannel; readonly target: string }
  | { readonly step: "verifyingOtp"; readonly method: OtpChannel; readonly target: string }
  | { readonly step: "changed" }
  | { readonly step: "error"; readonly error: FlowError }
  | {
      readonly step: "otpError";
      readonly method: OtpChannel;
      readonly target: string;
      readonly error: FlowError;
    };

export interface PasswordChangeFlow {
  readonly machine: FlowMachine<PasswordChangeState>;
  changeWithPassword(oldPassword: string, newPassword: string): Promise<void>;
  requestOtp(method: OtpChannel): Promise<void>;
  submitOtp(code: string, newPassword: string): Promise<void>;
  reset(): void;
}

export interface PasswordChangeFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
}

export function createPasswordChangeFlow(
  deps: PasswordChangeFlowDeps
): PasswordChangeFlow {
  const machine = createFlowMachine<PasswordChangeState>({
    id: "auth.password_change",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function changeWithPassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    await machine.run(
      { step: "changing" },
      () => deps.api.passwordChange(oldPassword, newPassword),
      {
        resolve: (): PasswordChangeState => ({ step: "changed" }),
        reject: (error): PasswordChangeState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function requestOtp(method: OtpChannel): Promise<void> {
    await machine.run(
      { step: "requestingOtp", method },
      () => deps.api.passwordChangeOtpRequest(method),
      {
        resolve: (r): PasswordChangeState => ({
          step: "otpSent",
          method,
          target: r.target,
        }),
        reject: (error): PasswordChangeState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function submitOtp(code: string, newPassword: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "otpSent" && s.step !== "otpError") return;
    const { method, target } = s;
    await machine.run(
      { step: "verifyingOtp", method, target },
      () => deps.api.passwordChangeOtpVerify(method, code, newPassword),
      {
        resolve: (): PasswordChangeState => ({ step: "changed" }),
        reject: (error): PasswordChangeState => ({
          step: "otpError",
          method,
          target,
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, changeWithPassword, requestOtp, submitOtp, reset };
}
