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

/**
 * `doRefresh`'s third answer: "the server did not tell us" (owner-reported
 * live incident, 2026-07-26 — a stand mid-redeploy answered 502, and the app
 * threw the user out to the sign-in page while their session was perfectly
 * valid and the backend simply wasn't there).
 *
 * A refresh has THREE outcomes, not two, and conflating the last two is a
 * bug with a very visible face:
 *
 *  - a {@link SessionStatus} — the server answered, the session lives;
 *  - `null` — the server ANSWERED and the answer was "this credential is no
 *    good" (a clean 401, a revoked refresh token). That is a verdict, and it
 *    justifies tearing the session down;
 *  - `"unavailable"` — no verdict was obtained: fetch threw, DNS failed, the
 *    proxy returned 502/503/504, the request timed out. We know nothing new
 *    about the credential, so the session is left EXACTLY as it was —
 *    no teardown, no logout hooks, no host redirect. `refresh()` still
 *    resolves `false` (the caller's request genuinely didn't get a token, and
 *    should surface its own error), but the user stays signed in and the next
 *    attempt, once the backend is back, simply succeeds.
 *
 * A `doRefresh` that THROWS is treated as `"unavailable"` too: an unexpected
 * exception is not evidence that a credential is dead, and the old behavior
 * (catch → tear the session down) turned any bug in the refresh path into a
 * forced logout.
 */
export const REFRESH_UNAVAILABLE = "unavailable";

export type RefreshOutcome = SessionStatus | typeof REFRESH_UNAVAILABLE | null;

/**
 * The cross-reload half of single-flight (incident D413).
 *
 * `refresh()`'s coalescing is an in-memory promise, so it holds for exactly as
 * long as the JS runtime does. A full document reload — the host's own
 * `location.assign` after a language switch, a hard refresh, an OAuth bounce
 * back onto the app — throws that promise away and boots a FRESH
 * `SessionManager`, which fires its own bootstrap refresh. If the previous
 * page's rotation had not answered yet, the new page presents the refresh
 * token the old page is in the middle of rotating away: the server sees a
 * superseded `jti` and does the only safe thing it can with a replayed
 * refresh token — revokes the session. The person is signed out by nothing
 * but a page load.
 *
 * The guard is a marker in `sessionStorage` — per-tab, and (unlike
 * `localStorage`) surviving exactly the thing that needs surviving: a reload
 * of THIS tab. A manager writes it before dispatching a refresh and clears it
 * when that refresh settles either way; a manager that BOOTS and finds one
 * younger than {@link CreateSessionManagerOptions.refreshHandoffWindowMs}
 * waits for the previous page's rotation to land before deciding whether it
 * needs to refresh at all.
 *
 * A marker older than the window is treated as ABSENT — a tab killed mid
 * rotation must not make the next boot wait, let alone forever.
 *
 * The other half of this fix lives in `stapel-auth`: a short grace window in
 * which the immediately-superseded token is accepted rather than treated as a
 * replay. Either half alone narrows the race; both close it.
 */
export const REFRESH_INFLIGHT_MARKER_KEY = "stapel:auth:refresh-inflight";

/** Default {@link CreateSessionManagerOptions.refreshHandoffWindowMs}. */
export const REFRESH_HANDOFF_WINDOW_MS = 3_000;

interface RefreshMarker {
  readonly startedAt: number;
}

/**
 * Same-document waiters. A `storage` event only reaches OTHER documents, so
 * two managers alive in one runtime (the reload window's overlap, tests, an
 * SSR-hydrated host that builds a second manager) would otherwise wait out the
 * whole window even though the answer already arrived. The listeners here are
 * the in-process half of the same announcement.
 */
const localHandoffWaiters = new Set<() => void>();

function announceHandoffSettled(): void {
  for (const waiter of [...localHandoffWaiters]) waiter();
}

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
  /**
   * A refresh could not reach a verdict (see {@link REFRESH_UNAVAILABLE}).
   * The session is untouched. Hosts can use this to show an "offline /
   * reconnecting" affordance — the one thing they must NOT do is treat it as
   * a session loss.
   */
  "session:refresh-unavailable": { readonly status: SessionStatus };
}

export type SessionEventName = keyof SessionManagerEventMap;

