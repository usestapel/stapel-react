import type { ReactElement } from "react";
import { Tag } from "antd";
import { useT } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import { isKnownRecordingStatus, isProcessingStatus } from "../api/types.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";

/**
 * The lifecycle, as a chip a person can read at a glance.
 *
 * The visual audit's finding on this pair was that the status rendered as the
 * raw lowercase enum in muted body text — `processing` and `done` looked
 * identical two feet from the screen — and that the two values shown were not
 * even in the backend's vocabulary. Both halves are fixed here: the eleven
 * REAL values each get a sentence and a colour, and a value this build has
 * never seen renders as a neutral "unknown state" chip rather than as its own
 * enum member.
 *
 * Colour carries the same three-way split the backend makes, so the chip and
 * the polling agree: terminal-good (green), terminal-bad (red / neutral), and
 * pipeline-owned (blue, with the stage named — the eight in-flight values are
 * one progress presentation, not eight unrelated states).
 */
const STATUS_KEYS: Readonly<Record<string, string>> = {
  created: RECORDINGS_I18N_KEYS.statusCreated,
  uploading: RECORDINGS_I18N_KEYS.statusUploading,
  queued: RECORDINGS_I18N_KEYS.statusQueued,
  analyzing: RECORDINGS_I18N_KEYS.statusAnalyzing,
  normalizing: RECORDINGS_I18N_KEYS.statusNormalizing,
  transcribing: RECORDINGS_I18N_KEYS.statusTranscribing,
  diarizing: RECORDINGS_I18N_KEYS.statusDiarizing,
  merging: RECORDINGS_I18N_KEYS.statusMerging,
  completed: RECORDINGS_I18N_KEYS.statusCompleted,
  error: RECORDINGS_I18N_KEYS.statusError,
  deleted: RECORDINGS_I18N_KEYS.statusDeleted,
};

/** antd `Tag` colour per status. Roles, not hexes — the theme owns the value. */
function toneFor(status: string): string | undefined {
  if (status === "completed") return "success";
  if (status === "error") return "error";
  if (isProcessingStatus(status)) return "processing";
  if (status === "uploading" || status === "created") return "default";
  return undefined;
}

export function RecordingStatusChip(props: {
  /** The recording's `status` string, straight off the wire. */
  status: string;
  /** Compact chip for a dense list row. */
  compact?: boolean;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const { status } = props;
  const known = isKnownRecordingStatus(status);
  const labelKey = STATUS_KEYS[status] ?? RECORDINGS_I18N_KEYS.statusUnknown;
  const tone = toneFor(status);
  return (
    <Tag
      {...(tone !== undefined ? { color: tone } : {})}
      style={{
        marginInlineEnd: spacing["0"],
        maxWidth: "100%",
        ...(props.compact === true ? { fontSize: fontSize.xs.fontSize } : {}),
      }}
      data-stapel-recording-status={known ? status : "unknown"}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      {t(labelKey)}
    </Tag>
  );
}
