import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import { validRedirectUrl } from "../api/urls.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Magic-link request (auth-sa.md §15). Only the *request* is a frontend flow:
 * the email link points directly at the backend (`/auth/api/magic/verify/`),
 * so there is no `/magic-login` page — the browser opens the link and the
 * backend redirects (TOTP / conflict / success handled by the `/login` route
 * consumers, not this flow). Always resolves `sent` on 200 regardless of
 * whether the email exists (enumeration protection); only rate-limit /
 * validation errors surface.
 */
export type MagicLinkState =
  | { readonly step: "idle" }
  | { readonly step: "requesting"; readonly email: string }
  | { readonly step: "sent"; readonly email: string }
  | { readonly step: "invalidRedirect"; readonly email: string }
  | { readonly step: "error"; readonly email: string; readonly error: FlowError };

export interface MagicLinkFlow {
  readonly machine: FlowMachine<MagicLinkState>;
  /** `redirectUrl` must be a relative path (`/...`); rejected client-side otherwise. */
  request(email: string, redirectUrl?: string): Promise<void>;
  reset(): void;
}

export interface MagicLinkFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
}

export function createMagicLinkFlow(deps: MagicLinkFlowDeps): MagicLinkFlow {
  const machine = createFlowMachine<MagicLinkState>({
    id: "auth.magic_link",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function request(email: string, redirectUrl?: string): Promise<void> {
    if (redirectUrl !== undefined && validRedirectUrl(redirectUrl) === null) {
      machine.to({ step: "invalidRedirect", email });
      return;
    }
    await machine.run(
      { step: "requesting", email },
      () => deps.api.magicRequest(email, redirectUrl),
      {
        resolve: (): MagicLinkState => ({ step: "sent", email }),
        reject: (error): MagicLinkState => ({
          step: "error",
          email,
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, request, reset };
}
