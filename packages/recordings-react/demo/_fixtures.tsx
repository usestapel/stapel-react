/**
 * Fixtures for the DEFAULT-SKIN demos — the layer a host ships.
 *
 * Every status here is a real `RecordingStatus` value (stapel-recordings
 * `models.py`). The previous fixtures used `processing` / `done` /
 * `awaiting_upload`, none of which the backend can emit, so the showcase
 * taught a lifecycle no deployment has ever produced. `status` is a bare
 * `string` on the wire, so TypeScript could not catch it — which is exactly
 * why the vocabulary now ships as data (`RECORDING_STATUSES`) and why these
 * fixtures are built from it.
 */
import type { ReactElement, ReactNode } from "react";
import type { Recording, TranscriptSegment } from "../src/index.js";
import { RecordingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

export const DONE: Recording = {
  id: "rec-2",
  resource_key: "rec/rec-2",
  workspace_id: "ws-1",
  title: "Customer interview — Northwind",
  status: "completed",
  source_type: "upload",
  language: "en",
  duration_seconds: 1830,
  segments_count: 214,
  speakers_count: 2,
  word_count: 4120,
  provider_used: "whisper-large-v3",
  transcript_storage_key: "recordings/rec-2/transcript.json",
  summary:
    "Northwind want SSO and an exportable audit log before they roll out to the whole support team. Pricing was not an objection; the security review is the gate.",
  created_at: "2026-08-18T15:30:00Z",
  is_processing: false,
  poll_after_seconds: null,
};

export const PROCESSING: Recording = {
  ...DONE,
  id: "rec-1",
  resource_key: "rec/rec-1",
  title: "Team standup",
  status: "transcribing",
  duration_seconds: null,
  segments_count: 0,
  speakers_count: 0,
  word_count: 0,
  provider_used: null,
  transcript_storage_key: null,
  summary: null,
  created_at: "2026-08-20T09:00:00Z",
  is_processing: true,
  poll_after_seconds: 5,
};

export const SEGMENTS: TranscriptSegment[] = [
  {
    sequence_num: 1,
    start_time: 0,
    end_time: 6.4,
    speaker: "Ana",
    text: "Thanks for making the time. I want to walk through how your team handles handover between shifts.",
  },
  {
    sequence_num: 2,
    start_time: 6.4,
    end_time: 15.2,
    speaker: null,
    text: "Right now it is a shared document, and honestly half of it never gets written down before people leave.",
  },
  {
    sequence_num: 3,
    start_time: 15.2,
    end_time: 24.9,
    speaker: "Ana",
    text: "That is the part we would replace. The recording is the handover, and the summary is what the next shift actually reads.",
  },
];

export const TRANSCRIPT_PAGE = {
  items: SEGMENTS,
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: SEGMENTS.length,
  poll_after_seconds: null,
};

export const MEDIA = {
  url: "https://store.demo.stapel.dev/rec-2.mp3",
  expires_at: "2026-08-24T12:00:00Z",
  expires_in: 900,
};

export const SHARED_FULL = {
  id: "rec-2",
  title: DONE.title,
  status: "completed",
  language: "en",
  duration_seconds: 1830,
  created_at: DONE.created_at,
  permissions: ["view", "transcript", "summary", "media"],
  summary: DONE.summary,
  media_url: MEDIA.url,
  segments: SEGMENTS,
};

export const SHARED_VIEW_ONLY = {
  ...SHARED_FULL,
  permissions: ["view"],
  summary: null,
  media_url: null,
  segments: [],
};

/** Handler map for the owner-side screens with a finished recording. */
export const OWNER_HANDLERS: DemoHandlers = {
  "/transcript": TRANSCRIPT_PAGE,
  "/media": MEDIA,
  "/recordings/rec-2": DONE,
  "/recordings": [PROCESSING, DONE],
};

/** The frame every skin demo renders inside. */
export function SkinDemo(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  return (
    <RecordingsDemoHarness handlers={props.handlers ?? OWNER_HANDLERS}>
      {props.children}
    </RecordingsDemoHarness>
  );
}
