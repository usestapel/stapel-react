---
"@stapel/recordings-react": minor
---

recordings: the module is an audio service, and the pair now says so

Regenerated against stapel-recordings 0.22.0, where an upload became transport
rather than an artifact: the pipeline extracts the audio track, downmixes it to
mono at the deployment's profile, keeps that, and deletes the container. Nothing
in the contract hands the container back, so the pair carries no video element,
no "download the original" and no type that implies one.

- **`useUploadLimits()`** — the typed read behind the new
  `GET /recordings/api/v1/recordings/upload-limits`, and the point of the
  release: a host calls it BEFORE its file picker and gets
  `max_upload_bytes` (what is ACCEPTED — the `413` line) and `max_stored_bytes`
  (what is KEPT), the `audio_only_ingest` flag and the `stored_audio_*` profile,
  `stored_bytes_per_hour` (what an hour of speech costs), the multipart part
  size and cap, and the extension allowlist. `UploadLimits` is the wire type,
  `recordingsQueryKeys.uploadLimits()` its key.
- `uploadAccept(limits)` builds a file input's `accept` from the deployment's
  own allowlist (falling back to the media prefixes, never to nothing);
  `isAllowedUploadName(name, limits)` and `storedBytesForHours(limits, hours)`
  are the two other reads a picker needs. `uploadGate({ …, limits })` now
  refuses an oversized or unlisted file locally, before a session is opened —
  and invents no refusal while the limits have not landed.
- A `too_large` preflight carries the two numbers (`uploadPreflightBytes(error)`),
  so the refusal is phrased in the deployment's real ceiling instead of "too big".
- **A `409` on the media read can mean "not yet".** Until the convert stage has
  run there is no stored object to sign, so a mid-pipeline recording answers
  `error.409.recording_media_not_stored` on its way to being playable.
  `RecordingMediaBag.isConverting` / `SharedMediaBag.isConverting` tell that
  apart from a recording that genuinely has nothing, and the player and the
  share surface render a wait instead of "this recording has no media file".
- New error keys in en, ru and es: `error.400.recording_upload_size_invalid`,
  `error.400.recording_multipart_parts_invalid`, and
  `error.413.recording_too_large` gaining `{size}` and `{limit}`.

Contract pin moved to stapel-recordings v0.22.0; `manifest.json` declares
`>=0.22 <0.23`.
