/**
 * Shared harness for the realtime demos (frontend-guardrails §4.2). Demos are
 * first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`: colours through
 * `cssVar()`, no prose literals (every label here is a machine name rendered
 * from data, exactly as the tokens palette demo renders token names), and the
 * one button carries `data-analytics="none"` with an honest reason.
 *
 * The socket is a scripted double: no network, no timers a viewer has to wait
 * on, and the frames are the real wire envelope. A demo of a connection state
 * that fakes the STATE rather than the frames would document nothing.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { RealtimeProvider, useRealtimeState, useStream } from "../src/react/index.js";
import type { RealtimeSocket, RealtimeSocketFactory } from "../src/index.js";

/** The stream key the demos watch — a real one, in the canonical shape. */
export const DEMO_STREAM = "chat:conv:7ad1c0de";

/** One scripted step: a frame the server sends, or a close code it sends. */
export type ServerStep =
  | { readonly frame: Record<string, unknown> }
  | { readonly close: number };

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

/** Build a transport that replays `script` as soon as the socket opens. */
function scriptedTransport(script: readonly ServerStep[]): RealtimeSocketFactory {
  let opened = false;
  return (_url, handlers) => {
    const socket: RealtimeSocket = {
      send: () => undefined,
      close: () => undefined,
    };
    if (!opened) {
      opened = true;
      queueMicrotask(() => {
        handlers.onOpen();
        for (const step of script) {
          if ("frame" in step) handlers.onData(JSON.stringify(step.frame));
          else handlers.onClose(step.close, "");
        }
      });
    }
    return socket;
  };
}

const frame: CSSProperties = {
  background: cssVar("surface"),
  color: cssVar("text"),
  padding: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["4"],
  fontSize: fontSize.sm.fontSize,
  borderRadius: radii.md,
};

const row: CSSProperties = {
  display: "flex",
  gap: spacing["2"],
  flexWrap: "wrap",
  alignItems: "center",
};

const chip: CSSProperties = {
  border: `1px solid ${cssVar("border-subtle")}`,
  borderRadius: radii.sm,
  padding: `${spacing["1"]} ${spacing["2"]}`,
  color: cssVar("text-muted"),
  wordBreak: "break-all",
};

/** A `name: value` pair. Both halves are data — no prose lives in this file. */
export function Field(props: { name: string; value: string }): ReactElement {
  return (
    <span style={chip}>
      <code>{props.name}</code>
      <code>{": "}</code>
      <strong style={{ color: cssVar("text") }}>{props.value}</strong>
    </span>
  );
}

/** The board every variant renders: stream status beside connection status. */
export function StatusBoard(): ReactElement {
  const stream = useStream(DEMO_STREAM);
  const connection = useRealtimeState();
  const cursors = Object.entries(connection.cursors);
  return (
    <div style={frame}>
      <div style={row}>
        <Field name="stream.state" value={stream.status.state} />
        <Field name="stream.refusal" value={stream.status.refusal ?? "—"} />
        <Field name="stream.reason" value={stream.status.reason ?? "—"} />
        <Field name="stream.attempt" value={String(stream.status.attempt)} />
        <Field name="stream.gap" value={String(stream.status.gap ?? "—")} />
      </div>
      <div style={row}>
        <Field name="connection.state" value={connection.state} />
        <Field name="connection.connected" value={String(connection.connected)} />
        <Field name="connection.reconnecting" value={String(connection.reconnecting)} />
        <Field name="connection.refused" value={String(connection.refused)} />
      </div>
      <div style={row}>
        {cursors.length === 0 ? (
          <Field name="cursors" value="—" />
        ) : (
          cursors.map(([key, cursor]) => (
            <Field key={key} name={key} value={String(cursor)} />
          ))
        )}
      </div>
      <div style={row}>
        <button
          type="button"
          style={{ ...chip, background: cssVar("surface-raised"), cursor: "pointer" }}
          onClick={stream.reconnect}
          data-analytics="none"
          data-analytics-reason="demo-only control: the scripted transport has no server to reconnect to"
        >
          <code>{"reconnect()"}</code>
        </button>
      </div>
    </div>
  );
}

/**
 * Mount the board over a scripted socket. `key`-ed on the script so each
 * variant gets a fresh client rather than one that already ran.
 */
export function RealtimeDemoHarness(props: {
  script: readonly ServerStep[];
  children?: ReactNode;
}): ReactElement {
  const factory = useMemo(() => scriptedTransport(props.script), [props.script]);
  return (
    <RealtimeProvider
      url="wss://demo.stapel.dev/ws/chat/7ad1c0de"
      webSocket={factory}
      session={null}
    >
      {props.children ?? <StatusBoard />}
    </RealtimeProvider>
  );
}
