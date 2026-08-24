---
"@stapel/recordings-react": minor
---

Ship the product half: a default skin, playback, the owner's transcript, the metered verbs, and the public share page.

The pair consumed 4 of 10 backend operations and rendered none of them — the intake half (`create → upload → finalize`) with no `src/default/` at all, fifteen minors behind stapel-recordings. It now speaks the whole 0.20.0 contract and ships the screens.

**Contract.** Regenerated against stapel-recordings 0.20.0 (`backend.contract` `>=0.4 <0.5` → `>=0.20 <0.21`). Six previously unconsumed endpoints are wired: `GET …/{id}/media`, the new owner-facing `GET …/{id}/transcript` (anchor pagination over `sequence_num`), `POST …/{id}/resummarize`, `POST …/{id}/reprocess`, and all three `/shares/{token}` operations. The error bundle went from 6 module codes to 17 — the eleven missing ones, including `error.402.recording_payment_required`, rendered as raw keys.

**Polling, from the payload.** Two hooks documented themselves as polling and set no interval, so a recording sat on `transcribing` until someone reloaded. `RecordingDTO.is_processing` / `poll_after_seconds` now drive `refetchInterval`, and the field's ABSENCE stops the loop — a client polling a failed recording forever is what the shape exists to prevent. Media URLs re-mint at 80 % of `expires_in` so a player does not die mid-listen.

**`./default` (new subpath, `antd` + `@stapel/tokens-antd` peers).** Thirteen components: the recordings screen, the recording screen (player + speaker-attributed transcript synced two ways to playback + summary), the `create → upload → finalize` uploader with byte progress, the status chip over the eleven REAL `RecordingStatus` values, the two metered actions with their refusals named, the 402 top-up prompt, and the anonymous share page with its passcode gate. No local `theme.tsx`, no local `ErrorAlert` — both come from `@stapel/tokens-antd/skin`.

**i18n en + ru + es** on `./i18n/{ru,es}` subpaths (the pair was English-only, 14 keys; it is now 120+ keys in three locales). Dates, durations, counts and byte sizes go through locale formatters instead of raw ISO/enum text.

Breaking (pre-1.0 = minor): `uploadRecordingBlob` now throws on a non-2xx (`StapelApiError`, core's one dialect) instead of resolving the raw `Response`, and its local size guard throws `UploadPreflightError` with a `reason` rather than a bare `RangeError` — a caller has to tell "over the ceiling" from "the session window closed" to say the right sentence.