export interface CreateSessionManagerOptions {
  readonly initialStatus?: SessionStatus;
  /**
   * Perform the actual refresh (call the backend, store the new token —
   * that part stays the authenticating module's job). Resolve the resulting
   * {@link SessionStatus} on success, `null` when the server ANSWERED that
   * the credential is dead, or {@link REFRESH_UNAVAILABLE} when no answer was
   * obtained at all (network/proxy/timeout) — see `RefreshOutcome` for why
   * the last two must not be collapsed. Throwing is treated as
   * `REFRESH_UNAVAILABLE`. Called at most once per single-flight window —
   * see `refresh()`.
   */
  readonly doRefresh: () => Promise<RefreshOutcome>;
  /**
   * Host policy for an involuntary session loss (§43.1): redirect to the
   * login form, or trigger an anonymous auto-login when the guest axis is
   * enabled. Deliberately a plain injected callback — the redirect-vs-anon
   * CHOICE is resolved by the host from its own discovery/manifest config,
   * never hardcoded in the framework.
   */
  readonly onSessionLost?: (reason: SessionLostReason) => void | Promise<void>;
  /**
   * How long a refresh marker left by the PREVIOUS document counts as "a
   * rotation is still in flight" — see {@link REFRESH_INFLIGHT_MARKER_KEY}.
   * Default {@link REFRESH_HANDOFF_WINDOW_MS} (3 s), which is the longest a
   * refresh round-trip is worth waiting out before deciding the writer died
   * with the page. Raise it only against a measured refresh latency; it is a
   * ceiling on the wait, not the wait itself — the marker's removal ends it
   * as soon as the rotation actually lands.
   */
  readonly refreshHandoffWindowMs?: number;
  /**
   * Where the marker lives. Default: the ambient `sessionStorage`, and `null`
   * (or a storage that throws — Safari's private mode, a `SecurityError`
   * behind a cookie wall) turns the guard off entirely, restoring the
   * in-memory-only behaviour this manager has always had.
   */
  readonly refreshHandoffStorage?: Storage | null;
  /**
   * A cheap, synchronous read of whatever NON-httponly evidence the host has
   * that a session exists — the hint cookie a cookie-mode backend sets beside
   * the httponly JWT, a bearer token in memory. Read only after waiting out a
   * previous document's rotation: if it says a session is there, the rotation
   * we waited for already produced one and this manager has nothing to
   * refresh, which is the difference between waiting and refreshing anyway.
   * Absent, or `null`: the boot refresh proceeds as usual, just no longer on
   * top of someone else's rotation.
   */
  readonly readSessionHint?: () => SessionStatus | null;
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
   * `false` otherwise — but "otherwise" is two different things, and only one
   * of them ends the session: a `null` from `doRefresh` (the server said the
   * credential is dead) tears it down, with reason `"unknown"` if `doRefresh`
   * didn't already report a more specific one; {@link REFRESH_UNAVAILABLE}
   * (no answer reached us at all) leaves the session untouched and only emits
   * `session:refresh-unavailable`. See the module doc comment above for
   * `doRefresh`'s recursion contract.
   *
   * Single-flight also survives a full document reload — see
   * {@link REFRESH_INFLIGHT_MARKER_KEY}. A BOOT PROBE (a first refresh fired
   * while the manager is still `"initializing"`) that follows a boot which
   * found a live marker waits for the previous page's rotation to land
   * (bounded by `refreshHandoffWindowMs`) and may then skip `doRefresh`
   * entirely; every other call — including a settled session's 401 refresh —
   * behaves exactly as it always has.
   */
  refresh(): Promise<boolean>;

  /**
   * Declare the session lost (refresh failed, or a module independently
   * detects a dead session). Idempotent: a no-op once already
   * `"unauthenticated"`, so it is always safe to call defensively (e.g. as a
   * fallback after `doRefresh` already reported a more specific reason
   * itself, or from N concurrent callers that each independently exhaust
   * their retry).
   *
   * ALSO a no-op while an explicit {@link logout} is in flight (owner-
   * diagnosed live incident, 2026-07-17: a request racing in against a
   * server that already honored the logout's revoke call, but before local
   * teardown/`registerLogoutHook`s finish running, 401s and fails its own
   * refresh — that must never sneak in a contradictory `"session lost"`
   * teardown/notification ahead of the logout that is already tearing this
   * session down). Resolves `true` if this call actually performed the
   * teardown, `false` if it was a no-op for either reason — callers that
   * gate a user-facing notification on "did a loss really happen" (e.g.
   * `@stapel/auth-react`'s `onTeardown`) should check the return value
   * rather than assume every call reports something.
   */
  sessionLost(reason?: SessionLostReason): Promise<boolean>;

