/**
 * Shared harness for the realtime demos (frontend-guardrails §4.2). Demos are
 * first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`: colours and dimensions
 * through `@stapel/tokens`, and every user-visible string through an i18n
 * engine, in the unmanaged `demo.*` namespace this package does not ship.
 *
 * The socket is a scripted double: no network, no timers a viewer has to wait
 * on, and the frames are the real wire envelope. A demo of a connection state
 * that fakes the STATE rather than the frames would document nothing.
 *
 * The clock is scripted too. `reconnecting_long` and `never_connected` are
 * defined by elapsed time, and a demo that waited sixty real seconds for one
 * of them would photograph a spinner. So the variants that need a named
 * degradation inject a fixed `now` and the threshold that makes the state
 * arrive with the frame that causes it — the runtime's own injectable clock,
 * used exactly as its tests use it.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { RealtimeProvider } from "../src/react/index.js";
import type { RealtimeDegradationThresholds, RealtimeSocket, RealtimeSocketFactory } from "../src/index.js";
import { DeveloperDetails, LiveBadge } from "./LiveBadge.js";

/** The stream key the demos watch — a real one, in the canonical shape. */
export const DEMO_STREAM = "chat:conv:7ad1c0de";

/**
 * A fixed wall clock for the timed degradations: 14:02 UTC.
 *
 * Two builds of the same story must produce the same picture, and "since
 * 14:02" read off `Date.now()` would make the badge differ on every run — the
 * one thing a screenshot review cannot tell apart from a regression.
 */
export const DEMO_CLOCK = Date.UTC(2026, 7, 24, 14, 2, 0);

/**
 * Demo-local copy, in the unmanaged `demo.*` namespace (the pattern
 * `shell-react`'s harness established) so `i18n-key-exists` reads it as
 * app-local rather than as a typo against a catalogue this package has none
 * of. Every sentence here is the one a PAIR would ship: what is true for the
 * reader, never what the client is doing about it.
 */
const demoBundleEn: Record<string, string> = {
  "demo.realtime.badge.live.title": "Live",
  "demo.realtime.badge.live.body":
    "New messages appear here the moment they are sent.",

  "demo.realtime.badge.connecting.title": "Connecting…",
  "demo.realtime.badge.connecting.body":
    "Opening the live connection. Anything already loaded stays on screen.",

  "demo.realtime.badge.resync.title": "Catching up",
  "demo.realtime.badge.resync.body":
    "You were away longer than the history we keep ready, so the conversation is being reloaded in full.",

  "demo.realtime.badge.reconnecting.title": "Live updates stopped",
  "demo.realtime.badge.reconnecting.body":
    "Trying to reconnect. You are seeing the messages we already had.",

  "demo.realtime.badge.reconnecting-long.title": "Live updates stopped",
  "demo.realtime.badge.reconnecting-long.body":
    "Reconnecting since {since} — showing the messages we already had.",

  "demo.realtime.badge.never-connected.title": "Live updates unavailable",
  "demo.realtime.badge.never-connected.body":
    "This page has never managed to open a live connection, so you are seeing cached data. An administrator may need to check how the site is deployed.",

  "demo.realtime.badge.refused-revoked.title": "Live updates ended",
  "demo.realtime.badge.refused-revoked.body":
    "Your access to this conversation was withdrawn.",

  "demo.realtime.badge.refused-forbidden.title": "Live updates ended",
  "demo.realtime.badge.refused-forbidden.body":
    "You are not allowed to follow this conversation.",

  "demo.realtime.badge.refused-session.title": "Live updates paused",
  "demo.realtime.badge.refused-session.body":
    "Your sign-in expired while this page was open.",

  "demo.realtime.badge.refused-origin.title": "Live updates unavailable",
  "demo.realtime.badge.refused-origin.body":
    "This site is not on the server's list of addresses allowed to open a live connection. An administrator has to add it.",

  "demo.realtime.badge.refused-stream-unknown.title": "Live updates ended",
  "demo.realtime.badge.refused-stream-unknown.body":
    "This conversation no longer exists.",

  "demo.realtime.badge.refused-unsupported.title": "Live updates unavailable",
  "demo.realtime.badge.refused-unsupported.body":
    "This browser cannot keep a live connection open.",

  "demo.realtime.badge.refused-ended.title": "Live updates ended",
  "demo.realtime.badge.refused-ended.body":
    "The server closed the live connection without giving a reason we can show.",

  "demo.realtime.badge.off.title": "Live updates are off",
  "demo.realtime.badge.off.body": "Nothing on this screen is being watched.",

  "demo.realtime.badge.no-provider.title": "Live updates are not set up",
  "demo.realtime.badge.no-provider.body":
    "This screen was rendered without a live connection, so nothing here refreshes on its own.",

  "demo.realtime.action.reconnect": "Reconnect",
  "demo.realtime.action.futile": "Reconnecting will not restore it.",
  "demo.realtime.developer.summary": "Developer details",
};

