---
"@stapel/cdn-react": minor
---

A microphone, and one file in / one CDN key out.

`useMediaUpload` is the general single-pick hook the rest of the fleet needed and
did not have: `useUploadImage` is the avatar slot and narrows its bag to an image
row, `useUploadQueue` is the gallery, and neither is what a chat composer wants —
one control over four intakes, handing back the opaque `<type>/<hash>` key AND the
render snapshot that came back inline on the upload response, so the caller never
spends a `describe` round trip on a reference it just created. It takes a `Blob`
as well as a `File` and names an unnamed one from its own MIME, because the
intake gate is written over `File.name` and a `MediaRecorder` produces neither a
name nor an extension.

`useMediaRecorder` is the capture, and it gets right the four things a naive
version does not. The microphone is RELEASED — `MediaRecorder.stop()` does not
stop the tracks, so the recording indicator stays lit until every one of them is
stopped explicitly, and cancel, unmount and stop all go through one teardown.
`stop()` resolves WITH the bytes — the last chunk arrives after `stop()` returns
(`dataavailable`, then `stop`), so a caller that read the buffer synchronously
would get a truncated clip. A refusal is a STATE and not an exception — six
named reasons with four different next actions, because "open the https page",
"use another browser", "allow the microphone" and "plug one in" are not one grey
button. And the level meter is real or it is absent: where the page has no
`AudioContext` the bag says `levelAvailable: false` rather than animating a
number nobody measured, which is the same rule this pair's upload flow already
applies to the byte-percentage it refuses to invent.

The container is CHOSEN rather than assumed — Opus in webm or ogg, AAC in mp4 on
WebKit, asked of the engine's own `isTypeSupported` — because that string decides
the file extension and the extension is what the CDN's allowlist reads. The clip
carries a wall-clock `durationMs` and says so: the authoritative duration is the
one ffprobe reports on the stored asset.

`<VoiceRecordButton/>` is the default surface. `toggle` is the interaction that
works with no pointer at all; `hold` is the phone idiom layered ON TOP of it, so a
keyboard activation still toggles — a hold-only control is a record button no
keyboard can press. Four notices below it, not one: the gesture hint, the
refusal, a take that produced no bytes, and a take that ended at the ceiling.

233 tests (was 214).
