/**
 * `<LiveBadge/>` — the connection surface this package's README prescribes,
 * built as a component so the demo shows what a PAIR renders rather than what
 * the runtime returns.
 *
 * ── Why it lives in `demo/` and not in `src/` ─────────────────────────────
 *
 * A badge is copy plus a skin, and this package has neither on purpose. There
 * is no i18n catalogue here (the runtime renders no text at all), no design
 * system, and two size budgets — 9 KB for the socket runtime, 5 KB for the
 * React surface — that exist precisely so a pair which never opens a socket
 * pays nothing. Moving fifteen sentences and a button into the runtime would
 * hand the fleet a copy deck it cannot translate and a skin it cannot theme.
 *
 * So the split is: the RUNTIME hands out the facts — `degradation.kind`,
 * `status.refusal`, `degradation.since` — and this file is the reference
 * rendering of them. Copy it into your pair, point `t()` at your own keys.
 *
 * ── The three rules it obeys, all of them the README's ────────────────────
 *
 *  1. The three degradations are three different sentences, never one
 *     spinner. `never_connected` sends an operator to a deployment setting;
 *     `reconnecting_long` tells a reader that waiting is reasonable;
 *     `refused` is a verdict and waiting is not.
 *  2. The reason is rendered BESIDE the control, never in a tooltip — a
 *     reason nobody hovers is a reason nobody reads.
 *  3. Where retrying cannot help there is NO Reconnect button, and the line
 *     that takes its place says so. A button that hammers a host and changes
 *     nothing is worse than no button.
 *
 * Nothing machine-shaped reaches the glass: no stream key, no `refusal` enum,
 * no field path. Those are facts a DEVELOPER needs, and they are exactly one
 * disclosure away, in `<DeveloperDetails/>` below.
 */
import type { CSSProperties, ReactElement } from "react";
import { useT } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import type { RealtimeRefusal, RealtimeState, RealtimeStreamStatus } from "../src/index.js";
import { useRealtimeState, useStream } from "../src/react/index.js";
import type { NoProviderStatus } from "../src/react/index.js";

/** The four tones the badge speaks in. Each is a token family, not a colour. */
type Tone = "success" | "info" | "warning" | "error";

/**
 * What the badge offers to do about the state it is showing.
 *
 * `futile` is a state of its own rather than the absence of `offer`: the
 * difference between "there is nothing to retry because it is working" and
 * "retrying will not change this verdict" is the whole reason a person stops
 * clicking, and only one of the two needs a sentence.
 */
type Retry = "offer" | "futile" | "none";

interface BadgeState {
  /** Copy key suffix, and the `data-stapel-live-state` a test reads. */
  readonly id: string;
  readonly tone: Tone;
  readonly retry: Retry;
  /** When this state began, for the "since 14:02" half of the sentence. */
  readonly since: number | undefined;
}

/**
 * Which refusals a Reconnect button can do anything about.
 *
 * Only an expired session can: everything else is a verdict about the
 * deployment, the stream or the person, and the runtime's own close-code table
 * calls 4403/4404/4410 terminal for the same reason. A badge that offers a
 * retry on a terminal refusal turns a person into the load generator for a
 * host that has already said no.
 */
const REFUSALS: Record<RealtimeRefusal, { readonly id: string; readonly retry: Retry }> = {
  session: { id: "session", retry: "offer" },
  origin: { id: "origin", retry: "futile" },
  forbidden: { id: "forbidden", retry: "futile" },
  stream_unknown: { id: "stream-unknown", retry: "futile" },
  revoked: { id: "revoked", retry: "futile" },
  unsupported: { id: "unsupported", retry: "futile" },
};

/**
 * The badge's whole decision, in one place.
 *
 * Order matters and is the README's: a verdict outranks a degradation, a
 * NAMED degradation outranks the raw stream state, and only then does the
 * per-stream state get to speak. Read the other way round, a refusal would be
 * painted as a reconnect for as long as anyone kept the tab open.
 */
