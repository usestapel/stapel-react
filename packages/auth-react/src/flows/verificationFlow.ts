import type {
  Analytics,
  VerificationChallenge,
  VerificationChallengeHandler,
  VerificationOutcome,
} from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type {
  VerificationEnvelope,
  VerificationFactorId,
} from "../api/types.js";
import { createFlowMachine } from "./createFlowMachine.js";
import type { FlowMachine } from "./createFlowMachine.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * THE FLAGSHIP CROSS-MODULE FLOW (frontend-standard §2).
 *
 * `@stapel/core`'s client intercepts a `403` whose body carries a
 * `verification` envelope and calls `onVerificationChallenge(challenge)`,
 * awaiting a {@link VerificationOutcome}. This controller *is* that handler: it
 * parks a React flow-machine on the challenge, drives the user through one
 * interchangeable factor (`otp_email` / `otp_phone` / `totp` / `passkey`), and
 * resolves the awaited promise with `{ retry: true, token }` so core replays
 * the original request with `X-Verification-Token`. Cancelling resolves
 * `{ retry: false }` and the original 403 propagates.
 *
 * Wire it once:
 * ```ts
 * const verification = createVerificationController({ api });
 * const client = createStapelClient({
 *   baseUrl,
 *   onVerificationChallenge: verification.handler,
 * });
 * // render <VerificationChallenge controller={verification}> at the app root
 * ```
 *
 * WebAuthn note: the `passkey` factor is **flow-complete but its browser
 * binding is a thin TODO** — the machine surfaces `session_key` + `options`
 * and accepts a finished credential via `submitPasskey`; calling
 * `navigator.credentials.get()` is the host's (or an injected `webauthnGet`)
 * responsibility. See MODULE.md.
 */
export type VerificationState =
  | { readonly step: "idle" }
  | { readonly step: "picking"; readonly challenge: VerificationEnvelope }
  | {
      readonly step: "initiating";
      readonly challenge: VerificationEnvelope;
      readonly factor: VerificationFactorId;
    }
  | {
      readonly step: "awaitingCode";
      readonly challenge: VerificationEnvelope;
      readonly factor: "otp_email" | "otp_phone" | "totp";
      readonly target: string | null;
    }
  | {
      readonly step: "awaitingPasskey";
      readonly challenge: VerificationEnvelope;
      readonly sessionKey: string;
      readonly options: Record<string, unknown>;
    }
  | {
      readonly step: "verifying";
      readonly challenge: VerificationEnvelope;
      readonly factor: VerificationFactorId;
    }
  | { readonly step: "verified"; readonly token: string }
  | {
      readonly step: "factorError";
      readonly challenge: VerificationEnvelope;
      readonly factor: VerificationFactorId;
      readonly target: string | null;
      readonly error: FlowError;
    }
  | { readonly step: "unavailable"; readonly error: FlowError };

export interface VerificationController {
  readonly machine: FlowMachine<VerificationState>;
  /** The handler wired into `createStapelClient({ onVerificationChallenge })`. */
  readonly handler: VerificationChallengeHandler;
  /** Choose one of the challenge's factors and initiate it. */
  chooseFactor(factor: VerificationFactorId): Promise<void>;
  /** Submit an OTP/TOTP code (or a TOTP backup code). */
  submitCode(proof: { code?: string; backup_code?: string }): Promise<void>;
  /** Submit a finished WebAuthn assertion for the `passkey` factor. */
  submitPasskey(credential: unknown): Promise<void>;
  /** Abandon the challenge — resolves the awaited outcome with `retry:false`. */
  cancel(): void;
}

export interface VerificationControllerDeps {
  /** Lazy-friendly: a thunk breaks the client↔controller wiring cycle. */
  readonly api: AuthApi | (() => AuthApi);
  readonly analytics?: Analytics | null;
  /**
   * Optional WebAuthn binding. When provided, choosing the `passkey` factor
   * auto-calls it with the server `options` and submits the result — the host
   * needs no passkey code. Thin by design; omit to drive it manually.
   */
  readonly webauthnGet?: (
    options: Record<string, unknown>
  ) => Promise<unknown>;
}

const NOT_FOUND_STATUS = 404;
const LOCKED_STATUS = 423;

function asEnvelope(challenge: VerificationChallenge): VerificationEnvelope {
  return {
    challenge_id: challenge.challenge_id,
    scope: typeof challenge.scope === "string" ? challenge.scope : "",
    factors: (challenge.factors ?? []) as readonly VerificationFactorId[],
    expires_at:
      typeof challenge["expires_at"] === "number"
        ? (challenge["expires_at"] as number)
        : 0,
  };
}

