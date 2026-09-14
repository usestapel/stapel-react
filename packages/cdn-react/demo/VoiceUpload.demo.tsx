/**
 * The microphone, wired through to the CDN.
 *
 * `VoiceRecordButton.demo.tsx` photographs the two gestures and hands the clip
 * back; this demo is the arm that keeps going — the take goes to
 * `POST /upload/audio/` (stapel-cdn 0.21.0) named after the container the
 * engine chose, and `onUploaded` gets `audio/<hash>` with a length to draw.
 * Its own demo rather than a third variant of the gesture demo because at rest
 * the two arms are the same control by design (the difference is what happens
 * AFTER the second press), and a variant that photographs an identical frame
 * under a second name is what the distinctness gate exists to refuse.
 *
 * The mock answers the 201 the way the server actually does — BEFORE the
 * ffprobe pass, `duration: null` and no waveform yet — which is why the result
 * carries the clip's own clock and says it is not the measured one.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { VoiceRecordButton } from "../src/default/index.js";
import { CdnDemoHarness, DEMO_MISS } from "./_harness.js";

/** Two minutes: long enough for a real message, short of the 50 MB ceiling. */
const MAX_MS = 120_000;

const HASH = "c".repeat(64);

/** The 201 `POST /upload/audio/` answers with — BEFORE the ffprobe pass. */
const DEMO_STORED_AUDIO = {
  message: "Audio uploaded successfully",
  audio: {
    id: 12,
    ref: `audio/${HASH}`,
    file_hash: HASH,
    original_filename: "voice.webm",
    file_extension: ".webm",
    mime_type: "audio/webm",
    original_size: 18_324,
    duration: null,
    preview_b64: "",
    original_url: `https://cdn.demo.stapel.dev/media/cdn/audio/${HASH.slice(0, 8)}.webm`,
    render_meta: {
      ref: `audio/${HASH}`,
      kind: "audio",
      mime: "audio/webm",
      ext: ".webm",
      bytes: 18_324,
      width: null,
      height: null,
      aspect: null,
      square: false,
      animated: false,
      duration_ms: null,
      preview_b64: null,
      preview_kind: "waveform",
      poster_url: null,
      meta_status: "partial",
      meta_reason: "not_generated",
      variants: [],
    },
    refs: [],
    is_compressed: false,
    uploaded_by: "00000000-0000-0000-0000-000000000001",
    uploaded_by_username: "seller",
    created_at: "2026-09-14T10:00:00Z",
    updated_at: "2026-09-14T10:00:00Z",
  },
};

const UPLOAD_HANDLERS = {
  "file/exists/": DEMO_MISS,
  "upload/audio/": [201, DEMO_STORED_AUDIO] as const,
};

function RecorderUploading(): ReactElement {
  return (
    <CdnDemoHarness handlers={UPLOAD_HANDLERS}>
      <VoiceRecordButton
        maxMs={MAX_MS}
        onUploaded={() => {
          // `key` is audio/<hash> — a chat composer puts it on the message.
        }}
      />
    </CdnDemoHarness>
  );
}

export default defineDemo({
  id: "cdn.voice-upload",
  title: "Voice message, stored",
  description:
    "Record → store → reference, in one control. The take goes to POST /upload/audio/ named after the container the engine chose (an AAC take is .m4a, because that — not .mp4 — is what the audio allowlist spells), and onUploaded gets audio/<hash> with a length to draw: the clip's own clock until the server's ffprobe pass lands, and the result says which one it is. While the take is being stored the control is off and names the step, because a second take would abort the first upload.",
  component: VoiceRecordButton,
  tokens: ["brand", "surface-sunken"],
  variants: {
    idle: {
      description:
        "At rest it is the same control as the gesture demo's toggle; the difference is everything after the second press, which needs a microphone to reach.",
      viewport: "phone",
      step: "idle",
      render: () => <RecorderUploading />,
    },
  },
});
