/**
 * The session substrate (frontend-core-architecture-v2 §43.1–§43.3). The ONE
 * place the frontend owns session lifecycle: status, single-flight refresh,
 * the logout-hook registry, and the per-session encryption key that
 * {@link createRepository} (`./repository.ts`) uses for user-scoped storage.
 *
 * A module that authenticates (today: `@stapel/auth-react`) owns its OWN
 * tokens and the mechanics of refreshing them (which endpoint, which body) —
 * it supplies that as `doRefresh`. `SessionManager` owns everything generic
 * around it: coalescing concurrent 401s into one refresh call, the
 * three-state status, the typed events, and the logout-hook fan-out every
 * `@stapel/*-react` pair registers into (§43.3) instead of writing its own
 * cleanup call site.
 *
 * Contract for `doRefresh`: issue the refresh HTTP call through a client that
 * does NOT itself carry the `onAuthRefresh` seam (a client built without
 * `onAuthRefresh` — `@stapel/auth-react`'s runtime wires a dedicated
 * refresh-only client for exactly this). `refresh()` below is single-flight
 * coalescing, not recursion protection — if `doRefresh`'s own network call
 * re-enters `refresh()` through the same client, it awaits the very promise
 * it is nested inside and deadlocks.
 */

/**
 * `"initializing"` (owner-diagnosed live incident, 2026-07-17 — a QR
 * `session_share` scan sets fresh httponly cookies via a plain HTTP redirect,
 * entirely OUTSIDE this JS runtime's `adopt()`/`restore()`; the freshly
 * loaded SPA has no persisted user to restore and has not yet been told it's
 * authenticated) is a DISTINCT state from `"unauthenticated"` — the
 * difference is the whole fix. `"unauthenticated"` means "we checked, there
 * is no session"; `"initializing"` means "we have not checked yet". Every
 * `SessionManager` is born `"initializing"` and MUST resolve to one of the
 * other three (via `markAuthenticated`/`markAnonymous`, or a `refresh()`
 * bootstrap probe that fails) before a query hook gated on
 * {@link SessionManager.isReady}/`whenReady` is allowed to fire. Collapsing
 * this into `"unauthenticated"` (the previous default) is what let a query
 * hook with no manual `enabled` gate race the bootstrap window and read a
 * confirmed-valid cookie session as "session expired".
 */
export type SessionStatus =
  | "initializing"
  | "authenticated"
  | "anonymous"
  | "unauthenticated";

/** Why a session was declared lost (refresh failed or was never possible). */
export type SessionLostReason = "expired" | "revoked" | "unknown";

/** Why the logout-hook registry is being run. */
export type SessionLogoutReason = "logout" | "lost";

/**
 * Registered via {@link SessionManager.registerLogoutHook}. Run on BOTH an
 * explicit `logout()` and an involuntary `sessionLost()` — §43.3's hard rule
 * is "put something in user-scoped storage, you must register how it comes
 * out," and a lost session needs the same cleanup an explicit logout does.
 */
export type LogoutHook = (reason: SessionLogoutReason) => void | Promise<void>;

export interface SessionManagerEventMap {
  "session:refreshed": { readonly status: SessionStatus };
  "session:lost": { readonly reason: SessionLostReason };
  "session:logout": { readonly reason: SessionLogoutReason };
}

export type SessionEventName = keyof SessionManagerEventMap;

export interface CreateSessionManagerOptions {
  readonly initialStatus?: SessionStatus;
  /**
   * Perform the actual refresh (call the backend, store the new token —
   * that part stays the authenticating module's job). Resolve the resulting
   * {@link SessionStatus} on success; resolve `null` (or throw) on failure.
   * Called at most once per single-flight window — see `refresh()`.
   */
  readonly doRefresh: () => Promise<SessionStatus | null>;
  /**
   * Host policy for an involuntary session loss (§43.1): redirect to the
   * login form, or trigger an anonymous auto-login when the guest axis is
   * enabled. Deliberately a plain injected callback — the redirect-vs-anon
   * CHOICE is resolved by the host from its own discovery/manifest config,
   * never hardcoded in the framework.
   */
  readonly onSessionLost?: (reason: SessionLostReason) => void | Promise<void>;
}

export interface SessionManager {
  getStatus(): SessionStatus;
  /** Re-renders on every status transition (wire into `useSyncExternalStore`). */
  subscribe(listener: (status: SessionStatus) => void): () => void;
  on<K extends SessionEventName>(
    event: K,
    handler: (payload: SessionManagerEventMap[K]) => void
  ): () => void;

  markAuthenticated(): void;
  markAnonymous(): void;
  /**
   * Settle `"initializing"` into a CONFIRMED `"unauthenticated"` with no
   * session ever having existed — e.g. bearer/header mode restoring nothing
   * from storage, or a cookie-mode bootstrap probe (`refresh()`) coming back
   * negative. Deliberately distinct from `sessionLost()`: this is "we
   * checked, there was never a session" (no logout hooks, no
   * `onSessionLost` callback — nothing was ever torn down), not "there WAS
   * one and it just ended" (`sessionLost()`'s job, which DOES run that
   * teardown). Calling `sessionLost()` here would fire a host's redirect-to-
   * login policy for a plain first-time anonymous visitor.
   */
  markUnauthenticated(): void;

