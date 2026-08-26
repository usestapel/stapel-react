import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Typography } from "antd";
import { useT } from "@stapel/core";
import { LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { cssVar, fontSize, spacing } from "@stapel/tokens";
import type { Recording } from "../api/types.js";
import { RecordingDetail } from "../headless/RecordingDetail.js";
import { useRecordingsFormat } from "../model/format.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { RecordingPlayer } from "./RecordingPlayer.js";
import { RecordingStatusChip } from "./RecordingStatusChip.js";
import { ReprocessAction } from "./ReprocessAction.js";
import { ResummarizeAction } from "./ResummarizeAction.js";
import { SummaryPane } from "./SummaryPane.js";
import { TranscriptPane } from "./TranscriptPane.js";
import { pageStyle, rowStyle, stackStyle, truncateStyle } from "./layout.js";
import { useMediaSync } from "./useMediaSync.js";

const factsStyle: CSSProperties = {
  display: "grid",
  // Element-width, not viewport-width: the columns come from the space this
  // pane actually has, so it reads the same in a 360px column and full-bleed.
  gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
  gap: spacing["3"],
  minWidth: 0,
};

function Fact(props: { label: string; value: string }): ReactElement {
  return (
    <div style={{ minWidth: 0 }}>
      <Typography.Text
        type="secondary"
        style={{ display: "block", fontSize: fontSize.sm.fontSize }}
      >
        {props.label}
      </Typography.Text>
      <span style={{ ...truncateStyle, display: "block", color: cssVar("text") }}>
        {props.value}
      </span>
    </div>
  );
}

/**
 * A fact whose value is a TECHNICAL token, not product copy.
 *
 * `provider_used` is a model id (`whisper-large-v3`) from a vocabulary that
 * changes with the deployment's pipeline. Printed in the same register as the
 * date and the duration it read as something the reader was meant to
 * understand (visual pass M-2); rendered as code, muted, it is what it is —
 * the line a support conversation needs and an eye skips. Same treatment
 * `cdn-react` gives a `meta_reason`.
 */
function TechnicalFact(props: { label: string; value: string }): ReactElement {
  return (
    <div style={{ minWidth: 0 }}>
      <Typography.Text
        type="secondary"
        style={{ display: "block", fontSize: fontSize.sm.fontSize }}
      >
        {props.label}
      </Typography.Text>
      <Typography.Text
        code
        type="secondary"
        style={{ ...truncateStyle, display: "block", fontSize: fontSize.sm.fontSize }}
      >
        {props.value}
      </Typography.Text>
    </div>
  );
}

function DetailBody(props: {
  recording: Recording;
  isProcessing: boolean;
  onBack: (() => void) | undefined;
  renderTopUpAction: ReactNode;
  summariesUnavailable: boolean | undefined;
}): ReactElement {
  const t = useT();
  const format = useRecordingsFormat();
  const { recording, isProcessing } = props;
  // ONE playback position, shared: the player writes it, the transcript reads
  // it and seeks it back. Two components each keeping their own would be two
  // truths about where the audio is.
  const sync = useMediaSync();
  const unknown = t(RECORDINGS_I18N_KEYS.detailUnknownValue);
  return (
    <section style={pageStyle}>
      <header style={stackStyle}>
        {props.onBack !== undefined ? (
          <div style={rowStyle}>
            <Button
              type="link"
              onClick={props.onBack}
              style={{ paddingInline: spacing["0"] }}
              data-analytics="none"
              data-analytics-reason="navigation; the host owns routing"
            >
              {t(RECORDINGS_I18N_KEYS.detailBack)}
            </Button>
          </div>
        ) : null}
        <div style={{ ...rowStyle, justifyContent: "space-between" }}>
          <Typography.Title level={2} style={{ margin: 0, ...truncateStyle }}>
            {recording.title}
          </Typography.Title>
          <RecordingStatusChip status={recording.status} />
        </div>
        {isProcessing ? (
          <Typography.Text type="secondary" data-testid="recording-processing">
            {t(RECORDINGS_I18N_KEYS.detailProcessing)}
          </Typography.Text>
        ) : null}
      </header>

      <div style={factsStyle}>
        <Fact
          label={t(RECORDINGS_I18N_KEYS.detailCreated)}
          value={format.instant(recording.created_at) ?? unknown}
        />
        <Fact
          label={t(RECORDINGS_I18N_KEYS.detailDuration)}
          value={format.duration(recording.duration_seconds) ?? unknown}
        />
        <Fact
          label={t(RECORDINGS_I18N_KEYS.detailLanguage)}
          value={
            recording.language == null || recording.language === ""
              ? unknown
              : format.language(recording.language)
          }
        />
        <Fact
          label={t(RECORDINGS_I18N_KEYS.detailSpeakers)}
          value={format.count(recording.speakers_count)}
        />
        <Fact
          label={t(RECORDINGS_I18N_KEYS.detailWords)}
          value={format.count(recording.word_count)}
        />
        {recording.provider_used == null || recording.provider_used === "" ? null : (
          <TechnicalFact
            label={t(RECORDINGS_I18N_KEYS.detailProvider)}
            value={recording.provider_used}
          />
        )}
      </div>

      <RecordingPlayer recording={recording} sync={sync} />

      <SummaryPane
        recording={recording}
        {...(props.summariesUnavailable !== undefined
          ? { unavailable: props.summariesUnavailable }
          : {})}
        action={
          <ResummarizeAction
            recording={recording}
            {...(props.renderTopUpAction !== undefined
              ? { renderTopUpAction: props.renderTopUpAction }
              : {})}
          />
        }
      />

      <TranscriptPane
        recordingId={recording.id}
        sync={sync}
        isProcessing={isProcessing}
      />

      <ReprocessAction
        recording={recording}
        {...(props.renderTopUpAction !== undefined
          ? { renderTopUpAction: props.renderTopUpAction }
          : {})}
      />
    </section>
  );
}

/**
 * The recording screen — everything that happens AFTER processing finishes,
 * which is the half this pair did not ship: play it, read it, re-summarize it,
 * re-run it.
 *
 * It polls while the pipeline owns the recording (`poll_after_seconds` off the
 * payload) and says so in words, so "processing" is a visible state that ends
 * on its own rather than a screen that looks final and is not.
 */
export function RecordingDetailPane(props: {
  recordingId: string;
  /** Back to the list. Omit and no back affordance renders. */
  onBack?: () => void;
  /** Fills the 402 top-up prompt's slot in both metered actions. */
  renderTopUpAction?: ReactNode;
  /** This deployment does not do summaries — see {@link SummaryPane}. */
  summariesUnavailable?: boolean;
  surface?: "raised" | "base" | "bare";
  "data-testid"?: string;
}): ReactElement {
  const testId = props["data-testid"] ?? "recording-detail";
  return (
    <SkinTheme surface={props.surface ?? "base"} data-testid={testId}>
      <RecordingDetail recordingId={props.recordingId}>
        {(bag) => (
          <LoadBoundary
            state={bag.state}
            onRetry={bag.refetch}
            testId={`${testId}-load`}
          >
            {(recording) => (
              <DetailBody
                recording={recording}
                isProcessing={bag.isProcessing}
                onBack={props.onBack}
                renderTopUpAction={props.renderTopUpAction}
                summariesUnavailable={props.summariesUnavailable}
              />
            )}
          </LoadBoundary>
        )}
      </RecordingDetail>
    </SkinTheme>
  );
}
