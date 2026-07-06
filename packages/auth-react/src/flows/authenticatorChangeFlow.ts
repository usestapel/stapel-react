import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse, OtpChannel } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Authenticator (email/phone) change — INSTANT strategy (auth-sa.md §9). A
 * four-hop human-wait chain proving the *old* value, then setting the *new*:
 * request-old → verify-old (mints a `change_token`) → request-new → verify-new
 * (→ `MODIFIED` session). The DELAYED strategy (14-day wait, no old access) is
 * plain CRUD — use `api.changeDelayedInitiate/Status/Cancel` or the
 * `useDelayedChangeStatus` model hook directly.
 */
export type AuthenticatorChangeState =
  | { readonly step: "idle" }
  | { readonly step: "requestingOld"; readonly channel: OtpChannel }
  | { readonly step: "oldCodeSent"; readonly channel: OtpChannel; readonly target: string }
  | { readonly step: "verifyingOld"; readonly channel: OtpChannel }
  | {
      readonly step: "oldVerified";
      readonly channel: OtpChannel;
      readonly changeToken: string;
    }
  | {
      readonly step: "requestingNew";
      readonly channel: OtpChannel;
      readonly changeToken: string;
      readonly newValue: string;
    }
  | {
      readonly step: "newCodeSent";
      readonly channel: OtpChannel;
      readonly changeToken: string;
      readonly newValue: string;
      readonly target: string;
    }
  | {
      readonly step: "verifyingNew";
      readonly channel: OtpChannel;
      readonly changeToken: string;
      readonly newValue: string;
    }
  | { readonly step: "changed"; readonly result: AuthResponse }
  | { readonly step: "error"; readonly error: FlowError };

export interface AuthenticatorChangeFlow {
  readonly machine: FlowMachine<AuthenticatorChangeState>;
  startInstant(channel: OtpChannel): Promise<void>;
  submitOldCode(code: string): Promise<void>;
  requestNew(newValue: string): Promise<void>;
  submitNewCode(code: string): Promise<void>;
  reset(): void;
}

export interface AuthenticatorChangeFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

export function createAuthenticatorChangeFlow(
  deps: AuthenticatorChangeFlowDeps
): AuthenticatorChangeFlow {
  const machine = createFlowMachine<AuthenticatorChangeState>({
    id: "auth.authenticator_change",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function startInstant(channel: OtpChannel): Promise<void> {
    await machine.run(
      { step: "requestingOld", channel },
      () => deps.api.changeInstantRequestOld(channel),
      {
        resolve: (r): AuthenticatorChangeState => ({
          step: "oldCodeSent",
          channel,
          target: r.target,
        }),
        reject: (error): AuthenticatorChangeState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function submitOldCode(code: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "oldCodeSent") return;
    const { channel } = s;
    await machine.run(
      { step: "verifyingOld", channel },
      () => deps.api.changeInstantVerifyOld(channel, code),
      {
        resolve: (r): AuthenticatorChangeState => ({
          step: "oldVerified",
          channel,
          changeToken: r.change_token,
        }),
        reject: (error): AuthenticatorChangeState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function requestNew(newValue: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "oldVerified") return;
    const { channel, changeToken } = s;
    await machine.run(
      { step: "requestingNew", channel, changeToken, newValue },
      () => deps.api.changeInstantRequestNew(channel, newValue, changeToken),
      {
        resolve: (r): AuthenticatorChangeState => ({
          step: "newCodeSent",
          channel,
          changeToken,
          newValue,
          target: r.target,
        }),
        reject: (error): AuthenticatorChangeState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function submitNewCode(code: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "newCodeSent") return;
    const { channel, changeToken, newValue } = s;
    await machine.run(
      { step: "verifyingNew", channel, changeToken, newValue },
      () => deps.api.changeInstantVerifyNew(channel, newValue, code, changeToken),
      {
        resolve: (result): AuthenticatorChangeState => {
          deps.onAuthenticated?.(result);
          return { step: "changed", result };
        },
        reject: (error): AuthenticatorChangeState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, startInstant, submitOldCode, requestNew, submitNewCode, reset };
}
