import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Typography } from "antd";
import { SlotPlaceholder, useT } from "@stapel/core";
import { EmptyState, LoadList, SkinTheme } from "@stapel/tokens-antd/skin";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import type { Recording } from "../api/types.js";
import { RecordingList } from "../headless/RecordingList.js";
import { useRecordingsFormat } from "../model/format.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { RecordingStatusChip } from "./RecordingStatusChip.js";
import { WaveformIcon } from "./icons.js";
import { pageStyle, rowStyle, stackStyle, truncateStyle } from "./layout.js";

const rowShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing["1"],
  width: "100%",
  minWidth: 0,
  padding: spacing["3"],
  borderRadius: radii.md,
  border: `1px solid ${cssVar("border-subtle")}`,
  background: cssVar("surface-raised"),
  textAlign: "start",
  // The dependency-free half of "virtualise, don't paginate" (the wire returns
  // a flat array, so there is no page to fetch): rows outside the viewport are
  // skipped by layout and paint. `containIntrinsicSize` keeps the scrollbar
  // honest while they are skipped.
  contentVisibility: "auto",
  containIntrinsicSize: "auto 84px",
};

const metaStyle: CSSProperties = {
  ...rowStyle,
  gap: spacing["3"],
  color: cssVar("text-muted"),
  fontSize: fontSize.sm.fontSize,
};

function RecordingRow(props: {
  recording: Recording;
  onOpen: ((recording: Recording) => void) | undefined;
}): ReactElement {
  const t = useT();
  const format = useRecordingsFormat();
  const { recording, onOpen } = props;
  const duration = format.duration(recording.duration_seconds);
  const created = format.date(recording.created_at);
  const body = (
    <>
      <div style={{ ...rowStyle, justifyContent: "space-between" }}>
        <span
          style={{
            ...truncateStyle,
            fontSize: fontSize.md.fontSize,
            color: cssVar("text"),
          }}
        >
          {recording.title}
        </span>
        <RecordingStatusChip status={recording.status} compact />
      </div>
      <div style={metaStyle}>
        {created !== undefined ? <span>{created}</span> : null}
        {duration !== undefined ? <span>{duration}</span> : null}
        {recording.speakers_count > 0 ? (
          <span>
            {t(RECORDINGS_I18N_KEYS.detailSpeakers)}
            {": "}
            {format.count(recording.speakers_count)}
          </span>
        ) : null}
        {recording.word_count > 0 ? (
          <span>
            {t(RECORDINGS_I18N_KEYS.detailWords)}
            {": "}
            {format.count(recording.word_count)}
          </span>
        ) : null}
      </div>
    </>
  );
  if (onOpen === undefined) {
    return (
      <li style={rowShellStyle} data-stapel-recording-row={recording.id}>
        {body}
      </li>
    );
  }
  return (
    <li style={{ listStyle: "none", minWidth: 0 }}>
      <button
        type="button"
        style={{ ...rowShellStyle, cursor: "pointer" }}
        onClick={() => {
          onOpen(recording);
        }}
        aria-label={t(RECORDINGS_I18N_KEYS.listOpen)}
        data-stapel-recording-row={recording.id}
        data-analytics="none"
        data-analytics-reason="navigation to the detail screen; the host owns routing"
      >
        {body}
      </button>
    </li>
  );
}

/**
 * The recordings screen — the wired list.
 *
 * Four arms, and the failed one NEVER wears the empty copy. That is the
 * 2026-08-09 incident written into a component: "you have not uploaded
 * anything yet" is the normal first-run screen here, so a failed read wearing
 * it is indistinguishable from the expected one and nobody looks twice. The
 * substrate's `LoadList` makes the four arms structural — "empty" is reachable
 * only from a load that succeeded — and the failed arm carries the sentence
 * that says the fault is ours.
 *
 * Rows carry what the audit found missing: the title, the date, the length,
 * and a status the colour of which encodes the state. The list polls itself
 * while any row is mid-pipeline (see `useRecordings`), so a recording finishes
 * on screen instead of on reload.
 */
export function RecordingsList(props: {
  /** Narrow the listing to one workspace (requires membership). */
  workspaceId?: string;
  /** Open a recording. Omit and rows render as static list items. */
  onOpen?: (recording: Recording) => void;
  /**
   * The "start a recording" affordance for the empty state. The screen does
   * not own creation (the host routes to it), so this is a slot — and an
   * unfilled slot is a named, visible box in development rather than nothing.
   */
  renderCreateAction?: ReactNode;
  /** Surface to paint. `base` (default) is a full-page screen. */
  surface?: "raised" | "base" | "bare";
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "recordings-list";
  return (
    <SkinTheme surface={props.surface ?? "base"} data-testid={testId}>
      <section style={pageStyle} aria-label={t(RECORDINGS_I18N_KEYS.listHeading)}>
        <header style={{ ...rowStyle, gap: spacing["2"] }}>
          <WaveformIcon />
          <Typography.Title level={2} style={{ margin: 0, ...truncateStyle }}>
            {t(RECORDINGS_I18N_KEYS.listHeading)}
          </Typography.Title>
        </header>
        {props.workspaceId !== undefined ? (
          <Typography.Text type="secondary">
            {t(RECORDINGS_I18N_KEYS.listWorkspaceNote)}
          </Typography.Text>
        ) : null}
        <RecordingList
          {...(props.workspaceId !== undefined
            ? { workspaceId: props.workspaceId }
            : {})}
        >
          {(bag) => (
            <LoadList
              state={bag.state}
              onRetry={bag.refetch}
              testId={`${testId}-load`}
              failed={() => (
                <FailedArm onRetry={bag.refetch} testId={`${testId}-failed`} />
              )}
              empty={
                <EmptyState
                  icon={<WaveformIcon />}
                  title={t(RECORDINGS_I18N_KEYS.listEmpty)}
                  hint={t(RECORDINGS_I18N_KEYS.listEmptyHint)}
                  action={
                    props.renderCreateAction ?? (
                      <SlotPlaceholder name="renderCreateAction" />
                    )
                  }
                  testId={`${testId}-empty`}
                />
              }
            >
              {(recordings) => (
                <ul
                  style={{
                    ...stackStyle,
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                  }}
                >
                  {recordings.map((recording) => (
                    <RecordingRow
                      key={recording.id}
                      recording={recording}
                      onOpen={props.onOpen}
                    />
                  ))}
                </ul>
              )}
            </LoadList>
          )}
        </RecordingList>
      </section>
    </SkinTheme>
  );
}

/**
 * The failed arm, spelled out rather than left to the substrate's default.
 *
 * The default would render the backend's own sentence, and for a `404` that
 * sentence asserts the thing does not exist — which reads, on this screen,
 * exactly like the empty state. The copy here says the load failed and that
 * the fault is ours.
 */
function FailedArm(props: { onRetry: () => void; testId: string }): ReactElement {
  const t = useT();
  return (
    <div
      role="alert"
      style={{ ...stackStyle, gap: spacing["2"] }}
      data-testid={props.testId}
    >
      <Typography.Text strong>
        {t(RECORDINGS_I18N_KEYS.listError)}
      </Typography.Text>
      <Typography.Text type="secondary">
        {t(RECORDINGS_I18N_KEYS.listLoadFailed)}
      </Typography.Text>
      <div>
        <Button
          onClick={props.onRetry}
          data-analytics="none"
          data-analytics-reason="retrying a read is not a funnel step"
        >
          {t(RECORDINGS_I18N_KEYS.listRetry)}
        </Button>
      </div>
    </div>
  );
}
