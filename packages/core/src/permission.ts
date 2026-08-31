/**
 * `usePermission` — the four browser capabilities a product asks for, as one
 * state machine instead of four ad-hoc `try { … } catch { }` blocks.
 *
 * Every pair that wants the camera, the microphone, notifications or the
 * user's position hits the same four problems, and until this hook there was
 * nowhere for the answers to live:
 *
 *  1. **"Not yet asked" is not "no".** A product that treats a missing
 *     capability as a failure shows an error to somebody who has simply not
 *     been asked. Three of the five states here (`prompt`, `unknown`,
 *     `unsupported`) are not refusals and must not be rendered as one.
 *  2. **`denied` is terminal.** Once a person (or an enterprise policy) has
 *     refused, the browser will NOT prompt again — calling `getUserMedia`
 *     harder does nothing. A UI that keeps offering the button is lying, and
 *     the only honest move is to say where the switch is and offer the way
 *     that does not need the capability.
 *  3. **The Permissions API is not everywhere.** Safari answers
 *     `navigator.permissions.query({name: "camera"})` with a `TypeError`;
 *     Firefox knows `geolocation` and `notifications` and not the two media
 *     ones. That is `unknown` — "ask and find out" — and it is a different
 *     state from `prompt`, because a UI cannot pre-flight it.
 *  4. **The prompt is a side effect of the capability call.** There is no
 *     "request permission" API for geolocation or media: the prompt appears
 *     because you asked for a position or a stream. So {@link
 *     UsePermissionOptions.requester} exists — a caller that already makes
 *     that call (geo-react's position hook, a recorder's `getUserMedia`)
 *     passes its own, and the browser is asked exactly once instead of twice.
 *  5. **An unanswered prompt never calls back.** The Geolocation spec stops
 *     the `timeout` clock while the permission decision is pending, so a
 *     person who swipes the browser's prompt away instead of answering it
 *     leaves `getCurrentPosition` hanging for as long as the page is open —
 *     neither callback ever fires, `timeout` or no `timeout`. Measured in
 *     Chromium: an ungranted context never settles, while the same call under
 *     a granted permission with no fix available rejects with `code: 3` after
 *     exactly its `timeout`. A hook that just `await`s the requester therefore
 *     hangs, `asking` stays true forever, and every screen built on it is a
 *     dead end. {@link UsePermissionOptions.decisionTimeoutMs} is the bound,
 *     and it is applied ONLY while the Permissions API still says the
 *     question is open — a slow GPS fix after a real "allow" is never cut
 *     short.
 *
 * The hook is headless and lives here, in the framework floor, because a pair
 * with no antd dependency needs it too — the skin half (`PermissionSheet`,
 * `PermissionGate` in `@stapel/tokens-antd/skin`) renders this bag and adds
 * no logic of its own.
 *
 * Nothing here talks to a server, and nothing here is stored: the browser
 * owns the answer, and this hook only reads it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** The capabilities a browser gates behind a prompt. */
export type PermissionKind = "geolocation" | "camera" | "microphone" | "notifications";

/** Every kind, for a UI that iterates them (settings screens, demos). */
export const PERMISSION_KINDS: readonly PermissionKind[] = [
  "geolocation",
  "camera",
  "microphone",
  "notifications",
];

/**
 * Where the capability stands. Five states, because they need five different
 * sentences and four different next actions:
 *
 * - `granted` — use it.
 * - `prompt` — not asked yet. Explain first, then ask.
 * - `denied` — refused, and the browser will not ask again. Say where the
 *   switch is; offer the fallback.
 * - `unknown` — the browser will not say in advance. Offer to ask; the answer
 *   arrives with the attempt.
 * - `unsupported` — the capability does not exist here (an old browser, an
 *   insecure context, a device with no camera). Do not render a disabled
 *   control: render the fallback, or nothing.
 */
export type PermissionStatus =
  | "granted"
  | "prompt"
  | "denied"
  | "unknown"
  | "unsupported";

export interface UsePermissionOptions {
  /**
   * The call that actually triggers the browser's prompt, when the caller
   * already makes it. A recorder passes its own `getUserMedia`; geo-react
   * passes its position request. Resolve for granted, reject for refused —
   * a `GeolocationPositionError` with `code === 1`, a `DOMException` named
   * `NotAllowedError`, or anything else, which is read as `unknown`.
   *
   * Without one, the hook makes the smallest call that provokes the prompt
   * and throws the result away.
   */
  readonly requester?: () => Promise<unknown>;
  /**
   * The DEPLOYMENT's own answer to "should this product ask at all".
   * `false` reports `unsupported` without touching a browser API, so a
   * product can turn an offer off from configuration rather than by hiding
   * a button somewhere in a skin.
   */
  readonly offered?: boolean;
  /**
   * How long to wait for the browser's PROMPT to be answered before giving up
   * on this attempt. Default 20s.
   *
   * It is not a timeout on the capability: it only expires while the
   * Permissions API still reports the question open, so a granted-but-slow GPS
   * fix keeps its own `timeout` and is never cut short by this one. See point
   * 5 of the module doc for why waiting forever is the alternative.
   */
  readonly decisionTimeoutMs?: number;
}

