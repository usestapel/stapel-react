import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse, PasswordRegisterRequest } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Password-based registration (auth-sa.md §5; gated by
 * `RegistrationCapabilities.password` / `AUTH_PASSWORD_REGISTRATION`, off by
 * default). This is the SET-password counterpart to `passwordLoginFlow.ts`'s
 * login form — see `PasswordRegisterPanel` (`../default/panels.js`), the
 * panel the registration surface (`AuthPanel mode="register"`) renders for
 * the `password` channel instead of the login form.
 *
 * `password` is the endpoint's only required field. Providing `email`/
 * `phone` alongside it establishes a real identity anchor (THE IDENTITY
 * MODEL) — on an anonymous guest session that PROMOTES the account.
 * Providing password alone on a guest session only makes it portable (a new
 * password to sign back into the SAME guest account from another device);
 * it does not promote. Either way the backend always answers a full
 * `AuthResponse` here (unlike `passwordChangeFlow.ts`'s OTP-verify path,
 * which only sometimes does) — `onAuthenticated` always fires on success.
 */
export type PasswordRegisterState =
  | { readonly step: "idle" }
  | { readonly step: "registering" }
  | { readonly step: "registered"; readonly result: AuthResponse }
  | { readonly step: "error"; readonly error: FlowError };

export interface PasswordRegisterFlow {
  readonly machine: FlowMachine<PasswordRegisterState>;
  register(request: PasswordRegisterRequest): Promise<void>;
  reset(): void;
}

export interface PasswordRegisterFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

export function createPasswordRegisterFlow(
  deps: PasswordRegisterFlowDeps
): PasswordRegisterFlow {
  const machine = createFlowMachine<PasswordRegisterState>({
    id: "auth.password_register",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function register(request: PasswordRegisterRequest): Promise<void> {
    await machine.run(
      { step: "registering" },
      () => deps.api.passwordRegister(request),
      {
        resolve: (result): PasswordRegisterState => {
          deps.onAuthenticated?.(result);
          return { step: "registered", result };
        },
        reject: (error): PasswordRegisterState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, register, reset };
}
