import { useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Typography } from "antd";
import { useT } from "@stapel/core";
import { EmptyState, LoadList } from "@stapel/tokens-antd/skin";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import type { TranscriptSegment } from "../api/types.js";
import { Transcript, segmentIndexAt, speakerLabel } from "../headless/Transcript.js";
import { useRecordingsFormat } from "../model/format.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { rowStyle, stackStyle } from "./layout.js";
import type { MediaSync } from "./useMediaSync.js";

const segmentStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: spacing["3"],
  width: "100%",
  minWidth: 0,
  padding: `${String(spacing["2"])}px ${String(spacing["3"])}px`,
  borderRadius: radii.sm,
  border: "1px solid transparent",
  background: "transparent",
  textAlign: "start",
  color: cssVar("text"),
  cursor: "pointer",
};

const activeSegmentStyle: CSSProperties = {
  ...segmentStyle,
  background: cssVar("brand-subtle"),
  borderColor: cssVar("brand"),
};

const timecodeStyle: CSSProperties = {
  color: cssVar("text-muted"),
  fontSize: fontSize.sm.fontSize,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const textStyle: CSSProperties = {
  minWidth: 0,
  // A transcript line is prose and must wrap, including a long unbroken token
  // (a URL someone read aloud) — the phone-viewport overflow class, answered
  // where the wide content is rather than on the page.
  overflowWrap: "anywhere",
};

function SegmentRow(props: {
  segment: TranscriptSegment;
  index: number;
  active: boolean;
  onSeek: ((seconds: number) => void) | undefined;
}): ReactElement {
  const t = useT();
  const format = useRecordingsFormat();
  const { segment, index, active, onSeek } = props;
  const ref = useRef<HTMLLIElement | null>(null);
  const time = format.timecode(segment.start_time);
  const speaker = speakerLabel(
    segment,
    (n) =>
      t(RECORDINGS_I18N_KEYS.transcriptSpeakerFallback, { number: n + 1 }),
    index
  );

  // Follow playback with the scroll position, but only inside this pane's own
  // scroll container ("nearest"), never by scrolling the page out from under
  // someone who is reading somewhere else.
  useEffect(() => {
    if (!active) return;
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const body = (
    <>
      <span style={timecodeStyle}>{time}</span>
      <span style={textStyle}>
        <Typography.Text strong style={{ marginInlineEnd: spacing["2"] }}>
          {speaker}
        </Typography.Text>
        {segment.text}
      </span>
    </>
  );

  return (
    <li
      ref={ref}
      style={{ listStyle: "none", minWidth: 0 }}
      aria-current={active ? "true" : undefined}
      data-stapel-transcript-active={active ? "true" : "false"}
    >
      {onSeek === undefined ? (
        <div style={active ? activeSegmentStyle : segmentStyle}>{body}</div>
      ) : (
        <button
          type="button"
          style={active ? activeSegmentStyle : segmentStyle}
          onClick={() => {
            onSeek(segment.start_time);
          }}
          aria-label={t(RECORDINGS_I18N_KEYS.transcriptSeek, { time })}
          data-analytics="none"
          data-analytics-reason="seeking inside a player is not a funnel step"
        >
          {body}
        </button>
      )}
    </li>
  );
}

/**
 * The speaker-attributed transcript, synced to playback.
 *
 * This is a live region, not a list. Two rules follow from that and are the
 * reason it is a component rather than a `.map()`:
 *
 *  - the highlighted segment is `aria-current` and scrolls itself into view
 *    **inside this pane's own scroll box**, so a screen reader and a sighted
 *    reader are looking at the same line and neither has the page yanked;
 *  - every segment is a real `<button>`, so clicking or tabbing to a line and
 *    pressing Enter seeks the audio. A div with an onClick would put the whole
 *    transcript out of reach of a keyboard.
 *
 * The empty arm is a designed state, not a blank: a recording whose pipeline
 * has not written any segments yet is a NORMAL stage, and it says so.
 */
export function TranscriptPane(props: {
  recordingId: string;
  /** Shared playback position — pass the same object the player got. */
  sync?: MediaSync;
  /** The recording is still being transcribed: the empty arm says "coming". */
  isProcessing?: boolean;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "transcript-pane";
  const { sync } = props;
  // While a recording is still being transcribed there is no transcript for
  // the read to return, so a skeleton would promise text that is not on its
  // way — the pending sentence is true from the first frame and stays true
  // when the (empty) page arrives. It also makes the state photographable: the
  // showcase used to shoot the same skeleton for "ready" and "being
  // transcribed" and call it two states.
  const pendingArm =
    props.isProcessing === true ? (
      <EmptyState
        title={t(RECORDINGS_I18N_KEYS.transcriptPending)}
        compact
        testId={`${testId}-empty`}
      />
    ) : undefined;
  return (
    <Transcript recordingId={props.recordingId}>
      {(bag) => (
        <section
          style={stackStyle}
          aria-label={t(RECORDINGS_I18N_KEYS.transcriptRegionLabel)}
          data-testid={testId}
        >
          <Typography.Text strong>
            {t(RECORDINGS_I18N_KEYS.transcriptHeading)}
          </Typography.Text>
          <LoadList
            state={bag.state}
            onRetry={bag.refetch}
            testId={`${testId}-load`}
            {...(pendingArm !== undefined ? { loading: pendingArm } : {})}
            empty={
              pendingArm ?? (
                <EmptyState
                  title={t(RECORDINGS_I18N_KEYS.transcriptEmpty)}
                  compact
                  testId={`${testId}-empty`}
                />
              )
            }
          >
            {(segments) => {
              const active =
                sync !== undefined
                  ? segmentIndexAt(segments, sync.currentTime)
                  : -1;
              return (
                <>
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
                    // `polite`, so a reader hears the line change without
                    // being interrupted mid-sentence.
                    aria-live="polite"
                    aria-relevant="text"
                  >
                    {segments.map((segment, index) => (
                      <SegmentRow
                        key={segment.sequence_num}
                        segment={segment}
                        index={index}
                        active={index === active}
                        onSeek={sync?.seek}
                      />
                    ))}
                  </ul>
                  {bag.hasMore ? (
                    <div style={rowStyle}>
                      <Button
                        onClick={bag.loadMore}
                        loading={bag.isLoadingMore}
                        data-analytics="none"
                        data-analytics-reason="paging a transcript is not a funnel step"
                        data-testid={`${testId}-more`}
                      >
                        {t(RECORDINGS_I18N_KEYS.transcriptLoadMore)}
                      </Button>
                    </div>
                  ) : null}
                </>
              );
            }}
          </LoadList>
        </section>
      )}
    </Transcript>
  );
}