export interface PermissionBag {
  readonly kind: PermissionKind;
  readonly status: PermissionStatus;
  /**
   * Whether a control for this capability should exist at all. `false` for
   * `unsupported` — a disabled button with an explanation is worse than no
   * button, because there is nothing the person can do about it.
   */
  readonly supported: boolean;
  /** The browser's own prompt is open (or the requester is in flight). */
  readonly asking: boolean;
  /**
   * Ask. Triggers the real browser prompt when the status is `prompt` or
   * `unknown`, resolves with the status afterwards, and never rejects — a
   * refusal is a value here, not an exception.
   *
   * It always settles. A prompt nobody answers resolves with the status the
   * Permissions API still reports (`prompt`, usually) once
   * {@link UsePermissionOptions.decisionTimeoutMs} is up, rather than leaving
   * the caller waiting on a promise the browser will never keep.
   */
  readonly request: () => Promise<PermissionStatus>;
  /** Re-read the Permissions API (after a visit to browser settings). */
  readonly refresh: () => void;
}

/** `PermissionName` for the Permissions API, per kind. */
const QUERY_NAME: Readonly<Record<PermissionKind, string>> = {
  geolocation: "geolocation",
  camera: "camera",
  microphone: "microphone",
  notifications: "notifications",
};

function hasNavigator(): boolean {
  return typeof navigator !== "undefined";
}

/** Whether the capability exists in this browser at all. */
export function permissionSupported(kind: PermissionKind): boolean {
  if (!hasNavigator()) return false;
  switch (kind) {
    case "geolocation":
      return typeof navigator.geolocation?.getCurrentPosition === "function";
    case "camera":
    case "microphone":
      return typeof navigator.mediaDevices?.getUserMedia === "function";
    case "notifications":
      return (
        typeof Notification !== "undefined" &&
        typeof Notification.requestPermission === "function"
      );
  }
}

/**
 * The status a browser will state WITHOUT prompting, or `unknown`.
 *
 * Notifications are read off `Notification.permission` rather than the
 * Permissions API: it is synchronous, it is older than the Permissions API,
 * and it is the one kind whose answer is reliably available everywhere.
 */
async function readStatus(kind: PermissionKind): Promise<PermissionStatus> {
  if (!permissionSupported(kind)) return "unsupported";
  if (kind === "notifications") {
    const state = Notification.permission;
    if (state === "granted") return "granted";
    if (state === "denied") return "denied";
    return "prompt";
  }
  const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
  if (permissions === undefined || typeof permissions.query !== "function") return "unknown";
  try {
    const result = await permissions.query({
      name: QUERY_NAME[kind],
    } as unknown as PermissionDescriptor);
    if (result.state === "granted") return "granted";
    if (result.state === "denied") return "denied";
    return "prompt";
  } catch {
    // Safari throws a TypeError for a name it does not implement. That is
    // "ask and find out", not "no".
    return "unknown";
  }
}

/** Turn whatever a refused capability threw into a status. */
function statusOfRejection(reason: unknown): PermissionStatus {
  const error = reason as { code?: number; name?: string } | undefined;
  // GeolocationPositionError.PERMISSION_DENIED — read as a number, because
  // the constants live on the INSTANCE and there is no instance in a browser
  // that ships no geolocation.
  if (error?.code === 1) return "denied";
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "denied";
  // No camera on the device, no microphone plugged in: the capability is not
  // refused, it is absent, and a "you said no" sentence would be wrong.
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "unsupported";
  }
  return "unknown";
}

/**
 * How long an unanswered browser prompt is waited on. See point 5 of the
 * module doc: the alternative is forever.
 */
const DECISION_TIMEOUT_MS = 20_000;

/**
 * Wait for the attempt, but not past the point where the browser has clearly
 * not been answered.
 *
 * `attempt` never rejects — it is already the status of one try. The deadline
 * only decides anything while the Permissions API still says `prompt`
 * (or will not say): if it reports `granted`, the person DID answer and the
 * capability's own timeout is what bounds the wait, so we keep waiting; if it
 * reports `denied`, that is the answer and the attempt will never call back
 * with it.
 */
