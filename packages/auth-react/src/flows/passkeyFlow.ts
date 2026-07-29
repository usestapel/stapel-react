import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse, PasskeyRegistered } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";
import { resolveWebauthnCreate, resolveWebauthnGet } from "../webauthn.js";

/**
 * Passkeys / WebAuthn (auth-sa.md §17). Both machines model the full
 * begin→ceremony→complete journey and surface the server `options`; the
 * single browser step — `navigator.credentials.create()/get()` — runs on the
 * **built-in default binding** (`../webauthn.ts`) wherever the browser API
 * exists. An injected `webauthn*` dep still wins (native bridge, tests), and
 * where no API exists (SSR, an old browser) the machine stops at
 * `awaitingCredential`/`awaitingAssertion` exactly as it did before the
 * default existed, for the host to drive via `submitCredential`. No heuristic
 * "no credentials" probing (auth-sa.md §19.6).
 */

// ── Registration (security settings, requires auth) ─────────────────────────

export type PasskeyRegisterState =
  | { readonly step: "idle" }
  | { readonly step: "beginning" }
  | { readonly step: "awaitingCredential"; readonly options: Record<string, unknown> }
  | { readonly step: "completing" }
  // `passkey` carries the full complete-response: from a limited enroll-only
  // session (org-program §C2) it includes the full-session `tokens` pair —
  // `MfaEnrollGate` reads it to upgrade the session; null/absent elsewhere.
  | { readonly step: "registered"; readonly passkey: PasskeyRegistered }
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
  /**
   * Override the built-in `navigator.credentials.create({ publicKey })`
   * binding (native bridge, tests). Omitted = the browser default.
   */
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
    // Injected binding wins; otherwise the browser default — resolved at
    // ceremony time, so an SSR-created flow still finds the API after
    // hydration (and finds nothing, staying thin, where there is none).
    const create = resolveWebauthnCreate(deps.webauthnCreate);
    if (after.step === "awaitingCredential" && create) {
      try {
        const credential = await create(after.options);
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
  /**
   * Override the built-in `navigator.credentials.get({ publicKey })` binding
   * (native bridge, tests). Omitted = the browser default.
   */
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
    // Injected binding wins; otherwise the browser default (see `begin` on the
    // registration flow above for why this resolves per ceremony).
    const get = resolveWebauthnGet(deps.webauthnGet);
    if (after.step === "awaitingAssertion" && get) {
      try {
        const credential = await get(after.options);
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
