import { createStapelClient } from "@stapel/core";
import type {
  Analytics,
  PersistStorage,
  SessionLostReason,
  StapelClient,
} from "@stapel/core";
import { createAuthApi } from "../api/authApi.js";
import type { AuthApi } from "../api/authApi.js";
import {
  createVerificationController,
} from "../flows/verificationFlow.js";
import type { VerificationController } from "../flows/verificationFlow.js";
import { createAuthSession } from "./session.js";
import type { AuthSession, TeardownReason } from "./session.js";

/**
 * The wired auth runtime — the one place the flagship seams are connected
 * (frontend-standard §2). It builds a {@link StapelClient} whose `getToken` /
 * `onAuthRefresh` come from the {@link AuthSession} and whose
 * `onVerificationChallenge` is the {@link VerificationController}'s handler, so
 * the step-up factor flow and token rotation "just work" for every request.
 *
 * The returned `client` is what the host injects into core's
 * `StapelConfigProvider` (as the default or the `"auth"` module client),
 * preserving the client-injection fork seam of §7.2.
 */
export interface AuthRuntime {
  readonly client: StapelClient;
  readonly api: AuthApi;
  readonly session: AuthSession;
  readonly verification: VerificationController;
  readonly analytics: Analytics | null;
}

export interface CreateAuthRuntimeOptions {
  /** e.g. `/auth/api` or `https://app.example.com/auth/api`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly storage?: PersistStorage;
  readonly analytics?: Analytics | null;
  /**
   * Cookie mode (httponly JWT cookies) vs header/bearer.
   *
   * **Default `true`** (owner canon, 2026-07-17 incident write-up) — see
   * `model/session.ts`'s `AuthSessionOptions.cookieMode` doc for the full
   * reasoning. Header/bearer is a NATIVE/mobile concern (no shared cookie
   * jar); a web host that wants it opts in explicitly with
   * `cookieMode: false`.
   */
  readonly cookieMode?: boolean;
  /**
   * Fetch `credentials` mode for the MAIN client. Defaults to `"include"` in
   * cookie mode (HTTP-only cookies must ride cross-origin requests) and to
   * the browser default otherwise.
   *
   * The refresh client (this runtime's dedicated client for the token-refresh
   * call only, see below) defaults to `"include"` REGARDLESS of cookie mode
   * — that is what lets `bootstrapProbe`'s `"auto"`/`"always"` (see
   * `model/session.ts`'s `AuthSessionOptions.bootstrapProbe`) discover a
   * QR/magic-link/SSO-minted httponly cookie session even while this runtime
   * is nominally running bearer mode (2026-07-19 incident: the refresh
   * endpoint is the one call a bearer host can safely let ride cookies
   * opportunistically without changing anything else). Passing this option
   * explicitly overrides BOTH clients to the same value, as before — set it
   * to `"omit"` if the refresh call must never carry cookies.
   */
  readonly credentials?: RequestCredentials;
  /**
   * Gates the bearer-mode cold-load refresh probe. See
   * `model/session.ts`'s `AuthSessionOptions.bootstrapProbe` for the full
   * `"auto"` (default) / `"always"` / `"off"` contract. Forwarded as-is.
   */
  readonly bootstrapProbe?: "auto" | "always" | "off";
  /** Called after a session teardown (revoked/expired/logout). */
  readonly onTeardown?: (reason: TeardownReason) => void;
  /**
   * Host policy for an involuntary session loss
   * (frontend-core-architecture-v2 §43.1): redirect to the login form, or
   * trigger an anonymous auto-login when the guest axis is enabled. Resolve
   * the CHOICE from your own discovery/manifest config — never hardcoded
   * here. Fires in addition to `onTeardown` (which also covers explicit
   * logout); this fires only for `revoked`/`expired`.
   */
  readonly onSessionLost?: (reason: SessionLostReason) => void | Promise<void>;
  /** Extra headers merged into every request (e.g. a captcha or tenant id). */
  readonly defaultHeaders?: Record<string, string>;
  /** THIN WebAuthn binding for the passkey verification factor. */
  readonly webauthnGet?: (options: Record<string, unknown>) => Promise<unknown>;
}

