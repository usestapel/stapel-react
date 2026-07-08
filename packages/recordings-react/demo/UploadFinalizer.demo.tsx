/** Upload finalizer — headless finalize + enqueue pipeline (step 3 of 3). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { UploadFinalizer } from "../src/index.js";
import {
  RecordingsDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
} from "./_harness.js";

/** The 200 body the canned handler echoes: the recording flipped to processing. */
const FINALIZED = {
  id: "rec-1",
  workspace_id: "ws-1",
  title: "Team standup",
  status: "processing",
  source_type: "upload",
  language: "en",
  duration_seconds: null,
  segments_count: 0,
  speakers_count: 0,
  word_count: 0,
  provider_used: null,
  transcript_storage_key: null,
  summary: null,
  created_at: "2026-07-09T09:00:00Z",
};

function FinalizerBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="UploadFinalizer">
      <UploadFinalizer recordingId="rec-1">
        {({ finalize, isFinalizing, recording }) => (
          <>
            <span style={{ color: cssVar("color-text-secondary") }}>
              {recording
                ? t("recordings.finalize.done")
                : isFinalizing
                  ? t("recordings.finalize.finalizing")
                  : t("recordings.finalize.submit")}
            </span>
            <DemoActions>
              <DemoButton
                run={() => finalize(1048576)}
                labelKey="recordings.finalize.submit"
              />
            </DemoActions>
          </>
        )}
      </UploadFinalizer>
    </DemoCard>
  );
}

function UploadFinalizerDemo(): ReactElement {
  return (
    <RecordingsDemoHarness handlers={{ "/finalize": FINALIZED }}>
      <FinalizerBody />
    </RecordingsDemoHarness>
  );
}

/**
 * Demonstrates step 3 of create → upload → finalize: after the media blob has
 * been PUT to the session's presigned URL, `finalize(fileSizeBytes)` enqueues
 * the transcription pipeline and resolves to the updated recording (now
 * processing). The canned handler echoes the 200 body. A finalize on a
 * recording that is not awaiting it fails `error.400.recording_invalid_state`.
 */
export default defineDemo({
  id: "recordings.finalize",
  title: "Upload finalizer",
  description:
    "The headless UploadFinalizer wraps the finalize mutation for one recording (call after the media is uploaded). Bring your own control UI — the component is renderless.",
  component: UploadFinalizer,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <UploadFinalizerDemo /> },
  },
});
