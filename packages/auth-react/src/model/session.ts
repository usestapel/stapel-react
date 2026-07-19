import { createSessionManager, StapelApiError } from "@stapel/core";
import type { PersistStorage, SessionLostReason, SessionManager } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse, AuthTokens, StapelUser } from "../api/types.js";

/**
 * Why a session teardown fired (auth-sa.md §13, §19.3):
 *  - `revoked`  — refresh token replayed/blacklisted (`error.401.refresh_revoked`);
 *    a stolen-token signal, hard logout.
 *  - `expired`  — refresh failed for any other reason (TTL, network).
 *  - `logout`   — explicit user logout.
 */
export type TeardownReason = "revoked" | "expired" | "logout";

export interface AuthSessionState {
  readonly user: StapelUser | null;
  readonly tokens: AuthTokens | null;
  readonly status: "anonymous" | "authenticated";
}

export interface AuthSession {
  getState(): AuthSessionState;
  subscribe(listener: () => void): () => void;
  /** For `createStapelClient({ getToken })`. Header mode only; cookie mode → null. */
  getAccessToken(): string | null;
  /** For `createStapelClient({ onAuthRefresh })`. Delegates to the core `SessionManager`. */
  onAuthRefresh(): Promise<string | null>;
  /** Commit a session from any AuthResponse (login/register/merge/modify). */
  adopt(response: AuthResponse): void;
  /** Store a bare token pair (e.g. QR `login_request` fulfilment). */
  setTokens(tokens: AuthTokens): void;
  /** Explicit logout: revoke server-side, then tear down locally. */
  logout(): Promise<void>;
  /** Load a persisted session (call once on mount). */
  restore(): Promise<void>;
  /**
   * The core session substrate this session is built on
   * (frontend-core-architecture-v2 §43.1) — single-flight refresh, the
   * three-state status (`getSessionManager().getStatus()` also distinguishes
   * `"anonymous"` guest sessions via `is_anonymous` on the adopted user,
   * where this session's OWN two-value `status` field collapses both into
   * `"authenticated"` for backward compatibility), the typed events, the
   * logout-hook registry, and the per-session encryption key
   * `createRepository` uses. Most callers never need this directly — it
   * exists so other modules (repositories, other `@stapel/*-react` pairs)
   * can register their own logout hooks / read status without depending on
   * auth-react.
   */
  getSessionManager(): SessionManager;
}

