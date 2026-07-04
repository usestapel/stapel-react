import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse } from "../api/types.js";
import { createFlowMachine } from "./createFlowMachine.js";
import type { FlowMachine } from "./createFlowMachine.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Anonymous session for onboarding-before-signup (auth-sa.md §6). A single
 * call; passing the same `device_id` within 60 s dedups to the same anonymous
 * user. A later email/phone verify upgrades or merges this session.
 */
export type AnonymousState =
  | { readonly step: "idle" }
  | { readonly step: "creating" }
  | { readonly step: "authenticated"; readonly result: AuthResponse }
  | { readonly step: "error"; readonly error: FlowError };

export interface AnonymousFlow {
  readonly machine: FlowMachine<AnonymousState>;
  create(deviceId?: string): Promise<void>;
  reset(): void;
}

export interface AnonymousFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

export function createAnonymousFlow(deps: AnonymousFlowDeps): AnonymousFlow {
  const machine = createFlowMachine<AnonymousState>({
    id: "auth.anonymous",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function create(deviceId?: string): Promise<void> {
    await machine.run({ step: "creating" }, () => deps.api.anonymous(deviceId), {
      resolve: (result): AnonymousState => {
        deps.onAuthenticated?.(result);
        return { step: "authenticated", result };
      },
      reject: (error): AnonymousState => ({
        step: "error",
        error: toFlowError(error),
      }),
    });
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, create, reset };
}