function describe(
  status: RealtimeStreamStatus | NoProviderStatus,
  state: RealtimeState
): BadgeState {
  if (status.state === "no_provider") {
    return { id: "no-provider", tone: "info", retry: "none", since: undefined };
  }
  const degradation = state.degradation;
  if (status.state === "refused" || degradation?.kind === "refused") {
    const refusal = status.refusal ?? state.refusal;
    const entry =
      refusal === undefined ? { id: "ended", retry: "futile" as Retry } : REFUSALS[refusal];
    return {
      id: `refused-${entry.id}`,
      tone: "error",
      retry: entry.retry,
      since: degradation?.since,
    };
  }
  if (degradation?.kind === "never_connected") {
    return {
      id: "never-connected",
      tone: "warning",
      retry: "offer",
      since: degradation.since,
    };
  }
  if (degradation?.kind === "reconnecting_long") {
    return {
      id: "reconnecting-long",
      tone: "warning",
      retry: "offer",
      since: degradation.since,
    };
  }
  switch (status.state) {
    case "live":
      return { id: "live", tone: "success", retry: "none", since: undefined };
    case "connecting":
    case "replaying":
      return { id: "connecting", tone: "info", retry: "none", since: undefined };
    case "resync":
      return { id: "resync", tone: "info", retry: "none", since: undefined };
    case "reconnecting":
      return { id: "reconnecting", tone: "warning", retry: "offer", since: undefined };
    default:
      return { id: "off", tone: "info", retry: "none", since: undefined };
  }
}

/**
 * The clock the sentence is stamped with.
 *
 * Pinned to UTC HERE and only here, because this component is photographed by
 * a screenshot runner whose timezone is not the reader's and must not be what
 * makes two builds differ. A pair drops the `timeZone` and gets the reader's
 * own clock, which is what "since 14:02" is supposed to mean.
 */
const CLOCK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const card: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing["2"],
  padding: spacing["4"],
  borderRadius: radii.lg,
  borderWidth: 1,
  borderStyle: "solid",
  color: cssVar("text"),
  // Mobile first: the badge is a full-width block at 390 and stops growing
  // long before a line of its copy becomes unreadable on a desktop.
  maxWidth: "32rem",
};

const headline: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing["2"],
  fontSize: fontSize.md.fontSize,
  lineHeight: `${String(fontSize.md.lineHeight)}px`,
  fontWeight: 600,
};

const sentence: CSSProperties = {
  margin: 0,
  fontSize: fontSize.sm.fontSize,
  lineHeight: `${String(fontSize.sm.lineHeight)}px`,
  color: cssVar("text"),
};

/**
 * The action row. The reason for a MISSING button lives in it, on the same
 * line the button would have occupied — that is what "beside the control"
 * means when the control is deliberately absent.
 */
const actions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: spacing["3"],
  marginTop: spacing["1"],
};

/**
 * A secondary button, not a primary one. "Reconnect" sits inside a coloured
 * status card that is already carrying the emphasis; a filled brand button
 * here would put two primaries on one badge.
 */
const button: CSSProperties = {
  // 48px: a real touch target, not a chip.
  minHeight: spacing["7"],
  paddingInline: spacing["4"],
  borderRadius: radii.md,
  border: `1px solid ${cssVar("border")}`,
  background: cssVar("surface"),
  color: cssVar("text"),
  fontSize: fontSize.sm.fontSize,
  fontWeight: 600,
  cursor: "pointer",
};

const note: CSSProperties = {
  fontSize: fontSize.sm.fontSize,
  lineHeight: `${String(fontSize.sm.lineHeight)}px`,
  color: cssVar("text-muted"),
};

export interface LiveBadgeProps {
  /** The stream this badge speaks for — the module's own key, never shown. */
  readonly stream: string;
}

