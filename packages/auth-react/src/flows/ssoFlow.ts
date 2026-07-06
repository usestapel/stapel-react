import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { SsoLookupResponse } from "../api/types.js";
import { authUrls } from "../api/urls.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Enterprise SSO discovery (auth-sa.md §18). The flow covers the *frontend*
 * part: look up a domain after the user types their email, then decide what to
 * render. Actual login is a full-page browser navigation to
 * `authUrls(base).ssoLogin(orgSlug)` — the backend handles SAML/OIDC opaquely
 * and drops the user back on `FRONTEND_URL/` with cookies set. `beginLogin`
 * performs that navigation when a redirector is available.
 */
export type SsoState =
  | { readonly step: "idle" }
  | { readonly step: "looking"; readonly domain: string }
  | {
      readonly step: "resolved";
      readonly domain: string;
      readonly result: SsoLookupResponse;
    }
  | { readonly step: "error"; readonly domain: string; readonly error: FlowError };

export interface SsoFlow {
  readonly machine: FlowMachine<SsoState>;
  /** Look up SSO for an email domain (`sso_required` / optional / none). */
  lookup(domain: string): Promise<void>;
  /** Navigate the browser to the SSO login endpoint for an org slug. */
  beginLogin(orgSlug: string): void;
  reset(): void;
}

export interface SsoFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  /**
   * Full-page redirect seam (default `window.location.assign`). Injectable for
   * tests / custom routers.
   */
  readonly redirect?: (url: string) => void;
}

export function createSsoFlow(deps: SsoFlowDeps): SsoFlow {
  const machine = createFlowMachine<SsoState>({
    id: "auth.sso",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function lookup(domain: string): Promise<void> {
    await machine.run(
      { step: "looking", domain },
      () => deps.api.ssoLookup(domain),
      {
        resolve: (result): SsoState => ({ step: "resolved", domain, result }),
        reject: (error): SsoState => ({
          step: "error",
          domain,
          error: toFlowError(error),
        }),
      }
    );
  }

  function beginLogin(orgSlug: string): void {
    const url = authUrls(deps.api.client.baseUrl).ssoLogin(orgSlug);
    const go =
      deps.redirect ??
      ((target: string) => {
        if (typeof window !== "undefined") window.location.assign(target);
      });
    go(url);
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, lookup, beginLogin, reset };
}