export interface AuthSessionOptions {
  /** Lazy to break the client↔session wiring cycle (see README). */
  readonly api: AuthApi | (() => AuthApi);
  /**
   * API bound to a client WITHOUT the `onAuthRefresh` seam, used ONLY for
   * the token-refresh call itself. Breaks the refresh call's own 401 from
   * recursively re-entering the core `SessionManager`'s single-flight window
   * (frontend-core-architecture-v2 §43.1 — see `src/session.ts`'s doc
   * comment in `@stapel/core` for why this can't be a runtime guard).
   * Default: same as `api` — fine for tests with one mock api; hosts built
   * via `createAuthRuntime` always get a dedicated one.
   */
  readonly refreshApi?: AuthApi | (() => AuthApi);
  /** Persist backend. Default: core's IndexedDB→localStorage→memory. */
  readonly storage?: PersistStorage;
  /** Persist key. Default `"stapel-auth:session"`. */
  readonly persistKey?: string;
  /**
   * Cookie mode: the backend sets httponly JWT cookies, so no bearer token is
   * attached and refresh uses `GET /token/refresh/` (cookie, `credentials:
   * "include"` on the client — see `createAuthRuntime`). `getAccessToken`
   * returns null.
   *
   * **Default `true`** (owner canon, 2026-07-17 incident write-up):
   * cookie mode is the right default for a web app — the backend already
   * issues httponly JWT cookies, and header/bearer mode is a NATIVE/mobile
   * concern (no cookie jar shared with a webview, so the token has to live
   * in app storage instead). A web host that actually wants header mode
   * opts in explicitly with `cookieMode: false`.
   *
   * This used to default `false`. The flip matters beyond preference: with
   * bearer assumed, `doRefresh`'s "no local refresh token → give up
   * immediately" early-out (correct FOR bearer mode, where a token really is
   * the only way to refresh) also fired for cookie-mode backends that were
   * simply never told they were in cookie mode — killing the exact bootstrap
   * window a `session_share` QR scan depends on (fresh httponly cookies set
   * by a plain HTTP redirect, no local token, no persisted user; only an
   * actual refresh ATTEMPT over the cookie can discover them).
   */
  readonly cookieMode?: boolean;
  /**
   * Gates the cold-`restore()` refresh probe (see `bootstrapProbe()` below)
   * — consumer-reported gap (meettoday migrators, 2026-07-19): a
   * `session_share` QR scan mints fresh httponly JWT cookies via a plain
   * HTTP redirect entirely outside this runtime, so a bearer-mode host
   * (`cookieMode: false`) landing on ANY other page afterwards had no local
   * token, never attempted the refresh call, and silently settled
   * anonymous despite a valid server-side session — with no signal that
   * coverage had been dropped.
   *
   * - `"auto"` (**default**): probe when `cookieMode` is `true`, OR — in
   *   bearer mode — when the non-httponly hint cookie `stapel_auth_hint`
   *   is present (a plain `document.cookie` check, SSR-safe: `false` when
   *   there is no `document`). `stapel-auth` sets this cookie alongside
   *   every httponly refresh cookie it mints (QR session-share, magic
   *   link, SSO, OAuth callback) specifically so a bearer-mode host can
   *   tell "a cookie session might exist" from "there was never one"
   *   without paying a network round trip on every cold load.
   * - `"always"`: probe unconditionally, bearer mode included, even with
   *   no hint cookie — for backends that don't set the hint.
   * - `"off"`: never probe in bearer mode (the historical behavior). Logs
   *   a ONE-TIME `console.warn` so this gap can't silently recur the way
   *   it did before the hint cookie existed — a bearer host that
   *   deliberately wants no probe should still know cookie-minted
   *   sessions (QR/magic-link/SSO) will never be discovered.
   *
   * Cookie mode (`cookieMode: true`) is unaffected by any of the three
   * values except `"off"` combined with an explicit bearer override — the
   * probe it already always ran stays unconditional.
   */
  readonly bootstrapProbe?: "auto" | "always" | "off";
  /** Notified after a teardown so the host can purge caches / redirect. */
  readonly onTeardown?: (reason: TeardownReason) => void;
  /**
   * Host policy for an involuntary session loss (frontend-core-architecture-v2
   * §43.1): redirect to the login form, or trigger an anonymous auto-login
   * when the guest axis is enabled. Resolve the CHOICE from your own
   * discovery/manifest config — not hardcoded here. Runs in addition to
   * `onTeardown` (which fires for every teardown, including explicit
   * logout; this only fires for an involuntary loss).
   */
  readonly onSessionLost?: (reason: SessionLostReason) => void | Promise<void>;
}

const REFRESH_REVOKED = "error.401.refresh_revoked";

const HINT_COOKIE_NAME = "stapel_auth_hint";

