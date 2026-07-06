import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse, Passkey } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Passkeys / WebAuthn (auth-sa.md §17). FLOW-COMPLETE, WEBAUTHN BINDING IS A
 * THIN TODO (see MODULE.md): both machines model the full begin→ceremony→
 * complete journey and surface the server `options`. The single browser step —
 * `navigator.credentials.create()/get()` — is either injected via
 * `webauthn*` deps (auto-driven) or performed by the host, which then calls
 * `submitCredential`. No heuristic "no credentials" probing (auth-sa.md §19.6).
 */

// ── Registration (security settings, requires auth) ─────────────────────────

export type PasskeyRegisterState =
  | { readonly step: "idle" }
  | { readonly step: "beginning" }
  | { readonly step: "awaitingCredential"; readonly options: Record<string, unknown> }
  | { readonly step: "completing" }
  | { readonly step: "registered"; readonly passkey: Passkey }
  | { readonly step: "error"; readonly error: FlowError };

export interface PasskeyRegistrationFlow {
  readonly machine: FlowMachine<PasskeyRegisterState>;
  begin(deviceName?: string): Promise<void>;
  submitCredential(credential: unknown): Promise<void>;
  reset(): void;
}

export interface PasskeyRegistrationFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  /** THIN WebAuthn binding: `navigator.credentials.create({ publicKey })`. */
  readonly webauthnCreate?: (
    options: Record<string, unknown>
  ) => Promise<unknown>;
}

export function createPasskeyRegistrationFlow(
  deps: PasskeyRegistrationFlowDeps
): PasskeyRegistrationFlow {
  const machine = createFlowMachine<PasskeyRegisterState>({
    id: "auth.passkey_register",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  let pendingDeviceName: string | undefined;

  async function submitCredential(credential: unknown): Promise<void> {
    const s = machine.getState();
    if (s.step !== "awaitingCredential") return;
    await machine.run(
      { step: "completing" },
      () => deps.api.passkeyRegisterComplete(credential, pendingDeviceName),
      {
        resolve: (passkey): PasskeyRegisterState => ({ step: "registered", passkey }),
        reject: (error): PasskeyRegisterState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function begin(deviceName?: string): Promise<void> {
    pendingDeviceName = deviceName;
    await machine.run({ step: "beginning" }, () => deps.api.passkeyRegisterBegin(), {
      resolve: (r): PasskeyRegisterState => ({
        step: "awaitingCredential",
        options: r.options,
      }),
      reject: (error): PasskeyRegisterState => ({
        step: "error",
        error: toFlowError(error),
      }),
    });
    const after = machine.getState();
    if (after.step === "awaitingCredential" && deps.webauthnCreate) {
      try {
        const credential = await deps.webauthnCreate(after.options);
        // Identity guard (same as the verification controller's, 52ae5ac):
        // the native prompt may settle after the machine moved on (reset,
        // re-begin). A stale credential must not be submitted against the
        // NEWER ceremony — `submitCredential` only checks the step.
        if (machine.getState() !== after) return;
        await submitCredential(credential);
      } catch (error) {
        // Same guard for the rejection path: a prompt abandoned and timing
        // out later must not clobber the newer state (idle / a fresh ceremony
        // / registered) with `error`.
        if (machine.getState() !== after) return;
        machine.to({ step: "error", error: toFlowError(error) });
      }
    }
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, begin, submitCredential, reset };
}

// ── Authentication (sign-in page, no auth required) ─────────────────────────

export type PasskeyLoginState =
  | { readonly step: "idle" }
  | { readonly step: "beginning" }
  | {
      readonly step: "awaitingAssertion";
      readonly sessionKey: string;
      readonly options: Record<string, unknown>;
    }
  | { readonly step: "completing"; readonly sessionKey: string }
  | { readonly step: "authenticated"; readonly result: AuthResponse }
  | { readonly step: "error"; readonly error: FlowError };

export interface PasskeyLoginFlow {
  readonly machine: FlowMachine<PasskeyLoginState>;
  begin(email?: string): Promise<void>;
  submitAssertion(credential: unknown): Promise<void>;
  reset(): void;
}

export interface PasskeyLoginFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  readonly onAuthenticated?: (result: AuthResponse) => void;
  /** THIN WebAuthn binding: `navigator.credentials.get({ publicKey })`. */
  readonly webauthnGet?: (options: Record<string, unknown>) => Promise<unknown>;
}

export function createPasskeyLoginFlow(
  deps: PasskeyLoginFlowDeps
): PasskeyLoginFlow {
  const machine = createFlowMachine<PasskeyLoginState>({
    id: "auth.passkey_login",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function submitAssertion(credential: unknown): Promise<void> {
    const s = machine.getState();
    if (s.step !== "awaitingAssertion") return;
    const { sessionKey } = s;
    await machine.run(
      { step: "completing", sessionKey },
      () => deps.api.passkeyAuthenticateComplete(sessionKey, credential),
      {
        resolve: (result): PasskeyLoginState => {
          deps.onAuthenticated?.(result);
          return { step: "authenticated", result };
        },
        reject: (error): PasskeyLoginState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function begin(email?: string): Promise<void> {
    await machine.run(
      { step: "beginning" },
      () => deps.api.passkeyAuthenticateBegin(email),
      {
        resolve: (r): PasskeyLoginState => ({
          step: "awaitingAssertion",
          sessionKey: r.session_key,
          options: r.options,
        }),
        reject: (error): PasskeyLoginState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
    const after = machine.getState();
    if (after.step === "awaitingAssertion" && deps.webauthnGet) {
      try {
        const credential = await deps.webauthnGet(after.options);
        // Identity guard (same as the verification controller's, 52ae5ac): a
        // late-settling prompt must not submit a stale assertion against the
        // NEWER ceremony's session_key — `submitAssertion` only checks the step.
        if (machine.getState() !== after) return;
        await submitAssertion(credential);
      } catch (error) {
        // A prompt rejected after the machine moved on (reset, re-begin,
        // authenticated via another path) must not clobber the newer state.
        if (machine.getState() !== after) return;
        machine.to({ step: "error", error: toFlowError(error) });
      }
    }
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, begin, submitAssertion, reset };
}
