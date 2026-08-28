/**
 * Auto-anonymous: minting a guest account at the moment of an act, silently.
 *
 * `POST /anonymous/` has existed on the server since the beginning and
 * `createAnonymousFlow` has driven it from a button. This is the same call
 * with no button: the implementation of `@stapel/core`'s
 * {@link ElevationSource}, so a gated control can elevate an anonymous
 * visitor instead of refusing them.
 *
 * WHY THAT IS A DIFFERENT THING FROM THE GUEST BUTTON. A "continue as guest"
 * control asks a stranger to choose a tier they have no way to evaluate, and
 * on a marketplace there is no tier to choose — a signed-in guest and a
 * signed-out visitor see the same catalogue. What the person actually wants
 * is to save a listing. So the account is minted by the save, and the person
 * is never asked about it.
 *
 * ── The four things that make it safe ─────────────────────────────────────
 *
 *  1. **Never on render.** Nothing here runs on mount. `elevate()` is
 *     reachable only through `Elevation.run`, which a control calls from a
 *     handler. Minting on page load would create a row for every crawler.
 *  2. **One account per visitor.** Three guards, in order: an identity the
 *     session already holds short-circuits before any request; concurrent
 *     calls share one in-flight promise; and a `device_id` persisted across
 *     reloads lets the server return the SAME guest rather than a second one
 *     (`anon_device:<id>`, server-side).
 *  3. **A failure is not a silent no-op.** `elevate()` rejects, `run` keeps
 *     the failure, and the write that was waiting on it never goes out — a
 *     write with no session buys a 401 nobody can read.
 *  4. **The axis is not here.** WHICH actions may mint is
 *     {@link AnonymousElevationOptions.actions}, resolved by the host from
 *     its own config. This module mints; it does not decide who deserves it.
 *
 * ── What the seller sees ──────────────────────────────────────────────────
 *
 * The account the server mints is named `anon_<8 hex>` and carries no
 * profile. A seller reading a message from one must not be shown a blank, so
 * the host's display layer is responsible for a stated placeholder; this
 * module's part of that contract is only that the identity is real and
 * durable — a row, an id, a session that survives a reload — rather than a
 * ghost the seller cannot reply to.
 */
import type { ElevationSource, PersistStorage } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthSession } from "./session.js";

/** Default persist key for the guest device id. */
export const ANONYMOUS_DEVICE_ID_KEY = "stapel-auth:anon-device";

export interface AnonymousElevationOptions {
  readonly api: AuthApi | (() => AuthApi);
  readonly session: AuthSession;
  /**
   * The actions this deployment permits an automatic mint for — the axis.
   * An empty list is a working configuration: the source is inert and every
   * gated control refuses exactly as it did before.
   */
  readonly actions: readonly string[];
  /**
   * Where the `device_id` is kept between reloads. Omit it and the id lives
   * for the page's lifetime only, which still collapses repeat clicks but
   * lets a reload mint a second guest.
   */
  readonly storage?: PersistStorage;
  readonly deviceIdKey?: string;
}

/**
 * The shape the server will accept. stapel-auth refuses a `device_id` under
 * 16 characters or outside `[A-Za-z0-9-._~:+/=]` (`error.400.device_id_weak`)
 * — the id is a dedup handle the server hands a session back for, so a
 * guessable one is a session anybody can claim. Pinned here as a constant
 * because the two halves have to agree and a silent 400 on the mint would
 * read to a visitor as "the heart does nothing".
 */
const DEVICE_ID_MIN_LENGTH = 16;

function makeDeviceId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === "function") return c.randomUUID();
  // Non-secure fallback for environments without WebCrypto. Built by
  // ACCUMULATION rather than by slicing one `Math.random()`, so its length is
  // guaranteed rather than typical: `toString(36)` can return a short string,
  // and an id that is occasionally 15 characters would fail the server's
  // floor for a fraction of visitors and nowhere else.
  let id = `dev-${Date.now().toString(36)}`;
  while (id.length < DEVICE_ID_MIN_LENGTH + 8) {
    id += `-${Math.random().toString(36).slice(2)}`;
  }
  return id;
}

/**
 * Build the {@link ElevationSource} a host hands to core's
 * `<ElevationProvider>`.
 */
export function createAnonymousElevation(
  options: AnonymousElevationOptions
): ElevationSource {
  const { session, actions, storage } = options;
  const deviceIdKey = options.deviceIdKey ?? ANONYMOUS_DEVICE_ID_KEY;
  const resolveApi = (): AuthApi =>
    typeof options.api === "function" ? options.api() : options.api;

  /** The one in-flight mint, shared by every concurrent caller. */
  let flight: Promise<void> | null = null;
  /** Held in memory too, so a mint works with no storage wired. */
  let deviceId: string | null = null;

  /** Does this visitor already have an identity of any kind? */
  function hasIdentity(): boolean {
    const status = session.getSessionManager().getStatus();
    return status === "authenticated" || status === "anonymous";
  }

  async function readDeviceId(): Promise<string> {
    if (deviceId !== null) return deviceId;
    if (storage !== undefined) {
      const stored = await storage.get(deviceIdKey);
      if (typeof stored === "string" && stored.length > 0) {
        deviceId = stored;
        return stored;
      }
    }
    const minted = makeDeviceId();
    deviceId = minted;
    if (storage !== undefined) await storage.set(deviceIdKey, minted);
    return minted;
  }

  async function mint(): Promise<void> {
    const id = await readDeviceId();
    const response = await resolveApi().anonymous(id);
    session.adopt(response);
  }

  function elevate(): Promise<void> {
    // Guard 1: an identity already in hand costs nothing and asks nobody.
    if (hasIdentity()) return Promise.resolve();
    // Guard 2: the second click of a double-tap joins the first one's mint.
    if (flight !== null) return flight;
    // The flight is cleared on settle, not kept: a mint that FAILED (a 429
    // from the per-IP budget, an outage) must be retryable on the next
    // press, and a mint that succeeded is short-circuited by guard 1
    // anyway.
    const started = mint().finally(() => {
      if (flight === started) flight = null;
    });
    flight = started;
    return started;
  }

  // `hasIdentity` is the READ side of the seam: a surface that only shows
  // what the guest already made must not mint to render it. See core's
  // `ElevationSource.hasIdentity`.
  return { actions, elevate, hasIdentity };
}
