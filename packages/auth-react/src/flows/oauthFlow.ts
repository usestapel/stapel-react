import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse } from "../api/types.js";
import { isFirstLoginChallenge, isTotpChallenge } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * OAuth client-side token exchange (auth-sa.md §7 option B). For the
 * server-side redirect (option A, recommended for web) use
 * `authUrls(base).oauthAuthorize(provider, redirectUri)` — no flow needed, the
 * backend sets cookies on return.
 *
 * The exchange can answer with the same TOTP `oneOf` union as password login
 * (only when `OAUTH_STEP_UP` is enabled server-side), so this flow carries the
 * identical `totpRequired` branch — completed via the same
 * `/totp/challenge/verify/` endpoint.
 */
export type OAuthState =
  | { readonly step: "idle" }
  | { readonly step: "exchanging"; readonly provider: string }
  | {
      readonly step: "totpRequired";
      readonly challengeToken: string;
      readonly expiresIn: number;
    }
  | { readonly step: "verifyingTotp"; readonly challengeToken: string; readonly expiresIn: number }
  | { readonly step: "authenticated"; readonly result: AuthResponse }
  | { readonly step: "error"; readonly provider: string; readonly error: FlowError }
  | {
      readonly step: "totpError";
      readonly challengeToken: string;
      readonly expiresIn: number;
      readonly error: FlowError;
    };

export interface OAuthFlow {
  readonly machine: FlowMachine<OAuthState>;
  exchange(provider: string, accessToken: string): Promise<void>;
  submitTotp(proof: { code?: string; backup_code?: string }): Promise<void>;
  reset(): void;
}

export interface OAuthFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

export function createOAuthFlow(deps: OAuthFlowDeps): OAuthFlow {
  const machine = createFlowMachine<OAuthState>({
    id: "auth.oauth",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function exchange(provider: string, accessToken: string): Promise<void> {
    await machine.run(
      { step: "exchanging", provider },
      () => deps.api.oauthLogin(provider, accessToken),
      {
        resolve: (r): OAuthState => {
          if (isTotpChallenge(r)) {
            return {
              step: "totpRequired",
              challengeToken: r.challenge_token,
              expiresIn: r.expires_in,
            };
          }
          if (isFirstLoginChallenge(r)) {
            // Not a contract branch of /oauth/login/: first-login enforcement
            // (org-program §C2) applies to org-provisioned password accounts
            // only. Fold defensively rather than crash the resolve mapper.
            return { step: "error", provider, error: toFlowError(new Error(r.status)) };
          }
          deps.onAuthenticated?.(r);
          return { step: "authenticated", result: r };
        },
        reject: (error): OAuthState => ({
          step: "error",
          provider,
          error: toFlowError(error),
        }),
      }
    );
  }

  async function submitTotp(proof: {
    code?: string;
    backup_code?: string;
  }): Promise<void> {
    const s = machine.getState();
    if (s.step !== "totpRequired" && s.step !== "totpError") return;
    const { challengeToken, expiresIn } = s;
    await machine.run(
      { step: "verifyingTotp", challengeToken, expiresIn },
      () => deps.api.totpChallengeVerify(challengeToken, proof),
      {
        resolve: (result): OAuthState => {
          deps.onAuthenticated?.(result);
          return { step: "authenticated", result };
        },
        reject: (error): OAuthState => ({
          step: "totpError",
          challengeToken,
          expiresIn,
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, exchange, submitTotp, reset };
}