  /**
   * Single-flight guarded refresh (§43.1): concurrent callers (N requests
   * that each hit a 401) share the ONE in-flight `doRefresh()` call and all
   * resolve together, with the same outcome. Resolves `true` on success,
   * `false` on failure (a failure `doRefresh` didn't already report via
   * `sessionLost()` itself still tears the session down, with reason
   * `"unknown"` — see `sessionLost`'s idempotency below). See the module doc
   * comment above for `doRefresh`'s recursion contract.
   */
  refresh(): Promise<boolean>;

  /**
   * Declare the session lost (refresh failed, or a module independently
   * detects a dead session). Idempotent: a no-op once already
   * `"unauthenticated"`, so it is always safe to call defensively (e.g. as a
   * fallback after `doRefresh` already reported a more specific reason
   * itself, or from N concurrent callers that each independently exhaust
   * their retry).
   */
  sessionLost(reason?: SessionLostReason): Promise<void>;

  /**
   * Explicit logout (§43.3): drops the encryption key FIRST and
   * synchronously (a tab crash mid-wipe still leaves any un-deleted
   * ciphertext unreadable — §43.5), then runs every registered logout hook,
   * then transitions to `"unauthenticated"` and emits `session:logout`.
   */
  logout(): Promise<void>;

  /**
   * Register cleanup run on `logout()` AND `sessionLost()`. Returns an
   * unregister function. `createRepository(namespace, { scope: "user" })`
   * calls this for you — most callers never need it directly.
   */
  registerLogoutHook(hook: LogoutHook): () => void;

  /**
   * `true` once the session has left `"initializing"` (authenticated,
   * anonymous, OR confirmed unauthenticated — any of the three is "ready",
   * only "we haven't checked yet" is not). A module's query hooks gate on
   * this (directly, or via `@stapel/core`'s `useSessionReady`) instead of
   * each hand-rolling an `enabled` condition per hook.
   */
  isReady(): boolean;

  /**
   * Resolves the first time the session leaves `"initializing"` — resolves
   * immediately (already-settled promise) if it already has. The framework-
   * level ready-gate (owner directive, 2026-07-17 incident): a module's http
   * client / query layer awaits this before firing the first request that
   * needs to know whether a session exists, so no individual query hook has
   * to manually gate on session readiness.
   */
  whenReady(): Promise<void>;

  /**
   * The per-session WebCrypto AES-GCM key `createRepository`'s encrypted
   * repositories use (§43.5). Generated lazily, kept in memory only (never
   * persisted, never exported — non-extractable), and dropped on
   * logout/session-loss. Internal to the repository layer; exposed for
   * advanced/test use.
   */
  getSessionKey(): Promise<CryptoKey>;
}

