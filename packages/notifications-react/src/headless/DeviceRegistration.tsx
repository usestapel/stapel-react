/**
 * `<DeviceRegistration/>` — "is push on for THIS device?", answered by the
 * server.
 *
 * ── What was wrong, and why it was not a polish item ──────────────────────
 *
 * Until stapel-notifications 0.17.0 the device registry was write-only: a
 * client could POST a token and DELETE a token, and nothing could ask what was
 * registered. So this pair's toggle held a `useState(false)`, which meant:
 *
 *   - on every mount the switch rendered OFF whether or not this device was
 *     receiving push, and
 *   - after a reload it held no token, so turning the switch OFF sent **no
 *     request at all** while telling the person push was disabled. The server
 *     kept sending.
 *
 * `GET /devices/` closes it, and the shape below is built so the old bug
 * cannot be re-introduced: there is no boolean to set. {@link PushState} is
 * DERIVED — from the device list, from this device's fingerprint, and from
 * whether the browser would even give us a token. A write cannot move it; only
 * the invalidated read can.
 *
 * ── Finding THIS device in a list that never echoes tokens ────────────────
 *
 * The raw token is a bearer credential for one device's push channel, so the
 * list carries `token_fingerprint` (SHA-256 hex) instead. The client hashes
 * the token it already holds and matches. `currentToken()` is the seam for
 * "the token this device already holds, WITHOUT prompting" — a
 * `PushSubscription` a service worker already has, an FCM token cached by a
 * native bridge. It is optional, and a host that omits it gets the honest
 * `"unknown"` state rather than a switch drawn from a guess.
 *
 * ── The three ways this can fail, told apart ──────────────────────────────
 *
 * `denied` (the permission prompt was refused), `unsupported` (no Web Crypto —
 * an insecure origin — or the host reporting no push support at all), and an
 * ordinary API failure. Each has its own sentence beside the control. The one
 * outcome that is not allowed is the old one: a rejected promise swallowed by
 * `void handleChange(next)`, a switch that springs back, and no message.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { DeviceListItem, DeviceTokenResponse, Platform } from "../api/types.js";
import {
  useRegisterDevice,
  useUnregisterDevice,
  useUnregisterDeviceById,
} from "../model/mutations.js";
import { useDevices } from "../model/queries.js";
import { canFingerprint, tokenFingerprint } from "../model/fingerprint.js";

/**
 * What the push switch is allowed to say. Every arm is a state the SERVER (or
 * the browser) put us in — none of them is a local flag.
 */
export type PushState =
  /** Reading `GET /devices/`. */
  | "loading"
  /** The read failed — the switch must not claim either position. */
  | "failed"
  /** Push cannot work here at all (no Web Crypto / the host says unsupported). */
  | "unsupported"
  /** The browser refused the permission prompt. */
  | "denied"
  /** The list was read, but this device holds no token we can match against
   * it — so we know what the ACCOUNT has and not what THIS device has. */
  | "unknown"
  /** This device is registered and being delivered to. */
  | "on"
  /** Registered, but the push provider rejected the token: it receives
   * nothing. Registered-and-silent is not "on". */
  | "inactive"
  /** This device is not registered. */
  | "off";

/** Why the toggle cannot act, when the reason is not an API error. */
export type PushBlockedReason = "denied" | "unsupported" | "token_unavailable";

/** Render-prop bag for {@link DeviceRegistration}. */
export interface DeviceRegistrationBag {
  /** The one state a skin renders. Derived; never assigned. */
  readonly state: PushState;
  /** The account's registered devices, as a load state a skin cannot
   * flatten — "no devices" and "could not ask" are different screens. */
  readonly devices: LoadState<readonly DeviceListItem[]>;
  /** This device's row, when its fingerprint matched one. */
  readonly thisDevice: DeviceListItem | null;
  /** A write is in flight (register / unregister / remove). */
  readonly busy: boolean;
  /** Obtain a token (this MAY prompt) and register it. No-op without
   * `getToken`. */
  enable(): void;
  /** Unregister THIS device — by row id when the list gave one, else by the
   * token this session minted. Never a silent no-op: when neither is
   * available the state is `"unknown"` and a skin must not offer the action. */
  disable(): void;
  /** Unregister any listed device by the id the list handed out. */
  remove(deviceId: number): void;
  /** A non-API refusal with its own sentence, else null. */
  readonly blocked: PushBlockedReason | null;
  /** The last API failure from either mutation (a localizable
   * `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Re-read the device list. */
  refetch(): void;
  /** Clear the mutations' and the block's state. */
  reset(): void;