/** SSR-safe: `document` is undefined outside a browser — never a hint there. */
function hasAuthHintCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${HINT_COOKIE_NAME}=`));
}

export function createAuthSession(options: AuthSessionOptions): AuthSession {
  const persistKey = options.persistKey ?? "stapel-auth:session";
  const cookieMode = options.cookieMode ?? true;
  const bootstrapProbeMode = options.bootstrapProbe ?? "auto";
  let offDeclineWarned = false;
  const resolveApi = (): AuthApi =>
    typeof options.api === "function" ? options.api() : options.api;
  const resolveRefreshApi = (): AuthApi => {
    const refreshApi = options.refreshApi;
    if (refreshApi === undefined) return resolveApi();
    return typeof refreshApi === "function" ? refreshApi() : refreshApi;
  };

  /**
   * Whether `doRefresh`/`bootstrapProbe` should actually attempt the
   * network refresh call — see `AuthSessionOptions.bootstrapProbe`'s doc
   * for the full three-state contract. Cookie mode is unconditional
   * (unchanged from before this option existed); bearer mode is gated.
   */
  function shouldRunBootstrapProbe(): boolean {
    if (cookieMode) return true;
    if (bootstrapProbeMode === "off") {
      if (!offDeclineWarned) {
        offDeclineWarned = true;
        console.warn(
          "bootstrapProbe off/declined in bearer mode — cookie-minted sessions (QR/magic-link) will not be discovered"
        );
      }
      return false;
    }
    if (bootstrapProbeMode === "always") return true;
    return hasAuthHintCookie(); // "auto"
  }

  let state: AuthSessionState = {
    user: null,
    tokens: null,
    status: "anonymous",
  };
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function setState(next: AuthSessionState): void {
    state = next;
    notify();
  }

  function persist(): void {
    // Only persist when a storage backend is configured; otherwise the session
    // stays in memory for the page lifetime.
    const storage = options.storage;
    if (storage) {
      // Cookie mode: NEVER persist JWTs into JS-readable storage — the whole
      // point of HTTP-only cookies is that tokens are not stealable via XSS,
      // and mirroring them into IndexedDB/localStorage would reopen exactly
      // that hole. Only the user snapshot is persisted (optimistic user
      // cache); requests authenticate via cookies.
      void storage.set(persistKey, {
        user: state.user,
        tokens: cookieMode ? null : state.tokens,
      });
    }
  }

  /**
   * A refresh failure settles two very different ways depending on whether
   * the session was ever actually established (owner-diagnosed live
   * incident, 2026-07-17 — the "session expired" banner rendering on a cold
   * visit, or after an explicit logout, where no session ever existed to
   * lose): `sessionLost(reason)` — teardown + `onTeardown`/`onSessionLost`,
   * the host's "you were signed in, now you're not" banner policy — fires
   * ONLY if the session had left `"initializing"` BEFORE this refresh
   * attempt started (i.e. it was genuinely `authenticated`/`anonymous`).
   * Still `"initializing"` means there was never a confirmed session to
   * lose — settle quietly via `markUnauthenticated()`, no banner, no
   * `onTeardown` call. ONE piece of logic for every path that can call
   * `doRefresh` — the bootstrap probe on cold `restore()` and a live 401
   * retry both go through this same function (`sessionManager.refresh()`),
   * so there is nowhere left for the wrong banner to sneak back in from.
   *
   * `onTeardown(reason)` fires ONLY if `sessionManager.sessionLost()`
   * actually performed a teardown (owner-diagnosed live incident,
   * 2026-07-17, miттудей race): a request racing in with a 401 while an
   * explicit `logout()` is already tearing this session down gets a `false`
   * back (core's `SessionManager` guards `sessionLost()` off for the
   * duration of `logout()`) — calling `onTeardown('expired'|'revoked')`
   * anyway would fire a "session expired" banner alongside (or ahead of)
   * the logout's own `onTeardown('logout')`, on a session the user
   * deliberately ended.
   */
  async function settleRefreshFailure(reason: TeardownReason): Promise<void> {
    const wasEstablished = sessionManager.getStatus() !== "initializing";
    if (!wasEstablished) {
      sessionManager.markUnauthenticated();
      return;
    }
    const tornDown = await sessionManager.sessionLost(
      reason === "revoked" ? "revoked" : "expired"
    );
    if (tornDown) options.onTeardown?.(reason);
  }

  const sessionManager = createSessionManager({
    doRefresh: async () => {
      const refreshToken = state.tokens?.refresh ?? null;
      if (!cookieMode && refreshToken === null && !shouldRunBootstrapProbe()) {
        // Bearer mode, nothing stored locally, and policy says don't bother
        // (see `AuthSessionOptions.bootstrapProbe`) — a stored refresh
        // token is normally the only way to have a session in bearer mode;
        // give up immediately without a network call.
        await settleRefreshFailure("expired");
        return null;
      }
      try {
        const r = await resolveRefreshApi().tokenRefresh(
          cookieMode ? undefined : (refreshToken ?? undefined)
        );
        setTokens({ access: r.access, refresh: r.refresh });
        return "authenticated";
      } catch (error) {
        const code = error instanceof StapelApiError ? error.code : "";
        if (!(error instanceof StapelApiError)) {
          // A genuine network/transport failure (fetch threw, CORS blocked
          // it, DNS failed…) — NOT a structured API answer like a clean
          // 401. Settling anonymous either way (never throw — see
          // `bootstrapProbe`'s doc), but this is worth a developer noticing:
          // it looks identical to "there was never a session" otherwise,
          // which is exactly the silent-coverage-loss shape this whole
          // option exists to prevent.
          console.warn(
            "stapel-auth: session refresh failed (network error), settling anonymous",
            error
          );
        }
        const reason: TeardownReason = code === REFRESH_REVOKED ? "revoked" : "expired";
        await settleRefreshFailure(reason);
        return null;
      }
    },
    ...(options.onSessionLost !== undefined
      ? { onSessionLost: options.onSessionLost }
      : {}),
  });

  // The mechanical cleanup half of §43.3: this session's own cache (local
  // state + persisted storage) is registered on the SAME logout-hook
  // registry every other `@stapel/*-react` pair uses, instead of a bespoke
  // inline call site. Runs on BOTH `logout()` and an involuntary `sessionLost()`.
  sessionManager.registerLogoutHook(() => {
    setState({ user: null, tokens: null, status: "anonymous" });
    const storage = options.storage;
    if (storage) void storage.del(persistKey);
  });

  function adopt(response: AuthResponse): void {
    setState({
      user: response.user,
      tokens: response.tokens,
      status: "authenticated",
    });
    persist();
    if (response.user.is_anonymous) {
      sessionManager.markAnonymous();
    } else {
      sessionManager.markAuthenticated();
    }
  }

  function setTokens(tokens: AuthTokens): void {
    setState({ ...state, tokens, status: "authenticated" });
    persist();
    if (state.user?.is_anonymous) {
      sessionManager.markAnonymous();
    } else {
      sessionManager.markAuthenticated();
    }
  }

  function onAuthRefresh(): Promise<string | null> {
    // `""` (not `null`) on a successful cookie-mode refresh (owner-diagnosed
    // live incident, 2026-07-17): `getAccessToken()` is ALWAYS null in
    // cookie mode (no bearer token, ever — see its own doc), but `null` is
    // core's `@stapel/core` client's signal for "refresh FAILED, give up".
    // Collapsing "succeeded with no token to attach" into that same `null`
    // made every cookie-mode 401 retry throw the original error instead of
    // ever re-issuing the request (`client.ts`'s `StapelClientOptions.
    // onAuthRefresh` doc has the full three-outcome contract).
    return sessionManager.refresh().then((ok) => (ok ? (getAccessToken() ?? "") : null));
  }

  function getAccessToken(): string | null {
    return cookieMode ? null : (state.tokens?.access ?? null);
  }

  /**
   * Explicit logout (owner-diagnosed live incident, 2026-07-17, миттудей
   * race): local teardown runs FIRST, the server revoke is best-effort
   * AFTER. This used to await the network revoke before any local
   * teardown — in the window between the server honoring that revoke and
   * this function getting back around to `sessionManager.logout()`, a
   * parallel authenticated request (e.g. a `Navbar` still holding a stale
   * query) would 401, retry its own refresh against the now-revoked token,
   * fail, and race a `sessionLost('expired')` teardown in ahead of the
   * explicit logout — rendering a "session expired" banner on a logout the
   * user asked for themselves.
   *
   * Two independent layers close that race, deliberately combined rather
   * than either alone: (1) local teardown no longer waits on the network at
   * all, so the window shrinks to the (synchronous-ish) local
   * teardown/hook-running itself; (2) `sessionManager.logout()` also holds
   * core's `loggingOut` guard for that whole window, so `sessionLost()`
   * calls racing in during it (e.g. from `settleRefreshFailure` above) are
   * no-ops regardless of exactly how the two overlap in time.
   */
  async function logout(): Promise<void> {
    // Mechanical cleanup (the registered hook, incl. this session's own
    // local-state/persisted-storage clear) + the host notification run
    // FIRST — logout is instant from the user's perspective and never
    // depends on (or is raced by) the network revoke below.
    await sessionManager.logout();
    options.onTeardown?.("logout");
    try {
      await resolveApi().logout();
    } catch {
      // Best-effort — local state is already torn down regardless.
    }
  }

  /**
   * Bootstrap probe (owner-diagnosed live incident, 2026-07-17; gating
   * fixed 2026-07-19 after a bearer-mode consumer report — meettoday
   * migrators): a `session_share` QR scan (or magic link / SSO / OAuth
   * callback) sets fresh httponly JWT cookies via a plain HTTP redirect,
   * entirely outside this JS runtime's `adopt()`/`restore()` — the freshly
   * loaded SPA has nothing persisted locally to restore, yet a perfectly
   * valid session already exists server-side. The ONLY way to discover it
   * is to actually attempt the refresh call and see whether the browser's
   * cookie jar carries a live refresh-token cookie.
   *
   * Cookie mode always attempts this (unconditional, as before). Bearer
   * mode is gated by `AuthSessionOptions.bootstrapProbe`
   * (`shouldRunBootstrapProbe()` above) — see that option's doc for the
   * full `"auto"`/`"always"`/`"off"` contract; in short, `"auto"` (the
   * default) only probes bearer mode when the non-httponly
   * `stapel_auth_hint` cookie signals a cookie-minted session might exist,
   * so a bearer host that never touches cookie-minting flows pays ZERO
   * extra network calls on a cold load.
   *
   * Routed through `sessionManager.refresh()` (single-flight `doRefresh`) —
   * the SAME path a live 401 retry uses — rather than a bespoke bypass:
   * `doRefresh`/`settleRefreshFailure` above already know a failure while
   * still `"initializing"` (never confirmed authenticated) is NOT a loss
   * (there was nothing to lose) and settle quietly via
   * `markUnauthenticated()`, no `onTeardown`/`onSessionLost`, no "session
   * expired" banner. A successful probe adopts the returned session via the
   * SAME `setTokens()` call a normal refresh uses (`doRefresh`'s success
   * branch) — no separate bearer-mode adoption path to keep in sync.
   *
   * This function itself never throws: `doRefresh` catches and settles on
   * EVERY failure (401, revoked, a raw network/transport error) — a genuine
   * network failure specifically also gets a one-off `console.warn` there
   * (not just "no session"), since it is otherwise indistinguishable from a
   * legitimate "there was never a session" answer.
   */
  async function bootstrapProbe(): Promise<void> {
    if (!shouldRunBootstrapProbe()) {
      // Bearer mode, policy declines (see `shouldRunBootstrapProbe`) —
      // nothing further to try; settle definitively, no network call.
      sessionManager.markUnauthenticated();
      return;
    }
    // `sessionManager.refresh()` → `doRefresh` above NEVER throws — every
    // failure path (401, revoked, a raw network/transport error) is caught
    // there and settles via `settleRefreshFailure` (quiet
    // `markUnauthenticated()` while still `"initializing"`, which is always
    // true here). A network failure specifically also gets a `console.warn`
    // from that same catch block — see its comment.
    await sessionManager.refresh();
  }

  async function restore(): Promise<void> {
    const storage = options.storage;
    const stored = storage
      ? ((await storage.get(persistKey)) as
          | { user: StapelUser | null; tokens: AuthTokens | null }
          | undefined)
      : undefined;
    if (stored && (stored.tokens !== null || stored.user !== null)) {
      // Bearer mode: tokens are the session. Cookie mode: tokens are never
      // persisted (see `persist`), so a stored user IS the optimistic
      // session — the HTTP-only cookies ride the next request, and a dead
      // cookie pair tears the session down via the refresh seam.
      const authenticated =
        stored.tokens !== null || (cookieMode && stored.user !== null);
      setState({
        user: stored.user,
        tokens: stored.tokens,
        status: authenticated ? "authenticated" : "anonymous",
      });
      if (authenticated) {
        if (stored.user?.is_anonymous) {
          sessionManager.markAnonymous();
        } else {
          sessionManager.markAuthenticated();
        }
        return; // a restored session is settled — no need to probe further
      }
    }
    // Nothing (usable) was persisted locally — the ready-gate (`isReady()`/
    // `whenReady()`) must still resolve, or every query hook gated on it
    // hangs forever. Settle for real, via a bootstrap probe in cookie mode.
    await bootstrapProbe();
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getAccessToken,
    onAuthRefresh,
    adopt,
    setTokens,
    logout,
    restore,
    getSessionManager: () => sessionManager,
  };
}
