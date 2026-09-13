---
"@stapel/chat-react": minor
---

Attachments: the contract stapel-chat has been sending for five minors finally
has a reader.

Contract `>=0.8 <0.9` -> `>=0.9 <0.10` (pin bumped to stapel-chat v0.9.1).

**Read.** `MessageResponse.attachments[]` is decoded and drawn by MEDIUM, and the
medium is the registry `type` — which is the CDN's own kind name, one vocabulary
by construction since 0.9.0 — never a sniff of the mime or the extension. Four
arms: image/gif through `@stapel/image` over the ladder with `preview_b64` as the
blur placeholder and a lightbox on tap; video as the CDN's poster plus a native
player at `preload="none"`, so a thread with six clips does not pull six videos to
draw six stills; audio as the rendered waveform (which for a voice message IS the
render), one play control and the length; file as its extension, name and size.
An unknown type is drawn as a document rather than dropped — the registry is OPEN
and a thread that silently lost a sticker would be lying about what was said —
and one unresolvable ref costs the message nothing, `meta_status` / `meta_reason`
saying which of "still generating" and "this deployment has no ffmpeg" it is.

**No layout jump, which is the whole claim.** Every box is reserved before
anything loads: the measured `aspect`, then `width/height`, then the shape
`preview_kind` implies — known from `type` alone, so known while the preview is
still null — and then deliberately NOTHING for a still with no geometry, because a
photograph can be any shape and a guessed box has to jump twice.

**No describe request, ever.** stapel-chat resolves every key through one
`cdn.describe_many` inside the query that fetched the page, so descriptors arrive
WITH the thread; a bubble that asked per attachment would undo that batch. The
socket path needs no N+1 either: it carries raw stored descriptors rather than
rendered ones, and `flows/freshness.ts` already collapses a burst of frames into
ONE refetch of the window.

**Write.** `useSendMessage` sends `attachments: [{key, type}]`. `useAttachmentDraft`
is the pending list — per-file step, abort handles and object URLs kept out of
state, remove and retry — and it takes the upload as a SEAM rather than an import,
so the headless entry pulls no other pair's client into a bundle that only wanted
to read a thread. `/default` supplies `useCdnAttachmentUpload()` over
`@stapel/cdn-react` (both it and `@stapel/image` are OPTIONAL peers, reached only
from the opt-in subpath). A composer with no seam reports `attachments: null` and
draws NO control, because a paperclip over a picker whose files can never be
stored is the "visible but does nothing" shape this pair refused attachments over
in the first place. An attachment IS a message: an empty box with a stored photo
may be sent, which is the server's own shape for one.

**Inbox.** A wordless row carries a mark before its sentence instead of the bare
word "Attachment". One mark and not one per type, because `LastMessageResponse`
deliberately carries no attachments — recorded upstream rather than guessed at.

NOT in this release: a voice control. `@stapel/cdn-react` records a webm/opus clip
today, and stapel-cdn has the entire audio write side — the `Audio` model, the
storage, the `post_save` that queues the waveform, `audio/<hash>` refs, the
describe branch, `ALLOWED_AUDIO_EXTENSIONS`, `MAX_AUDIO_SIZE` — and **no HTTP
intake**, so nothing in the fleet can turn that Blob into the key the `audio`
attachment type needs. Routing it through `POST /upload/file/` was refused: it is
a 400 today, and a deployment that widened the allowlist to make it pass would get
a `file/<hash>` ref with no waveform and no duration ever. One line in
`ComposeAttachments.tsx` when the intake lands; `useCdnAttachmentUpload` already
refuses the type by name so an early wiring learns which seam is missing.

452 tests (was 425).