  // ── low-level seam (unchanged) ────────────────────────────────────────────
  /** Register (or re-bind) a push token for the current user. */
  register(token: string, platform: Platform): void;
  /** Unregister a push token by value. */
  unregister(token: string): void;
  /** A register call is in flight. */
  readonly isRegistering: boolean;
  /** An unregister call is in flight. */
  readonly isUnregistering: boolean;
  /** The last successful registration echoed by the server, else null. */
  readonly registered: DeviceTokenResponse | null;
  /** Either mutation failed. */
  readonly isError: boolean;
}

export interface DeviceRegistrationProps {
  /**
   * Obtain a push token for this device — VAPID/APNs/FCM wiring is a host
   * concern, not a headless module's. MAY prompt: it is called only from
   * {@link DeviceRegistrationBag.enable}, which is a deliberate user action.
   */
  getToken?: () => Promise<string>;
  /**
   * The token this device ALREADY holds, or `null` when it holds none. Must
   * not prompt — it is called on mount, and a permission dialog nobody asked
   * for is worse than an unknown switch. Omit it and the bag reports
   * `"unknown"` after a reload instead of guessing.
   */
  currentToken?: () => Promise<string | null>;
  /** Device platform sent with the registration. Default `"web"`. */
  platform?: Platform;
  /** Set `false` where the host knows push cannot work (no service worker, an
   * embedded webview) — the bag then reports `"unsupported"` and the skin says
   * so instead of offering a control that cannot succeed. */
  supported?: boolean;
  children: (bag: DeviceRegistrationBag) => ReactNode;
}

/** `DOMException: NotAllowedError` is what a refused permission prompt throws
 * in every browser that implements the Push API; anything else is a token we
 * could not obtain for some other reason, and it gets its own sentence. */
function classifyTokenFailure(thrown: unknown): PushBlockedReason {
  if (
    typeof thrown === "object" &&
    thrown !== null &&
    "name" in thrown &&
    (thrown as { name?: unknown }).name === "NotAllowedError"
  ) {
    return "denied";
  }
  return "token_unavailable";
}

/**
 * Headless push-token registration. Hands a {@link DeviceRegistrationBag} to
 * `children`; bring your own switch. Zero visual opinion (frontend-standard
 * §2).
 *
 * ```tsx
 * <DeviceRegistration getToken={mintToken} currentToken={readSubscription}>
 *   {({ state, enable, disable, busy }) => ( ... )}
 * </DeviceRegistration>
 * ```
 */