export function createAuthRuntime(
  options: CreateAuthRuntimeOptions
): AuthRuntime {
  const analytics = options.analytics ?? null;

  // `api` is assigned after the client exists; session/verification reference
  // it lazily through the holder, breaking the client↔session/verification
  // wiring cycle without a reassigned `let`.
  const holder: { current: AuthApi | null } = { current: null };
  const getApi = (): AuthApi => {
    if (holder.current === null) {
      throw new Error("auth runtime used before initialization");
    }
    return holder.current;
  };

  // Same lazy-holder trick, one level up: the refresh client (below) needs
  // a `getToken` so bearer-mode calls made THROUGH it (session.ts's LAYER B
  // `me()` user-resolution, called from inside `doRefresh`/`setTokens`) ride
  // the just-refreshed access token — but `session` itself is constructed
  // AFTER `refreshClient`. `getToken` is a plain value read, never a call
  // back into `onAuthRefresh`/`refresh()`, so wiring it here carries none of
  // the reentrancy risk `refreshClient`'s missing `onAuthRefresh` seam
  // exists to avoid.
  const sessionHolder: { current: AuthSession | null } = { current: null };

  // Resolve cookieMode ONCE (default true) — both the credentials default
  // AND the session's own cookieMode below must agree on the SAME resolved
  // value, not each re-derive `options.cookieMode ?? <its own default>`
  // independently (that divergence — credentials keyed off the raw
  // `options.cookieMode === true` while the session defaulted `false` — is
  // exactly how a cookie-mode-by-default session ended up with a client
  // that never sent `credentials: "include"`, silently dropping the very
  // cookies the session was supposed to run on).
  const cookieMode = options.cookieMode ?? true;
  const credentials =
    options.credentials ?? (cookieMode ? ("include" as const) : undefined);
  // Refresh client's credentials default to "include" UNCONDITIONALLY (not
  // gated on cookieMode like the main client) — see this option's doc above
  // for why. An explicit `options.credentials` still overrides both clients
  // identically, so a host that truly wants the refresh call cookie-free can
  // still get that.
  const refreshCredentials = options.credentials ?? ("include" as const);

  // A SEPARATE client for the token-refresh call only — deliberately WITHOUT
  // `onAuthRefresh` (frontend-core-architecture-v2 §43.1). The refresh
  // endpoint's own request must not be able to recursively re-enter the core
  // `SessionManager`'s single-flight window through the same seam; see
  // `@stapel/core`'s `session.ts` doc comment and `model/session.ts`'s
  // `refreshApi` option for the full reasoning.
  const refreshClient = createStapelClient({
    baseUrl: options.baseUrl,
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    credentials: refreshCredentials,
    // See `sessionHolder`'s doc above — read-only, no refresh seam.
    getToken: () => sessionHolder.current?.getAccessToken() ?? null,
    ...(options.defaultHeaders !== undefined
      ? { defaultHeaders: options.defaultHeaders }
      : {}),
  });
  const refreshApi = createAuthApi(refreshClient);

  const session = createAuthSession({
    api: getApi,
    refreshApi,
    ...(options.storage !== undefined ? { storage: options.storage } : {}),
    cookieMode,
    ...(options.bootstrapProbe !== undefined
      ? { bootstrapProbe: options.bootstrapProbe }
      : {}),
    ...(options.onTeardown !== undefined ? { onTeardown: options.onTeardown } : {}),
    ...(options.onSessionLost !== undefined
      ? { onSessionLost: options.onSessionLost }
      : {}),
  });
  sessionHolder.current = session;

  const verification = createVerificationController({
    api: getApi,
    analytics,
    ...(options.webauthnGet !== undefined
      ? { webauthnGet: options.webauthnGet }
      : {}),
  });

  const client = createStapelClient({
    baseUrl: options.baseUrl,
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(credentials !== undefined ? { credentials } : {}),
    getToken: () => session.getAccessToken(),
    onAuthRefresh: () => session.onAuthRefresh(),
    onVerificationChallenge: verification.handler,
    ...(options.defaultHeaders !== undefined
      ? { defaultHeaders: options.defaultHeaders }
      : {}),
  });

  const api = createAuthApi(client);
  holder.current = api;

  return { client, api, session, verification, analytics };
}