export function createSessionManager(
  options: CreateSessionManagerOptions
): SessionManager {
  // Default is `"initializing"`, NOT `"unauthenticated"` — see the module
  // doc on `SessionStatus`. A caller that already knows its status
  // synchronously (rare — most sessions restore/probe asynchronously) can
  // still pass `initialStatus` to skip the ready-gate entirely.
  let status: SessionStatus = options.initialStatus ?? "initializing";
  const statusListeners = new Set<(status: SessionStatus) => void>();
  const eventListeners = new Map<SessionEventName, Set<(payload: unknown) => void>>();
  const logoutHooks = new Set<LogoutHook>();

  // Single-flight coalescing (see `refresh()` doc above).
  let inFlight: Promise<boolean> | null = null;

  // Per-session encryption key (§43.5) — lazy, memory-only, dropped on
  // teardown. Non-extractable: it never needs to leave this process.
  let keyPromise: Promise<CryptoKey> | null = null;

  // The ready-gate (§ owner directive 2026-07-17): resolves the first time
  // `status` leaves `"initializing"`. Built from a manually-resolved promise
  // (not derived from `subscribe`) so `whenReady()` called AFTER the
  // transition already happened still resolves immediately — a `subscribe`-
  // based wait would hang forever for a late caller.
  let resolveReady: (() => void) | null = null;
  const readyPromise: Promise<void> =
    status === "initializing"
      ? new Promise((resolve) => {
          resolveReady = resolve;
        })
      : Promise.resolve();

  function setStatus(next: SessionStatus): void {
    if (status === next) return;
    const wasInitializing = status === "initializing";
    status = next;
    if (wasInitializing && next !== "initializing" && resolveReady) {
      resolveReady();
      resolveReady = null;
    }
    for (const listener of statusListeners) listener(status);
  }

  function emit<K extends SessionEventName>(
    event: K,
    payload: SessionManagerEventMap[K]
  ): void {
    const listeners = eventListeners.get(event);
    if (!listeners) return;
    for (const listener of listeners) listener(payload);
  }

  function dropSessionKey(): void {
    // Synchronous — must happen before any awaited cleanup so a crash mid-wipe
    // still leaves remaining ciphertext unreadable (§43.5).
    keyPromise = null;
  }

  async function getSessionKey(): Promise<CryptoKey> {
    if (!keyPromise) {
      keyPromise = crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }
    return keyPromise;
  }

  async function runLogoutHooks(reason: SessionLogoutReason): Promise<void> {
    const hooks = [...logoutHooks];
    // `Promise.resolve().then(...)` wraps a hook that throws SYNCHRONOUSLY
    // (not just one that returns a rejected promise) so one broken hook never
    // stops the rest from running — `.map()` itself would otherwise throw
    // immediately on the first synchronous throw, before `allSettled` sees it.
    await Promise.allSettled(
      hooks.map((hook) => Promise.resolve().then(() => hook(reason)))
    );
  }

  async function teardown(
    logoutReason: SessionLogoutReason,
    lostReason?: SessionLostReason
  ): Promise<void> {
    dropSessionKey();
    await runLogoutHooks(logoutReason);
    setStatus("unauthenticated");
    if (logoutReason === "logout") {
      emit("session:logout", { reason: "logout" });
    } else {
      const reason = lostReason ?? "unknown";
      emit("session:lost", { reason });
      await options.onSessionLost?.(reason);
    }
  }

  async function sessionLost(reason: SessionLostReason = "unknown"): Promise<void> {
    if (status === "unauthenticated") return; // idempotent
    await teardown("lost", reason);
  }

  async function logout(): Promise<void> {
    await teardown("logout");
  }

  function refresh(): Promise<boolean> {
    if (inFlight) return inFlight;
    const p = (async () => {
      let outcome: SessionStatus | null = null;
      try {
        outcome = await options.doRefresh();
      } catch {
        outcome = null;
      }
      if (outcome !== null) {
        setStatus(outcome);
        emit("session:refreshed", { status: outcome });
        return true;
      }
      // Fallback net: safe even if `doRefresh` already called `sessionLost`
      // with a specific reason — that call already transitioned status to
      // "unauthenticated", so this is a no-op idempotent re-check.
      await sessionLost();
      return false;
    })();
    inFlight = p.finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  const manager: SessionManager = {
    getStatus: () => status,
    subscribe(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    on(event, handler) {
      let set = eventListeners.get(event);
      if (!set) {
        set = new Set();
        eventListeners.set(event, set);
      }
      set.add(handler as (payload: unknown) => void);
      return () => {
        set?.delete(handler as (payload: unknown) => void);
      };
    },
    markAuthenticated: () => setStatus("authenticated"),
    markAnonymous: () => setStatus("anonymous"),
    markUnauthenticated: () => setStatus("unauthenticated"),
    refresh,
    sessionLost,
    logout,
    registerLogoutHook(hook) {
      logoutHooks.add(hook);
      return () => {
        logoutHooks.delete(hook);
      };
    },
    isReady: () => status !== "initializing",
    whenReady: () => readyPromise,
    getSessionKey,
  };
  __setActiveSessionManager(manager);
  return manager;
}

// ── active-manager registry ──────────────────────────────────────────────────
//
// `createRepository(namespace, { scope: "user" })` (`./repository.ts`) needs a
// `SessionManager` to register its wipe-at-logout hook on and to source the
// encryption key from, but the documented call shape
// (`createRepository(namespace, options)`, §43.4) takes no manager argument —
// most apps have exactly one. The last-created manager becomes "active";
// `createModuleRuntime` (`./module.ts`) uses the same registry to wire its
// default logout hook. Tests / multi-manager hosts (SSR, multi-tenant) bypass
// this by passing an explicit `sessionManager` to `createRepository`.
let activeSessionManager: SessionManager | null = null;
type PendingWipe = () => void | Promise<void>;
const pendingWipes: PendingWipe[] = [];

/** Internal: called by `createSessionManager` to become "the" active manager. */
export function __setActiveSessionManager(manager: SessionManager): void {
  activeSessionManager = manager;
  for (const wipe of pendingWipes.splice(0)) {
    manager.registerLogoutHook(() => wipe());
  }
}

/**
 * The most recently created `SessionManager`, or `null` if none exists yet.
 * Used by `createRepository`'s `scope: "user"` wiring and by
 * `createModuleRuntime`'s default logout hook (§43.3/§43.7) when no explicit
 * manager is supplied.
 */
export function getActiveSessionManager(): SessionManager | null {
  return activeSessionManager;
}

/**
 * Register a wipe callback for when a `SessionManager` becomes active, even
 * if one does not exist yet (a repository can be constructed before the
 * host's runtime wires its session manager). Once bound, later calls
 * register directly.
 */
export function __registerWipeWhenActive(wipe: PendingWipe): void {
  if (activeSessionManager) {
    activeSessionManager.registerLogoutHook(() => wipe());
  } else {
    pendingWipes.push(wipe);
  }
}
