/** Recording list — headless read of the user's own recordings. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { RecordingList } from "../src/index.js";
import type { Recording } from "../src/index.js";
import { RecordingsDemoHarness, DemoCard } from "./_harness.js";

/** A canned list — one processing recording, one done with transcription outputs. */
const RECORDINGS: Recording[] = [
  {
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
  },
  {
    id: "rec-2",
    workspace_id: "ws-1",
    title: "Customer interview",
    status: "done",
    source_type: "upload",
    language: "en",
    duration_seconds: 1830,
    segments_count: 214,
    speakers_count: 2,
    word_count: 4120,
    provider_used: "whisper",
    transcript_storage_key: "recordings/rec-2/transcript.json",
    summary: "Prospect wants SSO and an audit log before rollout.",
    created_at: "2026-07-08T15:30:00Z",
  },
];

function RecordingRow(props: { recording: Recording }): ReactElement {
  return (
    <li
      style={{
        listStyle: "none",
        padding: `${spacing["2"]}px 0`,
        borderTop: `1px solid ${cssVar("card-border")}`,
      }}
    >
      <strong style={{ fontSize: fontSize.md.fontSize }}>
        {props.recording.title}
      </strong>
      <div style={{ color: cssVar("color-text-secondary") }}>
        {props.recording.status}
      </div>
    </li>
  );
}

/** The list body — mounted INSIDE the harness, so `useT`/hooks have providers. */
function RecordingListBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="RecordingList">
      <RecordingList>
        {({ recordings, isLoading }) => {
          if (isLoading) {
            return (
              <span style={{ color: cssVar("color-text-secondary") }}>
                {t("recordings.list.loading")}
              </span>
            );
          }
          if (recordings.length === 0) {
            return (
              <span style={{ color: cssVar("color-text-secondary") }}>
                {t("recordings.list.empty")}
              </span>
            );
          }
          return (
            <ul style={{ margin: 0, padding: 0, borderRadius: radii.sm }}>
              {recordings.map((recording) => (
                <RecordingRow key={recording.id} recording={recording} />
              ))}
            </ul>
          );
        }}
      </RecordingList>
    </DemoCard>
  );
}

function RecordingListDemo(): ReactElement {
  return (
    <RecordingsDemoHarness handlers={{ "/recordings": RECORDINGS }}>
      <RecordingListBody />
    </RecordingsDemoHarness>
  );
}

/**
 * Demonstrates the headless recordings read: the canned handler returns two
 * recordings (one processing, one done), so the list renders. Swap the handler
 * for a `[500, …]` tuple to exercise the error branch. Bring your own
 * list/table — the component is renderless.
 */
export default defineDemo({
  id: "recordings.list",
  title: "Recording list",
  description:
    "The headless RecordingList reads the user's own recordings. Bring your own list/table — the component is renderless.",
  component: RecordingList,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <RecordingListDemo /> },
  },
});
