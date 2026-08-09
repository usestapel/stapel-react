import { createSessionManager, REFRESH_UNAVAILABLE, StapelApiError } from "@stapel/core";
import type {
  PersistStorage,
  RefreshOutcome,
  SessionLostReason,
  SessionManager,
} from "@stapel/core";
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

/**
 * INVARIANT (owner incident, 2026-07-20 — meettoday migrators, composing
 * with the bearer-mode `bootstrapProbe` fix in 3747681): `status ===
 * "authenticated"` is UNREACHABLE while `user === null`. `status` is not an
 * independently settable field — every mutator below derives it from
 * `user`/`tokens` via `computeStatus()`, so `{ status: "authenticated", user:
 * null }` cannot be constructed through this module's public surface. A
 * consumer that gates on BOTH (e.g. a `ProtectedRoute` redirecting on
 * `!isAuthenticated || !user`) can rely on them never disagreeing.
 */
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
  /**
   * Store a bare token pair (e.g. QR `login_request` fulfilment). Tokens
   * alone never carry a user (`AuthTokens`/`TokenPairResponse` is
   * access+refresh only) — if the session doesn't already know who's
   * signed in, this resolves that via `me()` (using the seam-free refresh
   * client, so it's safe to call from inside `doRefresh`) before settling
   * `"authenticated"`; see the `AuthSessionState` invariant doc above.
   *
   * Never throws; reports what it settled on. A REJECTED resolution (the
   * server answered 401/403) clears the tokens and settles unauthenticated
   * rather than leave a dangling, unconfirmed session — `null`. A resolution
   * that never reached the server at all (outage, 5xx, timeout) KEEPS the
   * tokens and reports `"unavailable"`, because an unreachable backend is not
   * evidence that a credential is dead (see core's `REFRESH_UNAVAILABLE`).
   */
  setTokens(tokens: AuthTokens): Promise<RefreshOutcome>;
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

/**
 * Did this failure actually tell us the credential is dead? (owner-reported
 * live incident, 2026-07-26: the stand was mid-redeploy, the browser got a
 * 502 out of nginx, and the app threw a signed-in user onto the sign-in page
 * — a failed refresh is not a reason to tear down the session.)
 *
 * Only the auth service itself can retire a credential, and only by
 * answering. Everything else — fetch threw, DNS/TLS failed, the request timed
 * out, a proxy replied 502/503/504 because the upstream was restarting, or a
 * 5xx from the service's own crash — says nothing about whether the session is
 * valid, so the session must survive it untouched (see
 * `REFRESH_UNAVAILABLE`).
 *
 * 401/403 are the verdicts. 429 is NOT: being rate-limited is a "come back
 * later", and logging the user out for it is exactly backwards.
 */
