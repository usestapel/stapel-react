---
"@stapel/chat-react": minor
---

Voice messages — the audio hole is closed, both ways.

`ComposeAttachments.tsx` used to carry a header titled "the audio hole": the
recorder existed (`@stapel/cdn-react`'s `useMediaRecorder`), stapel-cdn had no
audio intake, and so this pair shipped no voice control rather than one that
refused, with `STORABLE_ATTACHMENT_TYPES` saying so. stapel-cdn 0.21.0 mounts
`POST /upload/audio/` and `@stapel/cdn-react` 0.6.0 reaches it, so the peer
floor moves to `>=0.6.0` and the map gains its one line — `audio` is stored.

**Compose.** `<VoiceAttachButton>` is cdn-react's `<VoiceRecordButton>` with
its take wrapped as a `File` named from the container the engine chose (the
extension the audio intake reads) and handed to the draft as an `audio`
attachment — `draft.add` with `{type: "audio"}`, the option
`useAttachmentDraft` has carried since 0.19.0. From there it is a chip like
any other: the step named while it goes, remove and retry, the send blocked
until it is stored, `{key, type: "audio"}` on the wire. The chip says «Voice
message» rather than the timestamped filename it is stored under. Nothing in
the headless entry moved; a host that wired `upload={useCdnAttachmentUpload()}`
for photos has wired voice too.

The control is behind `<ConversationThreadPanel voice>` (and
`<ConversationSplitPanel voice>`, forwarded) — `true` for the defaults, or
`{maxMs, interaction: "hold"}` — because a microphone in a thread is a
product decision, not a consequence of being able to attach a file. It draws
nothing without `upload`, for the reason the pickers draw nothing.

**Read.** The voice arm of `<MessageAttachments>` is a player now: a row whose
height is reserved (`VOICE_ROW_MIN_HEIGHT_PX`) before the strip, the length or
the playhead arrives; play/pause as one control with `aria-pressed`; a playhead
drawn over the CDN's waveform from the element's own `timeupdate`, with the
server's measured length as its denominator — or the element's decoded one for
a clip nobody measured, so the «not measured» sentence stays until the clip
actually plays; and the elapsed clock beside the total while it plays. One new
key, `chat.attachment.progress`, in en/ru/es.

**Inbox.** The row's glyph for a voice note was already there — one mark per
type from stapel-chat 0.10.0's `attachment_types`, since 0.20.0 — so nothing
moves; `test/inboxAttachmentMarks.test.tsx` keeps pinning the microphone mark.

Tests (`test/voiceMessage.test.tsx`, 12) drive both ends over a mocked wire:
`useCdnAttachmentUpload` routes an `audio` attachment to `POST /upload/audio/`
with the recorded blob's own MIME and hands back `audio/<hash>`; two presses of
a fake engine put an `audio` chip on the draft and, through the REAL uploader,
an `audio/<hash>` on the message that leaves; the bubble's playhead follows
`timeupdate` against the measured length and falls back to the decoded one;
the microphone is drawn only behind `voice`, and only with `upload`. 481 tests
in the package.