export function DeviceRegistration(props: DeviceRegistrationProps): ReactNode {
  const { getToken, currentToken, supported = true } = props;
  const platform = props.platform ?? "web";

  const devicesQuery = useDevices();
  const registerMutation = useRegisterDevice();
  const unregisterMutation = useUnregisterDevice();
  const removeMutation = useUnregisterDeviceById();

  // The token this device holds, once something has produced one — either
  // `currentToken()` on mount or `getToken()` on enable. `undefined` means "we
  // have not been told"; that is the `unknown` arm, not `off`.
  const [token, setToken] = useState<string | undefined>(undefined);
  const [fingerprint, setFingerprint] = useState<string | undefined>(undefined);
  const [blocked, setBlocked] = useState<PushBlockedReason | null>(
    supported && canFingerprint() ? null : "unsupported"
  );

  // `currentToken` is usually an inline arrow, so it is read through a ref:
  // depending on its identity would re-run the read on every render of the
  // host, which for a native bridge is a real round trip per keystroke.
  const readCurrent = useRef(currentToken);
  readCurrent.current = currentToken;

  useEffect(() => {
    const read = readCurrent.current;
    if (read === undefined) return undefined;
    let live = true;
    read().then(
      (held) => {
        if (!live) return;
        // `null` is an answer: this device holds no token, so it is OFF. It is
        // recorded as the empty string rather than left `undefined`, which
        // would be indistinguishable from "never asked".
        setToken(held ?? "");
      },
      (thrown: unknown) => {
        if (!live) return;
        setBlocked(classifyTokenFailure(thrown));
      }
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (token === undefined || token === "") {
      setFingerprint(undefined);
      return undefined;
    }
    let live = true;
    tokenFingerprint(token).then(
      (hex) => {
        if (live) setFingerprint(hex);
      },
      () => {
        if (live) setBlocked("unsupported");
      }
    );
    return () => {
      live = false;
    };
  }, [token]);

  const devices = loadStateFromQuery(devicesQuery);
  const rows = devices.status === "ready" ? devices.data : undefined;
  const thisDevice =
    rows !== undefined && fingerprint !== undefined
      ? (rows.find((row) => row.token_fingerprint === fingerprint) ?? null)
      : null;

  const enable = useCallback((): void => {
    if (getToken === undefined) return;
    setBlocked(null);
    getToken().then(
      (fresh) => {
        setToken(fresh);
        // No optimistic flip. The switch's position comes from the devices
        // read, which this mutation invalidates on success — so a registration
        // that FAILS leaves the switch where it was instead of showing ON with
        // an error underneath it.
        registerMutation.mutate({ token: fresh, platform });
      },
      (thrown: unknown) => {
        setBlocked(classifyTokenFailure(thrown));
      }
    );
  }, [getToken, platform, registerMutation]);

  const disable = useCallback((): void => {
    setBlocked(null);
    if (thisDevice !== null) {
      removeMutation.mutate(thisDevice.id);
      return;
    }
    if (token !== undefined && token !== "") {
      unregisterMutation.mutate(token);
      return;
    }
    // Neither road exists, so there is nothing honest to do. The bag is in
    // `unknown` and a skin gates the control with that reason — the one thing
    // it must never do is what the old skin did: flip the UI off, send
    // nothing, and let the server keep delivering.
    setBlocked("token_unavailable");
  }, [thisDevice, token, removeMutation, unregisterMutation]);

  const remove = useCallback(
    (deviceId: number): void => {
      removeMutation.mutate(deviceId);
    },
    [removeMutation]
  );

  const busy =
    registerMutation.isPending ||
    unregisterMutation.isPending ||
    removeMutation.isPending;

  const state: PushState = ((): PushState => {
    if (blocked === "unsupported") return "unsupported";
    if (blocked === "denied") return "denied";
    if (devices.status === "loading") return "loading";
    if (devices.status === "failed") return "failed";
    if (thisDevice !== null) return thisDevice.is_active ? "on" : "inactive";
    // A token we HAVE and could fingerprint, with no matching row, is a
    // genuine "off". A token we were never given is "unknown".
    if (token === "" || fingerprint !== undefined) return "off";
    return "unknown";
  })();

  return props.children({
    state,
    devices,
    thisDevice,
    busy,
    enable,
    disable,
    remove,
    blocked,
    error:
      registerMutation.error ??
      unregisterMutation.error ??
      removeMutation.error ??
      null,
    refetch: () => {
      void devicesQuery.refetch();
    },
    reset: () => {
      registerMutation.reset();
      unregisterMutation.reset();
      removeMutation.reset();
      setBlocked(supported && canFingerprint() ? null : "unsupported");
    },
    register: (value, devicePlatform) => {
      registerMutation.mutate({ token: value, platform: devicePlatform });
    },
    unregister: (value) => {
      unregisterMutation.mutate(value);
    },
    isRegistering: registerMutation.isPending,
    isUnregistering: unregisterMutation.isPending || removeMutation.isPending,
    registered: registerMutation.data ?? null,
    isError:
      registerMutation.isError ||
      unregisterMutation.isError ||
      removeMutation.isError,
  });
}
