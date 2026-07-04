import { StapelApiError } from "@stapel/core";
import type { PersistStorage } from "@stapel/core";
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
  /** For `createStapelClient({ onAuthRefresh })`. Dedups + breaks recursion. */
  onAuthRefresh(): Promise<string | null>;
  /** Commit a session from any AuthResponse (login/register/merge/modify). */
  adopt(response: AuthResponse): void;
  /** Store a bare token pair (e.g. QR `login_request` fulfilment). */
  setTokens(tokens: AuthTokens): void;
  /** Explicit logout: revoke server-side, then tear down locally. */
  logout(): Promise<void>;
  /** Load a persisted session (call once on mount). */
  restore(): Promise<void>;
}

export interface AuthSessionOptions {
  /** Lazy to break the client↔session wiring cycle (see README). */
  readonly api: AuthApi | (() => AuthApi);
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
}

const REFRESH_REVOKED = "error.401.refresh_revoked";

export function createAuthSession(options: AuthSessionOptions): AuthSession {
  const persistKey = options.persistKey ?? "stapel-auth:session";
  const cookieMode = options.cookieMode ?? false;
  const resolveApi = (): AuthApi =>
    typeof options.api === "function" ? options.api() : options.api;

  let state: AuthSessionState = {
    user: null,
    tokens: null,
    status: "anonymous",
  };
  const listeners = new Set<() => void>();

  // Recursion guard: while the refresh network call is in flight, its own 401
  // must NOT re-enter refresh (that call goes through the same client).
  let refreshing = false;
  let inFlight: Promise<string | null> | null = null;

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
      void storage.set(persistKey, { user: state.user, tokens: state.tokens });
    }
  }

  function adopt(response: AuthResponse): void {
    setState({
      user: response.user,
      tokens: response.tokens,
      status: "authenticated",
    });
    persist();
  }

  function setTokens(tokens: AuthTokens): void {
    setState({ ...state, tokens, status: "authenticated" });
    persist();
  }

  function clearLocal(): void {
    setState({ user: null, tokens: null, status: "anonymous" });
    const storage = options.storage;
    if (storage) void storage.del(persistKey);
  }

  function teardown(reason: TeardownReason): void {
    clearLocal();
    options.onTeardown?.(reason);
  }

  async function doRefresh(): Promise<string | null> {
    const refreshToken = state.tokens?.refresh ?? null;
    if (!cookieMode && refreshToken === null) {
      teardown("expired");
      return null;
    }
    refreshing = true;
    try {
      const r = await resolveApi().tokenRefresh(
        cookieMode ? undefined : (refreshToken ?? undefined)
      );
      setTokens({ access: r.access, refresh: r.refresh });
      return r.access;
    } catch (error) {
      const code = error instanceof StapelApiError ? error.code : "";
      teardown(code === REFRESH_REVOKED ? "revoked" : "expired");
      return null;
    } finally {
      refreshing = false;
    }
  }

  function onAuthRefresh(): Promise<string | null> {
    if (refreshing) return Promise.resolve(null);
    if (inFlight) return inFlight;
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function logout(): Promise<void> {
    try {
      await resolveApi().logout();
    } catch {
      // Best-effort — tear down locally regardless.
    }
    teardown("logout");
  }

  async function restore(): Promise<void> {
    const storage = options.storage;
    if (!storage) return;
    const stored = (await storage.get(persistKey)) as
      | { user: StapelUser | null; tokens: AuthTokens | null }
      | undefined;
    if (stored && (stored.tokens !== null || stored.user !== null)) {
      setState({
        user: stored.user,
        tokens: stored.tokens,
        status: stored.tokens !== null ? "authenticated" : "anonymous",
      });
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
    getAccessToken: () => (cookieMode ? null : (state.tokens?.access ?? null)),
    onAuthRefresh,
    adopt,
    setTokens,
    logout,
    restore,
  };
}
