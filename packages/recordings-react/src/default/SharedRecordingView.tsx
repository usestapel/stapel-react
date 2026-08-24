import type { ReactElement } from "react";
import { Typography } from "antd";
import { useT } from "@stapel/core";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { fontSize, spacing } from "@stapel/tokens";
import type { SharedRecordingBag } from "../headless/SharedRecording.js";
import { SharedRecording } from "../headless/SharedRecording.js";
import { useRecordingsFormat } from "../model/format.js";
import { segmentIndexAt, speakerLabel } from "../headless/Transcript.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { RecordingStatusChip } from "./RecordingStatusChip.js";
import { SharedMedia } from "./SharedMedia.js";
import { ShareUnlockGate } from "./ShareUnlockGate.js";
import { WaveformIcon } from "./icons.js";
import { pageStyle, rowStyle, stackStyle, truncateStyle } from "./layout.js";
import { useMediaSync } from "./useMediaSync.js";

/**
 * The transcript as a share link projects it.
 *
 * Deliberately NOT `TranscriptPane`: that pane reads the owner's paginated
 * endpoint, and this surface has no session to read it with. The segments
 * arrive inside the share's own projection (same `TranscriptSegmentDTO` shape,
 * which is why the rendering is the same shape of code), so this walks the
 * array it was handed.
 */