async function awaitDecision(
  kind: PermissionKind,
  attempt: Promise<PermissionStatus>,
  timeoutMs: number
): Promise<PermissionStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      resolve(undefined);
    }, timeoutMs);
  });
  const raced = await Promise.race([attempt.then((status) => ({ status })), deadline]);
  if (timer !== undefined) clearTimeout(timer);
  if (raced !== undefined) return raced.status;
  const queried = await readStatus(kind);
  if (queried === "denied" || queried === "unsupported") return queried;
  // Granted: the prompt WAS answered and the fix is still being acquired, so
  // the capability's own timeout owns the rest of the wait.
  if (queried === "granted") return await attempt;
  // Nobody answered. The question is still open — which is exactly what
  // `prompt` means, and what a UI must be able to move on from.
  return queried;
}

/** The smallest call that provokes the browser's prompt, per kind. */
function defaultRequester(kind: PermissionKind): () => Promise<unknown> {
  return async () => {
    switch (kind) {
      case "geolocation":
        return await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10_000,
            maximumAge: 120_000,
          });
        });
      case "camera":
      case "microphone": {
        const stream = await navigator.mediaDevices.getUserMedia(
          kind === "camera" ? { video: true } : { audio: true }
        );
        // The prompt was the point; holding the device open is not. A live
        // track leaves the recording indicator on and blocks the hardware
        // for whatever asks next.
        for (const track of stream.getTracks()) track.stop();
        return stream;
      }
      case "notifications": {
        const answer = await Notification.requestPermission();
        if (answer !== "granted") {
          throw Object.assign(new Error("notification permission refused"), {
            name: answer === "denied" ? "NotAllowedError" : "AbortError",
          });
        }
        return answer;
      }
    }
  };
}

/**
 * Track one browser capability. See the module doc for the four problems this
 * exists to hold in one place.
 */
export function usePermission(
  kind: PermissionKind,
  options: UsePermissionOptions = {}
): PermissionBag {
  const offered = options.offered !== false;
  const supported = offered && permissionSupported(kind);
  const [status, setStatus] = useState<PermissionStatus>(
    supported ? "unknown" : "unsupported"
  );
  const [asking, setAsking] = useState(false);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);
  const requester = options.requester;
  const decisionTimeoutMs = options.decisionTimeoutMs ?? DECISION_TIMEOUT_MS;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Read the pre-flight status, and stay subscribed: a person can change the
  // answer in browser settings without reloading the page, and a UI still
  // offering "allow" after they turned it on is the same lie as one still
  // offering it after they turned it off.
  useEffect(() => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    let cancelled = false;
    let subscription: PermissionStatus_ | undefined;
    const onChange = (): void => {
      void readStatus(kind).then((next) => {
        if (!cancelled) setStatus(next);
      });
    };
    void readStatus(kind).then((next) => {
      if (!cancelled) setStatus(next);
    });
    const permissions = hasNavigator()
      ? (navigator as Navigator & { permissions?: Permissions }).permissions
      : undefined;
    if (kind !== "notifications" && permissions?.query !== undefined) {
      void permissions
        .query({ name: QUERY_NAME[kind] } as unknown as PermissionDescriptor)
        .then((result) => {
          if (cancelled) return;
          subscription = result;
          result.addEventListener("change", onChange);
        })
        .catch(() => {
          /* no Permissions API for this name — `unknown` already covers it */
        });
    }
    return () => {
      cancelled = true;
      subscription?.removeEventListener("change", onChange);
    };
  }, [kind, supported, nonce]);

  const refresh = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  const request = useCallback(async (): Promise<PermissionStatus> => {
    if (!supported) return "unsupported";
    setAsking(true);
    const attempt = (async (): Promise<PermissionStatus> => {
      try {
        await (requester ?? defaultRequester(kind))();
        return "granted";
      } catch (reason) {
        return statusOfRejection(reason);
      }
    })();
    // The browser is under no obligation to answer at all (module doc, 5), so
    // this is the one call that must not be a bare `await`.
    let next = await awaitDecision(kind, attempt, decisionTimeoutMs);
    // The attempt is the strongest signal, but the Permissions API knows
    // things it does not — a `timeout` from geolocation says nothing about
    // permission, and the query can still answer `granted`.
    if (next === "unknown") {
      const queried = await readStatus(kind);
      if (queried !== "unknown") next = queried;
    }
    if (alive.current) {
      setAsking(false);
      setStatus(next);
    }
    return next;
  }, [kind, supported, requester, decisionTimeoutMs]);

  return { kind, status, supported, asking, request, refresh };
}

/** The DOM's `PermissionStatus`, named apart from ours. */
type PermissionStatus_ = {
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
};