function isAuthVerdict(error: unknown): boolean {
  if (!(error instanceof StapelApiError)) return false; // transport failure
  const { status } = error;
  if (status === 401 || status === 403) return true;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

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
  //: True only while `bootstrapProbe()` is in flight. A probe is a SEARCH
  //: for a session, not a check of one — so its failure must never be
  //: reported as a loss (see `settleRefreshFailure`).
  let probing = false;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  /**
   * The one place `status` is computed (`AuthSessionState`'s invariant doc
   * above) — DERIVED from `user`/`tokens`, never hand-set. `user === null`
   * is always `"anonymous"` regardless of mode. Bearer mode additionally
   * requires `tokens !== null` (the token pair IS the session — there is no
   * other channel); cookie mode does not (the httponly cookie carries the
   * session invisibly to this JS runtime — see `restore()`'s "optimistic
   * user cache" case, where a restored user legitimately has no in-memory
   * tokens at all).
   */
  function computeStatus(
    user: StapelUser | null,
    tokens: AuthTokens | null
  ): AuthSessionState["status"] {
    if (user === null) return "anonymous";
    if (!cookieMode && tokens === null) return "anonymous";
    return "authenticated";
  }

  function setState(next: { user: StapelUser | null; tokens: AuthTokens | null }): void {
    state = { user: next.user, tokens: next.tokens, status: computeStatus(next.user, next.tokens) };
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
   * 2026-07-17, meettoday race): a request racing in with a 401 while an
   * explicit `logout()` is already tearing this session down gets a `false`
   * back (core's `SessionManager` guards `sessionLost()` off for the
   * duration of `logout()`) — calling `onTeardown('expired'|'revoked')`
   * anyway would fire a "session expired" banner alongside (or ahead of)
   * the logout's own `onTeardown('logout')`, on a session the user
   * deliberately ended.
   */
  async function settleRefreshFailure(reason: TeardownReason): Promise<void> {
    if (probing) {
      // A BOOTSTRAP probe came back negative — "we looked for a session and
      // found none", which is not the same fact as "the session you had just
      // ended". You cannot lose what you never had, so this settles quietly
      // and never runs a teardown.
      //
      // Owner-reported live incident, 2026-07-26 (the redirect strobe,
      // second and deeper cause): the ironmemo app keeps its OWN auth
      // context, which calls GET /me/ through the runtime client. With a
      // live access cookie and a dead refresh cookie — a state the server is
      // entitled to be in — /me answered 200 and the app marked the manager
      // authenticated, while this library's `restore()`, finding none of ITS
      // OWN persisted state, ran the probe. The probe's 401 then read as a
      // loss (status was no longer "initializing", because /me had won the
      // race moments earlier), tore the session down and fired the host's
      // hard redirect to /sign-in. Reload, /me 200 again, sign-in bounces to
      // /app, probe 401 again — 222 requests of it.
      //
      // The status check below cannot cover this on its own: it asks "was a
      // session established?", and by then one WAS — just not by us.
      if (sessionManager.getStatus() === "initializing") {
        sessionManager.markUnauthenticated();
      }
      return;
    }
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
        // `setTokens` (LAYER B) already resolved — or, on a failed
        // resolution, cleared — `state.user` and marked the core
        // `SessionManager` itself; it reports what it actually landed on
        // rather than this hardcoding `"authenticated"` (which used to
        // unconditionally override a guest's `markAnonymous()`, and would
        // now also override a failed user-resolution's
        // `markUnauthenticated()`, moments later). Its `"unavailable"` rides
        // straight through for the same reason it does below: a `me()` that
        // never reached the server is not a verdict either.
        return await setTokens({ access: r.access, refresh: r.refresh });
      } catch (error) {
        if (!isAuthVerdict(error)) {
          // The backend never rendered a verdict — it was unreachable, or it
          // answered 5xx/timeout/429. The credential may well still be good,
          // so the session is left exactly as it is: no teardown, no
          // `onTeardown`, no host redirect to /sign-in (see `isAuthVerdict`
          // and core's `REFRESH_UNAVAILABLE`).
          //
          // The one case that still has to settle is a COLD start: the
          // bootstrap probe below is what resolves `"initializing"`, and
          // leaving it unresolved hangs every query hook gated on
          // `whenReady()` forever. There we settle quietly
          // (`markUnauthenticated()`, no banner) — the app renders signed-out
          // and a reload once the backend is back finds the cookie session.
          console.warn(
            "stapel-auth: session refresh could not reach a verdict (backend unreachable or 5xx) — keeping the session",
            error
          );
          if (sessionManager.getStatus() === "initializing") {
            sessionManager.markUnauthenticated();
          }
          return REFRESH_UNAVAILABLE;
        }
        const code = error instanceof StapelApiError ? error.code : "";
        const reason: TeardownReason = code === REFRESH_REVOKED ? "revoked" : "expired";
        const wasProbe = probing;
        await settleRefreshFailure(reason);
        if (wasProbe) {
          // `null` is core's "the credential is dead" signal, and core acts
          // on it — `refresh()` calls `sessionLost()` itself as a fallback
          // net. That net is right for a live 401 and wrong for a probe: a
          // SEARCH that found nothing must not tear down a session someone
          // else established (the /me-answered-200 race in the strobe
          // incident). Reporting the status the probe settled on leaves
          // core's `setStatus` a no-op and skips the net entirely.
          const settled = sessionManager.getStatus();
          return settled === "initializing" ? "unauthenticated" : settled;
        }
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
    setState({ user: null, tokens: null });
    const storage = options.storage;
    // RETURNED, not fire-and-forget (owner-reported live incident,
    // 2026-07-26: "redirect stroboscope, /app ↔ /sign-in in a loop").
    //
    // `runLogoutHooks` awaits every hook — so a hook that starts an async
    // wipe and returns `undefined` tells the session manager the teardown is
    // complete while the delete is still in flight. The host's
    // `onSessionLost` policy then runs, and a hard `window.location.href`
    // redirect tears the page down BEFORE IndexedDB commits the delete. The
    // reloaded page restores the very user that was supposed to be gone, the
    // sign-in screen sees a session and bounces to /app, /app's refresh 401s
    // again — and the loop only stops if a wipe happens to win a race
    // against a navigation. That is exactly what "it flickered and then
    // settled" looks like from the outside.
    if (storage) return storage.del(persistKey);
  });

  function adopt(response: AuthResponse): void {
    setState({ user: response.user, tokens: response.tokens });
    persist();
    if (response.user.is_anonymous) {
      sessionManager.markAnonymous();
    } else {
      sessionManager.markAuthenticated();
    }
  }

  /**
   * Resolves who a bare token pair belongs to (`setTokens`'s LAYER B below).
   * Routed through `refreshApi` (no `onAuthRefresh` seam) for the SAME
   * reentrancy reason `doRefresh`'s own refresh call is: this can run
   * INSIDE the core `SessionManager`'s single-flight `refresh()` window
   * (the `doRefresh` → `setTokens` path), and a 401 here through the
   * seam-carrying main client would call back into the very `refresh()`
   * promise this is nested inside and deadlock (`AuthSessionOptions
   * .refreshApi`'s doc). Bearer mode auth still rides correctly: `state
   * .tokens` is updated (below, BEFORE this is called) to the new pair
   * first, and `createAuthRuntime`'s dedicated refresh client reads its
   * bearer token from this same session's `getAccessToken()` — no manual
   * header plumbing needed, and no `stapel/no-string-paths` bypass either.
   */
  async function resolveUserAfterTokens(): Promise<StapelUser> {
    return resolveRefreshApi().me();
  }

  async function setTokens(tokens: AuthTokens): Promise<RefreshOutcome> {
    if (state.user !== null) {
      // Known session already — ordinary token rotation (a live 401 retry,
      // or any refresh where the user is already resolved). No need to
      // re-resolve who they are.
      setState({ user: state.user, tokens });
      persist();
      if (state.user.is_anonymous) {
        sessionManager.markAnonymous();
        return "anonymous";
      }
      sessionManager.markAuthenticated();
      return "authenticated";
    }
    // LAYER B (owner incident, 2026-07-20; composes with the bearer-mode
    // `bootstrapProbe` fix in 3747681): tokens with NO known user. Two call
    // sites land here — `doRefresh`'s bootstrap/refresh success branch
    // (`RefreshResponse`/`TokenPairResponse`, api/types.ts, is access+
    // refresh ONLY, never a user) and `QrLogin.tsx`'s `login_request`
    // fulfilment (`onAuthenticated: (tokens) => session.setTokens(tokens)`
    // — the QR `fulfilled` payload is token-only too). LAYER A's
    // `computeStatus` already makes `authenticated && user==null`
    // unrepresentable in `state` itself, but that alone would leave a
    // perfectly good set of tokens stuck "anonymous" forever — this
    // resolves who they belong to before the session can honestly call
    // itself signed in, the same way `adopt()` always has.
    setState({ user: null, tokens }); // held, not yet authenticated — see computeStatus
    try {
      const user = await resolveUserAfterTokens();
      setState({ user, tokens });
      persist();
      if (user.is_anonymous) {
        sessionManager.markAnonymous();
        return "anonymous";
      }
      sessionManager.markAuthenticated();
      return "authenticated";
    } catch (error) {
      if (!isAuthVerdict(error)) {
        // `me()` never reached a verdict (backend down mid-redeploy, 5xx,
        // timeout — see `isAuthVerdict`). The tokens we were just handed are
        // almost certainly fine, so they are KEPT, not thrown away: clearing
        // them here would end a live session over a transient outage, which
        // is the same bug the refresh path above fixes. Reported as
        // `"unavailable"` so the caller doesn't read it as a loss either.
        console.warn(
          "stapel-auth: token refresh succeeded but user resolution could not reach a verdict — keeping the tokens",
          error
        );
        if (sessionManager.getStatus() === "initializing") {
          sessionManager.markUnauthenticated();
        }
        return REFRESH_UNAVAILABLE;
      }
      // The server ANSWERED that these tokens are no good — the
      // failure-handling half of the gate: never leave dangling tokens
      // claiming a session that was never actually confirmed.
      // `settleRefreshFailure` keeps the existing established-vs-never-
      // established distinction, so this never fires a "session expired"
      // banner for a session that hadn't actually started yet. Never throws.
      console.warn(
        "stapel-auth: token refresh succeeded but user resolution was rejected — clearing tokens, settling unauthenticated",
        error
      );
      setState({ user: null, tokens: null });
      persist();
      await settleRefreshFailure("expired");
      return null;
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
   * Explicit logout (owner-diagnosed live incident, 2026-07-17, meettoday
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
    // there and settles via `settleRefreshFailure`. The `probing` flag tells
    // that function this was a SEARCH for a session rather than a check of
    // one, so a negative answer settles quietly and never tears anything
    // down — even if something else (a host's own /me call) marked the
    // manager authenticated while the probe was in flight.
    probing = true;
    try {
      await sessionManager.refresh();
    } finally {
      probing = false;
    }
  }

  async function restore(): Promise<void> {
    const storage = options.storage;
    const stored = storage
      ? ((await storage.get(persistKey)) as
          | { user: StapelUser | null; tokens: AuthTokens | null }
          | undefined)
      : undefined;
    if (stored && (stored.tokens !== null || stored.user !== null)) {
      // Bearer mode: tokens are the session (and — `computeStatus`'s
      // invariant — a user must ALSO be known; a stored token pair with no
      // user is never trusted as authenticated, only ever produced by a
      // pre-fix persisted state). Cookie mode: tokens are never persisted
      // (see `persist`), so a stored user IS the optimistic session — the
      // HTTP-only cookies ride the next request, and a dead cookie pair
      // tears the session down via the refresh seam.
      const authenticated = computeStatus(stored.user, stored.tokens) === "authenticated";
      setState({ user: stored.user, tokens: stored.tokens });
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
