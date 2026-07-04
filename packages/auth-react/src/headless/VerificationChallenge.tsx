import type { ReactNode } from "react";
import type { VerificationFactorId } from "../api/types.js";
import { useFlow } from "../flows/useFlow.js";
import type { VerificationState } from "../flows/verificationFlow.js";
import { useVerification } from "../model/context.js";

export interface VerificationChallengeBag {
  readonly state: VerificationState;
  chooseFactor(factor: VerificationFactorId): void;
  submitCode(proof: { code?: string; backup_code?: string }): void;
  submitPasskey(credential: unknown): void;
  cancel(): void;
}

/**
 * THE FLAGSHIP headless component (frontend-standard §2). Mount it ONCE at the
 * app root. It renders the app's step-up modal by driving the singleton
 * {@link VerificationController} that `createAuthRuntime` wired into
 * `client.onVerificationChallenge`. When any sensitive request 403s with a
 * verification envelope, `state.step` leaves `"idle"` and this render prop
 * fires — pick a factor, submit the proof, and core transparently retries the
 * original request with `X-Verification-Token`.
 *
 * Renders nothing while idle, so it is safe to leave mounted:
 * ```tsx
 * <VerificationChallenge>
 *   {({ state, chooseFactor, submitCode, cancel }) => (
 *     <Modal open={state.step !== "idle"}>… </Modal>
 *   )}
 * </VerificationChallenge>
 * ```
 */
export function VerificationChallenge(props: {
  children: (bag: VerificationChallengeBag) => ReactNode;
  /** Render even when idle (default false — returns null while idle). */
  renderWhenIdle?: boolean;
}): ReactNode {
  const controller = useVerification();
  const state = useFlow(controller.machine);
  if (state.step === "idle" && props.renderWhenIdle !== true) return null;
  return props.children({
    state,
    chooseFactor: (factor) => {
      void controller.chooseFactor(factor);
    },
    submitCode: (proof) => {
      void controller.submitCode(proof);
    },
    submitPasskey: (credential) => {
      void controller.submitPasskey(credential);
    },
    cancel: controller.cancel,
  });
}
