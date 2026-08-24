import type { ReactElement } from "react";
import { Button, Input, Progress, Select, Switch, Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert, GatedButton, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Recording } from "../api/types.js";
import { RecordingUpload, uploadPreflightKey } from "../headless/RecordingUpload.js";
import type { RecordingUploadBag } from "../headless/RecordingUpload.js";
import { useRecordingsFormat } from "../model/format.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { rowStyle, stackStyle } from "./layout.js";

const SOURCE_KEYS: readonly (readonly [string, string])[] = [
  ["meet", RECORDINGS_I18N_KEYS.uploaderSourceMeet],
  ["dictaphone", RECORDINGS_I18N_KEYS.uploaderSourceDictaphone],
  ["upload", RECORDINGS_I18N_KEYS.uploaderSourceUpload],
  ["other", RECORDINGS_I18N_KEYS.uploaderSourceOther],
];

/** The step's own sentence — never a bare progress bar with no label. */
function stepKey(step: RecordingUploadBag["step"]): string | null {
  if (step === "creating") return RECORDINGS_I18N_KEYS.uploaderStepCreating;
  if (step === "uploading") return RECORDINGS_I18N_KEYS.uploaderStepUploading;
  if (step === "finalizing") return RECORDINGS_I18N_KEYS.uploaderStepFinalizing;
  if (step === "done") return RECORDINGS_I18N_KEYS.uploaderDone;
  return null;
}

function UploaderBody(props: { bag: RecordingUploadBag; testId: string }): ReactElement {
  const t = useT();
  const format = useRecordingsFormat();
  const { bag, testId } = props;
  const busy = bag.step !== "idle" && bag.step !== "done";
  const label = stepKey(bag.step);
  const preflight = uploadPreflightKey(bag.error);
  return (
    <section style={{ ...stackStyle, gap: spacing["4"] }} data-testid={testId}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {t(RECORDINGS_I18N_KEYS.uploaderHeading)}
      </Typography.Title>

      <label style={{ ...stackStyle, gap: spacing["1"] }}>
        <Typography.Text>{t(RECORDINGS_I18N_KEYS.uploaderPick)}</Typography.Text>
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null;
            bag.setFile(picked);
            if (picked !== null && bag.draft.title === "") {
              bag.patchDraft({ title: picked.name });
            }
          }}
          data-testid={`${testId}-file`}
        />
      </label>
      {bag.file !== null ? (
        <Typography.Text type="secondary">
          {t(RECORDINGS_I18N_KEYS.uploaderPicked, {
            name: bag.file.name,
            size: format.bytes(bag.file.size),
          })}
        </Typography.Text>
      ) : null}

      <label style={{ ...stackStyle, gap: spacing["1"] }}>
        <Typography.Text>{t(RECORDINGS_I18N_KEYS.uploaderTitleLabel)}</Typography.Text>
        <Input
          value={bag.draft.title}
          placeholder={t(RECORDINGS_I18N_KEYS.uploaderTitlePlaceholder)}
          onChange={(event) => {
            bag.patchDraft({ title: event.target.value });
          }}
          data-testid={`${testId}-title`}
        />
      </label>

      <label style={{ ...stackStyle, gap: spacing["1"] }}>
        <Typography.Text>{t(RECORDINGS_I18N_KEYS.uploaderSourceLabel)}</Typography.Text>
        <Select
          value={bag.draft.sourceType}
          onChange={(value: string) => {
            bag.patchDraft({ sourceType: value });
          }}
          options={SOURCE_KEYS.map(([value, key]) => ({ value, label: t(key) }))}
          data-testid={`${testId}-source`}
        />
      </label>

      <div style={{ ...rowStyle, gap: spacing["2"] }}>
        <Switch
          checked={bag.draft.diarizationEnabled}
          onChange={(checked: boolean) => {
            bag.patchDraft({ diarizationEnabled: checked });
          }}
          aria-label={t(RECORDINGS_I18N_KEYS.uploaderDiarizationLabel)}
        />
        <Typography.Text>
          {t(RECORDINGS_I18N_KEYS.uploaderDiarizationLabel)}
        </Typography.Text>
      </div>

      {label !== null ? (
        <div style={{ ...stackStyle, gap: spacing["1"] }} data-testid={`${testId}-step`}>
          <Typography.Text type="secondary">{t(label)}</Typography.Text>
          {bag.progress !== null ? (
            <>
              <Progress percent={Math.round(bag.progress.ratio * 100)} />
              <Typography.Text type="secondary">
                {t(RECORDINGS_I18N_KEYS.uploaderProgress, {
                  done: format.bytes(bag.progress.loaded),
                  total: format.bytes(bag.progress.total),
                })}
              </Typography.Text>
            </>
          ) : null}
        </div>
      ) : null}

      {preflight !== undefined ? (
        <ErrorAlert message={t(preflight)} testId={`${testId}-preflight`} />
      ) : (
        <ErrorAlert thrown={bag.error} testId={`${testId}-error`} />
      )}

      <div style={rowStyle}>
        <GatedButton
          gate={bag.gate}
          type="primary"
          loading={busy}
          onClick={bag.start}
          testId={`${testId}-start`}
          data-analytics="none"
          data-analytics-reason="the pair ships no flow machine for the upload act yet"
        >
          {t(RECORDINGS_I18N_KEYS.uploaderStart)}
        </GatedButton>
        {bag.step === "uploading" ? (
          <Button
            onClick={bag.cancel}
            data-analytics="none"
            data-analytics-reason="aborting an in-flight PUT is plumbing"
          >
            {t(RECORDINGS_I18N_KEYS.uploaderCancel)}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * `create → upload → finalize` as ONE surface.
 *
 * The three calls are one user act, and splitting them across three
 * host-wired controls is how a half-uploaded recording gets stranded: the
 * session is open, the bytes are in the bucket, and nothing ever finalizes, so
 * the pipeline never runs and the recording sits on `uploading` forever.
 *
 * It also answers the visual audit's findings on the old composer: there is a
 * file picker, a title, a source, a diarization switch and a real progress
 * bar with the byte counts beside it — not a muted caption above a button
 * repeating the same three words.
 */
export function RecordingUploader(props: {
  /** The workspace to create the recording in. Missing = the gate says so. */
  workspaceId?: string;
  onFinalized?: (recording: Recording) => void;
  surface?: "raised" | "base" | "bare";
  "data-testid"?: string;
}): ReactElement {
  const testId = props["data-testid"] ?? "recording-uploader";
  return (
    <SkinTheme surface={props.surface ?? "raised"} data-testid={testId}>
      <RecordingUpload
        {...(props.workspaceId !== undefined ? { workspaceId: props.workspaceId } : {})}
        {...(props.onFinalized !== undefined ? { onFinalized: props.onFinalized } : {})}
      >
        {(bag) => <UploaderBody bag={bag} testId={`${testId}-body`} />}
      </RecordingUpload>
    </SkinTheme>
  );
}
