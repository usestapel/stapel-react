/** Recording composer — headless create + open upload session (step 1 of 3). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { RecordingComposer } from "../src/index.js";
import type { CreateRecordingRequest } from "../src/index.js";
import {
  RecordingsDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
} from "./_harness.js";

/** The 201 body the canned handler echoes: the recording + its upload session. */
const CREATED = {
  recording: {
    id: "rec-1",
    workspace_id: "ws-1",
    title: "Team standup",
    status: "awaiting_upload",
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
  },
  upload: {
    id: "up-1",
    presigned_url: "https://store.demo.stapel.dev/upload/up-1",
    storage_key: "recordings/rec-1/media",
    max_size_bytes: 524288000,
    expires_at: "2026-07-09T10:00:00Z",
  },
};

/** A minimal draft the demo submits (a real host builds this from a form). */
const DRAFT: CreateRecordingRequest = {
  workspace_id: "ws-1",
  title: "Team standup",
  source_type: "upload",
  diarization_enabled: true,
};

function ComposerBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="RecordingComposer">
      <RecordingComposer>
        {({ create, isCreating, recording, upload }) => (
          <>
            <span style={{ color: cssVar("color-text-secondary") }}>
              {recording
                ? t("recordings.composer.created")
                : isCreating
                  ? t("recordings.composer.creating")
                  : t("recordings.composer.create")}
            </span>
            {upload ? (
              <code style={{ color: cssVar("color-text-brand") }}>
                {upload.storage_key}
              </code>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => create(DRAFT)}
                labelKey="recordings.composer.create"
              />
            </DemoActions>
          </>
        )}
      </RecordingComposer>
    </DemoCard>
  );
}

function RecordingComposerDemo(): ReactElement {
  return (
    <RecordingsDemoHarness handlers={{ "/recordings": [201, CREATED] }}>
      <ComposerBody />
    </RecordingsDemoHarness>
  );
}

/**
 * Demonstrates step 1 of create → upload → finalize: the canned handler echoes a
 * 201 `{ recording, upload }`, so clicking "New recording" resolves to the
 * created state and surfaces the opened upload session (its `storage_key`). A
 * real host then PUTs the media at `upload.presigned_url` (see
 * `uploadRecordingBlob`) and finalizes (see the UploadFinalizer demo).
 */
export default defineDemo({
  id: "recordings.composer",
  title: "Recording composer",
  description:
    "The headless RecordingComposer wraps create-recording and surfaces the opened upload session; on success the pair invalidates the list read. Bring your own form UI — the component is renderless.",
  component: RecordingComposer,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <RecordingComposerDemo /> },
  },
});