function SharedTranscript(props: {
  bag: SharedRecordingBag;
  currentTime: number;
  onSeek: (seconds: number) => void;
}): ReactElement {
  const t = useT();
  const format = useRecordingsFormat();
  const { bag } = props;
  if (!bag.grants("transcript")) {
    return (
      <Typography.Text type="secondary" data-testid="shared-transcript-blocked">
        {t(RECORDINGS_I18N_KEYS.shareTranscriptBlocked)}
      </Typography.Text>
    );
  }
  const state = bag.state;
  const segments = state.status === "ready" ? state.data.segments : [];
  if (segments.length === 0) {
    return (
      <EmptyState
        title={t(RECORDINGS_I18N_KEYS.transcriptEmpty)}
        compact
        testId="shared-transcript-empty"
      />
    );
  }
  const active = segmentIndexAt(segments, props.currentTime);
  return (
    <section
      style={stackStyle}
      aria-label={t(RECORDINGS_I18N_KEYS.transcriptRegionLabel)}
      data-testid="shared-transcript"
    >
      <Typography.Text strong>
        {t(RECORDINGS_I18N_KEYS.transcriptHeading)}
      </Typography.Text>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: spacing["1"],
          maxHeight: "28rem",
          overflowY: "auto",
          minWidth: 0,
        }}
        aria-live="polite"
      >
        {segments.map((segment, index) => {
          const time = format.timecode(segment.start_time);
          return (
            <li
              key={segment.sequence_num}
              style={{ listStyle: "none", minWidth: 0 }}
              aria-current={index === active ? "true" : undefined}
              data-stapel-transcript-active={index === active ? "true" : "false"}
            >
              <button
                type="button"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: spacing["3"],
                  width: "100%",
                  minWidth: 0,
                  padding: spacing["2"],
                  border: "1px solid transparent",
                  background: "transparent",
                  textAlign: "start",
                  cursor: "pointer",
                }}
                onClick={() => {
                  props.onSeek(segment.start_time);
                }}
                aria-label={t(RECORDINGS_I18N_KEYS.transcriptSeek, { time })}
                data-analytics="none"
                data-analytics-reason="anonymous surface; the pair ships no analytics for it"
              >
                <span
                  style={{
                    fontSize: fontSize.sm.fontSize,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {time}
                </span>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <Typography.Text
                    strong
                    style={{ marginInlineEnd: spacing["2"] }}
                  >
                    {speakerLabel(
                      segment,
                      (n) =>
                        t(RECORDINGS_I18N_KEYS.transcriptSpeakerFallback, {
                          number: n + 1,
                        }),
                      index
                    )}
                  </Typography.Text>
                  {segment.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The public share page — the whole anonymous surface.
 *
 * **No session.** The link token in the path is the credential; nothing here
 * reads `stapel_jwt` or waits for a session to bootstrap, because the visitor
 * may never have had one. That is also why it carries its own nav entry at
 * `surface: "public"`.
 *
 * **It branches on the GRANT, never on the request.** `permissions[]` decides
 * which parts exist: a `view`-only link renders the recording's details and
 * says so, and does not put up a player that cannot play or a transcript
 * heading with nothing under it.
 *
 * **Locked is a state, not an error.** A protected link answers `401
 * share_passcode_required`; the gate renders, the passcode is exchanged for a
 * short-lived token, and the read runs again with it.
 */
export function SharedRecordingView(props: {
  linkToken: string;
  surface?: "raised" | "base" | "bare";
  "data-testid"?: string;
}): ReactElement {
  const testId = props["data-testid"] ?? "shared-recording";
  return (
    <SkinTheme surface={props.surface ?? "base"} data-testid={testId}>
      <SharedRecording linkToken={props.linkToken}>
        {(bag) => <SharedBody bag={bag} testId={testId} />}
      </SharedRecording>
    </SkinTheme>
  );
}

function SharedBody(props: {
  bag: SharedRecordingBag;
  testId: string;
}): ReactElement {
  const t = useT();
  const format = useRecordingsFormat();
  const { bag, testId } = props;
  const sync = useMediaSync();

  if (bag.notFound) {
    return (
      <section style={pageStyle}>
        <EmptyState
          icon={<WaveformIcon />}
          title={t(RECORDINGS_I18N_KEYS.shareNotFound)}
          testId={`${testId}-not-found`}
        />
      </section>
    );
  }

  if (bag.locked) {
    return (
      <section style={pageStyle}>
        <ShareUnlockGate
          onUnlock={bag.unlock}
          isUnlocking={bag.isUnlocking}
          error={bag.unlockError}
          throttled={bag.throttled}
        />
      </section>
    );
  }

  return (
    <section style={pageStyle}>
      <LoadBoundary state={bag.state} onRetry={bag.refetch} testId={`${testId}-load`}>
        {(shared) => (
          <>
            <header style={stackStyle}>
              <div style={{ ...rowStyle, justifyContent: "space-between" }}>
                <Typography.Title level={2} style={{ margin: 0, ...truncateStyle }}>
                  {shared.title}
                </Typography.Title>
                <RecordingStatusChip status={shared.status} />
              </div>
              <div style={{ ...rowStyle, gap: spacing["3"] }}>
                <Typography.Text type="secondary">
                  {format.date(shared.created_at) ??
                    t(RECORDINGS_I18N_KEYS.detailUnknownValue)}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {format.duration(shared.duration_seconds) ??
                    t(RECORDINGS_I18N_KEYS.detailUnknownValue)}
                </Typography.Text>
              </div>
              {shared.permissions.length <= 1 ? (
                <Typography.Text type="secondary" data-testid={`${testId}-view-only`}>
                  {t(RECORDINGS_I18N_KEYS.shareViewOnly)}
                </Typography.Text>
              ) : null}
            </header>

            <SharedMedia media={bag.media} sync={sync} />

            {bag.grants("summary") &&
            shared.summary !== null &&
            shared.summary !== "" ? (
              <section style={stackStyle} data-testid={`${testId}-summary`}>
                <Typography.Text strong>
                  {t(RECORDINGS_I18N_KEYS.summaryHeading)}
                </Typography.Text>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                  {shared.summary}
                </Typography.Paragraph>
              </section>
            ) : null}

            <SharedTranscript
              bag={bag}
              currentTime={sync.currentTime}
              onSeek={sync.seek}
            />

            <Typography.Text type="secondary">
              {t(RECORDINGS_I18N_KEYS.shareFooter)}
            </Typography.Text>
          </>
        )}
      </LoadBoundary>
    </section>
  );
}
