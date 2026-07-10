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
   * attached and refresh uses `GET /token/refresh/` (cookie). `getAccessToken`
   * returns null. Default `false` (header/bearer mode).
   */
  readonly cookieMode?: boolean;
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

export function createAuthSession(options: AuthSessionOptions): AuthSession {
  const persistKey = options.persistKey ?? "stapel-auth:session";
  const cookieMode = options.cookieMode ?? false;
  const resolveApi = (): AuthApi =>
    typeof options.api === "function" ? options.api() : options.api;
  const resolveRefreshApi = (): AuthApi => {
    const refreshApi = options.refreshApi;
    if (refreshApi === undefined) return resolveApi();
    return typeof refreshApi === "function" ? refreshApi() : refreshApi;
  };

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

  const sessionManager = createSessionManager({
    doRefresh: async () => {
      const refreshToken = state.tokens?.refresh ?? null;
      if (!cookieMode && refreshToken === null) {
        // Mechanical cleanup (the registered hook) runs BEFORE the host
        // notification, same order as an explicit logout — see `logout()`.
        await sessionManager.sessionLost("expired");
        options.onTeardown?.("expired");
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
        const reason: TeardownReason = code === REFRESH_REVOKED ? "revoked" : "expired";
        await sessionManager.sessionLost(reason === "revoked" ? "revoked" : "expired");
        options.onTeardown?.(reason);
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
    return sessionManager.refresh().then((ok) => (ok ? getAccessToken() : null));
  }

  function getAccessToken(): string | null {
    return cookieMode ? null : (state.tokens?.access ?? null);
  }

  async function logout(): Promise<void> {
    try {
      await resolveApi().logout();
    } catch {
      // Best-effort — tear down locally regardless.
    }
    // Mechanical cleanup (the registered hook, incl. this session's own
    // local-state/persisted-storage clear) runs before the host notification
    // — matches the involuntary-loss ordering in `doRefresh` above.
    await sessionManager.logout();
    options.onTeardown?.("logout");
  }

  async function restore(): Promise<void> {
    const storage = options.storage;
    if (!storage) return;
    const stored = (await storage.get(persistKey)) as
      | { user: StapelUser | null; tokens: AuthTokens | null }
      | undefined;
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
      }
    }
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