/** One scripted step: a frame the server sends, a close code it sends, or a
 * handshake that is answered with a close and never opens at all. */
export type ServerStep =
  | { readonly frame: Record<string, unknown> }
  | { readonly close: number }
  | { readonly failHandshake: number };

/** The wire frames the scripts below are built from. */
export const WELCOME: ServerStep = {
  frame: { v: 1, type: "welcome", stream: DEMO_STREAM, payload: { server_seq: 2 } },
};
export const REPLAY_1: ServerStep = {
  frame: {
    v: 1,
    type: "replay",
    stream: DEMO_STREAM,
    payload: { message_id: "a", body: "…", seq: 1 },
    seq: 1,
  },
};
export const REPLAY_2: ServerStep = {
  frame: {
    v: 1,
    type: "replay",
    stream: DEMO_STREAM,
    payload: { message_id: "b", body: "…", seq: 2 },
    seq: 2,
  },
};
export const REPLAY_DONE: ServerStep = {
  frame: { v: 1, type: "replay_done", stream: DEMO_STREAM, payload: { up_to_seq: 2 } },
};
export const KICK: ServerStep = {
  frame: {
    v: 1,
    type: "kick",
    stream: DEMO_STREAM,
    payload: { reason: "removed_from_conversation" },
  },
};
export const RESYNC: ServerStep = {
  frame: {
    v: 1,
    type: "resync",
    stream: DEMO_STREAM,
    payload: { gap: 1200, window: 500, server_seq: 1202 },
  },
};
export const DROP: ServerStep = { close: 1006 };
export const REVOKE: ServerStep = { close: 4410 };
/** The handshake that is never answered — an ingress that does not upgrade,
 * a firewall that swallows it. Nothing opens, so nothing can be resumed. */
export const NEVER_OPENS: ServerStep = { failHandshake: 1006 };

/** Build a transport that replays `script` as soon as the socket opens. */
function scriptedTransport(script: readonly ServerStep[]): RealtimeSocketFactory {
  let played = false;
  return (_url, handlers) => {
    const socket: RealtimeSocket = {
      send: () => undefined,
      close: () => undefined,
    };
    if (!played) {
      played = true;
      const first = script[0];
      const opens = first === undefined || !("failHandshake" in first);
      queueMicrotask(() => {
        if (opens) handlers.onOpen();
        for (const step of script) {
          if ("frame" in step) handlers.onData(JSON.stringify(step.frame));
          else if ("close" in step) handlers.onClose(step.close, "");
          else handlers.onClose(step.failHandshake, "");
        }
      });
    }
    return socket;
  };
}

const board: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing["4"],
};

/** What every variant renders: the badge, and the wire under a disclosure. */
export function ConnectionSurface(): ReactElement {
  return (
    <div style={board}>
      <LiveBadge stream={DEMO_STREAM} />
      <DeveloperDetails stream={DEMO_STREAM} />
    </div>
  );
}

/**
 * Mount the surface over a scripted socket. `key`-ed on the script so each
 * variant gets a fresh client rather than one that already ran.
 */
export function RealtimeDemoHarness(props: {
  script: readonly ServerStep[];
  /** Thresholds that make a named degradation arrive with its frame. */
  degradation?: RealtimeDegradationThresholds;
  children?: ReactNode;
}): ReactElement {
  const factory = useMemo(() => scriptedTransport(props.script), [props.script]);
  const i18n = useMemo(() => createI18n({ locale: "en", bundles: { en: demoBundleEn } }), []);
  return (
    <I18nProvider i18n={i18n}>
      <RealtimeProvider
        url="wss://demo.stapel.dev/ws/chat/7ad1c0de"
        webSocket={factory}
        session={null}
        now={() => DEMO_CLOCK}
        {...(props.degradation === undefined ? {} : { degradation: props.degradation })}
      >
        {props.children ?? <ConnectionSurface />}
      </RealtimeProvider>
    </I18nProvider>
  );
}
