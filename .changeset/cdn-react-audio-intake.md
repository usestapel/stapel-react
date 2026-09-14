---
"@stapel/cdn-react": minor
---

The audio intake — a recording finally has somewhere to go.

`@stapel/cdn-react` could RECORD (`useMediaRecorder`, `<VoiceRecordButton>`) and
could not store what it recorded: `CdnUploadTarget` had no `audio` arm,
`useMediaUpload` measured a voice note against the image ceiling, and the
string `upload/audio/` did not exist in the bundle. stapel-cdn 0.21.0 mounts
`POST /cdn/api/v1/upload/audio/`, so the contract pin moves 0.17.1 → 0.21.0
(the hold it sat under is answered in `contract-pins.json`: the storing module
claims what it stores, and `refs/sync/` is unreachable from a browser by
construction) and the generated client, manifest and llms.txt regenerate from
it — `upload_audio`, `Audio`, `AudioUploadResponse`, contract `>=0.21 <0.22`.

What lands, from the wire up:

- `CdnApi.uploadAudio` — `POST /upload/audio/`, multipart `file`, the same
  200/201 envelope rule as every other intake.
- `CdnUploadTarget` gains `{ kind: "audio" }`; `targetAssetType` /
  `targetFileKind` answer `audio`, the flow unwraps the `{audio}` envelope, and
  `file/exists/`'s new `type: "audio"` branch short-circuits a dedup hit the
  way the other three do. A recording is born SETTLED: there is no ladder, and
  the duration/waveform pass runs afterwards on its own clock — waiting on it
  would hold a chat message hostage to ffprobe.
- `CdnLimits.audio` — `MAX_AUDIO_SIZE` 50 MB and `ALLOWED_AUDIO_EXTENSIONS`
  (`.webm .ogg .opus .m4a .mp3 .wav .flac .aac`), read from `conf.py` at the
  pinned release, with NO MIME list because the view gates on the extension and
  a byte sniff, never on the declared Content-Type. `limitsForTarget` reads it
  for the audio target. In the same re-verification the image list catches up
  with 0.17.1 (`.avif` in, `.bmp` out) — the pair's mirror had been refusing a
  format the server accepted and offering one it refused.
- An AAC take is named `.m4a`, not `.mp4` — in `RECORDING_CANDIDATES` and in
  the nameless-blob fallback — because that is what the AUDIO allowlist spells
  it; `.mp4` is on the video list only, and a WebKit voice note under the old
  name was a 400.
- `useVoiceUpload` — a `RecordedClip` in, `audio/<hash>` out, with
  `durationMs` stated honestly: the server's measurement when the row already
  carried one, else the clip's own clock, and `measured` saying which. The clip
  is named from ITS container (`voiceFileName`), which is the extension the
  intake reads.
- `<VoiceRecordButton onUploaded>` — record → store → reference in one
  control. Two components under one switch rather than one with a conditional
  hook, so the record-only arm still needs no `<CdnProvider>`; the control is
  off while the previous take is being stored (a second take would abort the
  first upload) and names the step; a refused upload is the pair's inline error
  surface under the control, never a take silently dropped.

Tests drive the real flow over a mocked wire: the request that leaves is a
`POST` to `/upload/audio/` whose `file` part carries the recorded blob's own
MIME, the reference that comes back is `audio/<hash>`, a dedup hit of type
`audio` sends nothing, the same bytes stored as a document are NOT a hit, and
the skinned control hands `onUploaded` the reference after two presses of a
fake engine. `test/audioUpload.test.tsx`; 250 tests in the package.