export function LiveBadge({ stream }: LiveBadgeProps): ReactElement {
  const t = useT();
  const state = useRealtimeState();
  const { status, reconnect } = useStream(stream, { optional: true });
  const badge = describe(status, state);
  const since = badge.since === undefined ? undefined : CLOCK.format(badge.since);

  return (
    <div
      role="status"
      data-stapel-live-state={badge.id}
      style={{
        ...card,
        background: cssVar(`${badge.tone}-bg`),
        borderColor: cssVar(`${badge.tone}-border`),
      }}
    >
      <span style={headline}>
        <span
          aria-hidden="true"
          style={{
            width: spacing["2"],
            height: spacing["2"],
            flex: "none",
            borderRadius: radii.full,
            background: cssVar(badge.tone),
            boxShadow: `0 0 0 ${String(spacing["1"])}px ${cssVar(`${badge.tone}-border`)}`,
          }}
        />
        {t(`demo.realtime.badge.${badge.id}.title`)}
      </span>
      <p style={sentence}>
        {t(
          `demo.realtime.badge.${badge.id}.body`,
          since === undefined ? undefined : { since }
        )}
      </p>
      {badge.retry === "none" ? null : (
        <div style={actions}>
          {badge.retry === "offer" ? (
            <button
              type="button"
              style={button}
              onClick={reconnect}
              data-analytics="none"
              data-analytics-reason="demo-only control: the scripted transport has no server to reconnect to"
            >
              {t("demo.realtime.action.reconnect")}
            </button>
          ) : (
            <span style={note}>{t("demo.realtime.action.futile")}</span>
          )}
        </div>
      )}
    </div>
  );
}

const disclosure: CSSProperties = {
  maxWidth: "32rem",
  borderRadius: radii.md,
  border: `1px solid ${cssVar("border-subtle")}`,
  background: cssVar("surface"),
  color: cssVar("text-muted"),
  padding: `${String(spacing["2"])}px ${String(spacing["3"])}px`,
  fontSize: fontSize.sm.fontSize,
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  color: cssVar("text"),
  fontWeight: 600,
  // 44px of clickable row rather than one line of text.
  paddingBlock: spacing["2"],
};

const list: CSSProperties = {
  display: "grid",
  gap: spacing["1"],
  margin: 0,
  paddingTop: spacing["2"],
  fontFamily: cssVar("font-family-mono"),
  fontSize: fontSize.xs.fontSize,
};

const term: CSSProperties = {
  color: cssVar("text-muted"),
};

const value: CSSProperties = {
  margin: 0,
  color: cssVar("text"),
  // Machine values are allowed to be machine-shaped in here — and only here —
  // so they wrap instead of pushing the page past 390px.
  wordBreak: "break-all",
};

function Field(props: { name: string; value: string }): ReactElement {
  return (
    <div>
      <dt style={term}>{props.name}</dt>
      <dd style={value}>{props.value}</dd>
    </div>
  );
}

/**
 * The wire facts, one click away and collapsed by default.
 *
 * They are not deleted — a socket you cannot inspect is the thing this package
 * exists to end — they are simply not the page. A raw channel key, a
 * `snake_case` refusal and a cursor table are answers to a developer's
 * question, and a developer knows to open a disclosure labelled for them.
 */
export function DeveloperDetails({ stream }: LiveBadgeProps): ReactElement {
  const t = useT();
  const state = useRealtimeState();
  const { status } = useStream(stream, { optional: true });
  const cursors = Object.entries(state.cursors);
  const dash = "—";
  return (
    <details style={disclosure}>
      <summary style={summaryStyle}>{t("demo.realtime.developer.summary")}</summary>
      <dl style={list}>
        <Field name="stream" value={status.stream} />
        <Field name="stream.state" value={status.state} />
        <Field name="stream.refusal" value={status.refusal ?? dash} />
        <Field name="stream.reason" value={status.reason ?? dash} />
        <Field name="stream.attempt" value={String(status.attempt)} />
        <Field name="stream.gap" value={status.gap === undefined ? dash : String(status.gap)} />
        <Field name="connection.state" value={state.state} />
        <Field name="connection.everConnected" value={String(state.everConnected)} />
        <Field name="connection.degradation" value={state.degradation?.kind ?? dash} />
        {cursors.length === 0 ? (
          <Field name="cursors" value={dash} />
        ) : (
          cursors.map(([key, cursor]) => (
            <Field key={key} name={`cursors.${key}`} value={String(cursor)} />
          ))
        )}
      </dl>
    </details>
  );
}