export function createVerificationController(
  deps: VerificationControllerDeps
): VerificationController {
  const machine = createFlowMachine<VerificationState>({
    id: "auth.verification",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });
  const api = (): AuthApi =>
    typeof deps.api === "function" ? deps.api() : deps.api;

  // The awaited outcome for the in-flight core request. Exactly one challenge
  // is handled at a time; a second arriving while one is active is declined.
  let resolveOutcome: ((outcome: VerificationOutcome) => void) | null = null;

  function settle(outcome: VerificationOutcome): void {
    const resolve = resolveOutcome;
    resolveOutcome = null;
    resolve?.(outcome);
  }

  const handler: VerificationChallengeHandler = (challenge) => {
    if (resolveOutcome !== null) {
      // Already busy with another challenge — decline the new one.
      return Promise.resolve({ retry: false });
    }
    const envelope = asEnvelope(challenge);
    return new Promise<VerificationOutcome>((resolve) => {
      resolveOutcome = resolve;
      machine.to({ step: "picking", challenge: envelope });
    });
  };

  function currentChallenge(): VerificationEnvelope | null {
    const s = machine.getState();
    if ("challenge" in s) return s.challenge;
    return null;
  }

  function foldUnavailable(error: FlowError): VerificationState | null {
    if (error.status === NOT_FOUND_STATUS || error.status === LOCKED_STATUS) {
      return { step: "unavailable", error };
    }
    return null;
  }

  async function chooseFactor(factor: VerificationFactorId): Promise<void> {
    const challenge = currentChallenge();
    if (challenge === null) return;

    await machine.run(
      { step: "initiating", challenge, factor },
      () => api().verificationInitiate(challenge.challenge_id, factor),
      {
        resolve: (r): VerificationState => {
          if (factor === "passkey") {
            const sessionKey = String(r.data["session_key"] ?? "");
            const options = (r.data["options"] ?? {}) as Record<string, unknown>;
            return {
              step: "awaitingPasskey",
              challenge,
              sessionKey,
              options,
            };
          }
          const target =
            typeof r.data["target"] === "string"
              ? (r.data["target"] as string)
              : null;
          return { step: "awaitingCode", challenge, factor, target };
        },
        reject: (error): VerificationState => {
          const flowError = toFlowError(error);
          return (
            foldUnavailable(flowError) ?? {
              step: "factorError",
              challenge,
              factor,
              target: null,
              error: flowError,
            }
          );
        },
      }
    );

    // Auto-drive the passkey factor when a binding is injected (thin seam).
    const after = machine.getState();
    if (after.step === "awaitingPasskey" && deps.webauthnGet) {
      try {
        const credential = await deps.webauthnGet(after.options);
        await submitPasskey(credential);
      } catch (error) {
        machine.to({
          step: "factorError",
          challenge,
          factor: "passkey",
          target: null,
          error: toFlowError(error),
        });
      }
    }
  }

  async function complete(
    challenge: VerificationEnvelope,
    factor: VerificationFactorId,
    target: string | null,
    body: Record<string, unknown>
  ): Promise<void> {
    await machine.run(
      { step: "verifying", challenge, factor },
      () => api().verificationComplete(challenge.challenge_id, body),
      {
        resolve: (r): VerificationState => {
          settle({ retry: true, token: r.verification_token });
          return { step: "verified", token: r.verification_token };
        },
        reject: (error): VerificationState => {
          const flowError = toFlowError(error);
          const unavailable = foldUnavailable(flowError);
          if (unavailable) {
            settle({ retry: false });
            return unavailable;
          }
          // Recoverable (wrong code) — stay in the flow for a retry.
          return { step: "factorError", challenge, factor, target, error: flowError };
        },
      }
    );
  }

  async function submitCode(proof: {
    code?: string;
    backup_code?: string;
  }): Promise<void> {
    const s = machine.getState();
    let challenge: VerificationEnvelope;
    let factor: VerificationFactorId;
    let target: string | null;
    if (s.step === "awaitingCode") {
      ({ challenge, factor, target } = s);
    } else if (s.step === "factorError" && s.factor !== "passkey") {
      ({ challenge, factor, target } = s);
    } else {
      return;
    }
    await complete(challenge, factor, target, { factor, ...proof });
  }

  async function submitPasskey(credential: unknown): Promise<void> {
    const s = machine.getState();
    if (s.step !== "awaitingPasskey") return;
    await complete(s.challenge, "passkey", null, {
      factor: "passkey",
      session_key: s.sessionKey,
      credential,
    });
  }

  function cancel(): void {
    settle({ retry: false });
    machine.to({ step: "idle" });
  }

  return {
    machine,
    handler,
    chooseFactor,
    submitCode,
    submitPasskey,
    cancel,
  };
}