  /**
   * Explicit logout (§43.3): drops the encryption key FIRST and
   * synchronously (a tab crash mid-wipe still leaves any un-deleted
   * ciphertext unreadable — §43.5), then runs every registered logout hook,
   * then transitions to `"unauthenticated"` and emits `session:logout`.
   *
   * For the FULL duration of this call (set synchronously before the first
   * `await`, cleared once teardown settles) {@link sessionLost} is guarded
   * off — see its doc comment. A caller that itself does a network revoke
   * around this call (e.g. `@stapel/auth-react`'s `AuthSession.logout`)
   * should call this FIRST and treat the revoke as best-effort afterward:
   * local teardown must never wait on — or be raced by — the network.
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

  // ── the cross-reload half of it (D413) ────────────────────────────────────
  const handoffWindowMs = options.refreshHandoffWindowMs ?? REFRESH_HANDOFF_WINDOW_MS;
  // `undefined` means "the ambient one"; an explicit `null` switches the guard
  // off. Reading `sessionStorage` can itself THROW (a cookie wall, a sandboxed
  // iframe), which is why even the lookup is guarded.
  const handoffStorage: Storage | null = (() => {
    if (options.refreshHandoffStorage !== undefined) return options.refreshHandoffStorage;
    try {
      // Raw `sessionStorage`, and structurally so: this file is a named
      // exception in the plugin's `STORAGE_ALLOWED` (§43.4), beside the
      // `no-adhoc-401` carve-out it already had. What is stored is one
      // timestamp — "a token rotation is out right now" — which must be
      // readable SYNCHRONOUSLY at construction (before any await, or the next
      // document has already dispatched its own refresh), must be per-tab,
      // and must survive a logout, since a logout is exactly when the last
      // rotation still has to be visible to the page that loads next.
      // `createRepository` is async, session-scoped and built ON this
      // manager, so it cannot be what this manager boots through.
      return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
      return null;
    }
  })();

  function readMarker(): RefreshMarker | null {
    if (handoffStorage === null) return null;
    let raw: string | null = null;
    try {
      raw = handoffStorage.getItem(REFRESH_INFLIGHT_MARKER_KEY);
    } catch {
      return null;
    }
    if (raw === null) return null;
    let startedAt: unknown;
    try {
      startedAt = (JSON.parse(raw) as { startedAt?: unknown }).startedAt;
    } catch {
      startedAt = undefined;
    }
    // Unreadable is as good as absent: a marker nobody can date cannot be
    // aged out, and a guard that never ages out is a permanent 3 s tax.
    if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) {
      clearMarker();
      return null;
    }
    return { startedAt };
  }

  function writeMarker(): void {
    if (handoffStorage === null) return;
    try {
      handoffStorage.setItem(
        REFRESH_INFLIGHT_MARKER_KEY,
        JSON.stringify({ startedAt: Date.now() } satisfies RefreshMarker)
      );
    } catch {
      /* quota, private mode, a storage that refuses writes — the guard is an
         optimisation, never a precondition. */
    }
  }

  function clearMarker(): void {
    if (handoffStorage === null) return;
    try {
      handoffStorage.removeItem(REFRESH_INFLIGHT_MARKER_KEY);
    } catch {
      /* see writeMarker */
    }
    announceHandoffSettled();
  }

  // Read ONCE, at construction: the only marker that can belong to a previous
  // document is the one already there when this manager was born. Everything
  // later is our own. `null` here is the whole "no behaviour change when no
  // marker exists" clause.
  const bootMarker = readMarker();
  let handoffDeadline: number | null =
    bootMarker === null ? null : bootMarker.startedAt + handoffWindowMs;
  if (handoffDeadline !== null && handoffDeadline <= Date.now()) {
    // Stale: the writer died with its page. Treat as absent, and tidy up so
    // the next boot does not read it either.
    handoffDeadline = null;
    clearMarker();
  }

  /**
   * Wait out a previous document's rotation: until the marker is removed (the
   * rotation landed — announced in-process, or as a `storage` event from the
   * document that wrote it) or until the window closes, whichever is first.
   * One-shot: `handoffDeadline` is consumed here, so only the FIRST refresh
   * after a boot ever pays this.
   */
  async function awaitHandoff(deadline: number): Promise<void> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    await new Promise<void>((resolve) => {
      let done = false;
      const settle = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        localHandoffWaiters.delete(settle);
        if (typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
        }
        resolve();
      };
      const onStorage = (event: StorageEvent): void => {
        // The announcement is the REMOVAL: a rotation that settled clears its
        // own marker. A write is another document starting one, which is not
        // news we can act on.
        if (event.key === REFRESH_INFLIGHT_MARKER_KEY && event.newValue === null) {
          settle();
        }
      };
      const timer = setTimeout(settle, remaining);
      localHandoffWaiters.add(settle);
      if (typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
      }
    });
  }

  // Logout-in-progress guard (owner-diagnosed live incident, 2026-07-17 —
  // see `sessionLost`'s doc comment on the interface above). Set
  // SYNCHRONOUSLY at the top of `logout()`, before its first `await`, so no
  // window exists where a concurrent 401's failed refresh can observe it as
  // `false` and slip a `sessionLost()` teardown in ahead of the logout that
  // is already tearing this exact session down.
  let loggingOut = false;

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

  async function sessionLost(reason: SessionLostReason = "unknown"): Promise<boolean> {
    if (status === "unauthenticated") return false; // idempotent
    // An explicit logout() already owns tearing this session down — see the
    // interface doc comment and `logout()` below.
    if (loggingOut) return false;
    await teardown("lost", reason);
    return true;
  }

  async function logout(): Promise<void> {
    loggingOut = true;
    try {
      await teardown("logout");
    } finally {
      loggingOut = false;
    }
  }

  function refresh(): Promise<boolean> {
    if (inFlight) return inFlight;
    const p = (async () => {
      // The cross-reload guard, consumed once (D413): only a BOOT PROBE —
      // this manager's first refresh, fired while it still has no idea
      // whether a session exists — after a boot that FOUND a live marker ever
      // waits, and it waits only until the previous document's rotation
      // lands. A manager that already knows its status is not the reloaded
      // page racing its predecessor; it is a live session hitting a 401, and
      // holding that request for up to three seconds would be a new defect
      // paid for by every host with a second manager (SSR, multi-tenant) or a
      // 401 arriving early in a page's life.
      const deadline = status === "initializing" ? handoffDeadline : null;
      handoffDeadline = null;
      if (deadline !== null) {
        await awaitHandoff(deadline);
        const hint = options.readSessionHint?.() ?? null;
        if (hint !== null) {
          // The rotation we waited out produced a session. Dispatch nothing:
          // the credential this manager would have presented is the one that
          // rotation just replaced, and presenting it is what got sessions
          // revoked.
          setStatus(hint);
          return true;
        }
        // No hint seam wired, but something else settled us while we waited
        // (an `adopt()`/`restore()`, the host's own bootstrap).
        if (status === "authenticated" || status === "anonymous") return true;
      }
      let outcome: RefreshOutcome = null;
      // The marker is this document's claim on the rotation, for whatever
      // document loads next.
      writeMarker();
      try {
        outcome = await options.doRefresh();
      } catch {
        // An exception is not a verdict about the credential — see
        // REFRESH_UNAVAILABLE. Tearing the session down here turned any bug
        // in the refresh path into a forced logout.
        outcome = REFRESH_UNAVAILABLE;
      } finally {
        // Settled either way: success, verdict, or no answer at all. A marker
        // outliving its refresh is the failure mode this guard must not have.
        clearMarker();
      }
      if (outcome === REFRESH_UNAVAILABLE) {
        // No verdict: leave the session EXACTLY as it was. `false` still goes
        // back to the caller (its request really did not get a token), but
        // nothing is torn down and the host's redirect policy never fires.
        emit("session:refresh-unavailable", { status });
        return false;
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
