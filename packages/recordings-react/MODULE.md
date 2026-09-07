# @stapel/recordings-react — module guide

Headless React flow pair for **stapel-recordings**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createRecordingsApi(client)` with one typed method per endpoint
  (`listRecordings`, `createRecording`, `getRecording`, `finalizeUpload`).
  **§17-native contract:** stapel-recordings is not in the unified monolith
  schema — it emits its OWN `docs/schema.json`, so this pair generates a
  package-LOCAL `src/api/generated/schema.ts` (shared `gen-api.mjs` via
  `API_OUT`) and `api/types.ts` aliases *that*, not core's shared `components`.
  Un-generatable surface — the `uploadRecordingBlob` single-PUT helper and the
  `isUploadExpired` guard for the presigned upload session — lives in
  `api/extensions.ts`. No documented type corrections: the contract enumerates
  no bare-`string` field values (`status`, `source_type` are opaque, and no
  error names a state), so the generated `string` types stand.
- **model/** — `recordingsQueryKeys` (single key factory, `["recordings"]`
  namespace), `createRecordingsRuntime`, React context/hooks. Read hooks
  (`useRecordings`, `useRecording`) and write hooks (`useCreateRecording`,
  `useFinalizeUpload`) — every write invalidates the module root
  (`recordingsQueryKeys.all`) on success, since a create lands in the list and a
  finalize flips a recording's status and (eventually) fills its transcription
  outputs.
- **flows/** — `createFlowMachine`-based machines (primitive imported from
  `@stapel/core`), bound to the generated `RECORDINGS_FLOWS` registry.
  stapel-recordings annotates no `@flow_step` yet, so the registry is empty
  (correctly); scaffold machines from flows.json once it does, and keep them
  under `gen:flows:check`.
- **headless/** — render-prop components; `<RecordingsProvider>` wires the
  runtime into context; `<RecordingList>`, `<RecordingComposer>`,
  `<UploadFinalizer>` expose the read / create / finalize surface as renderless
  bags. shadcn-copyable (frontend-standard §7).
- **i18n/** — `RECORDINGS_I18N_KEYS` + en bundle; the generated backend error
  bundle is merged in so every `error.*` code has a fallback.
- **analytics/** — `generated/events.json`, the typed-event registry projected
  from `defineEvent` call sites + flow funnels (`pnpm gen:events`). Read by the
  analytics lint and embedded into `manifest.json`; nothing to hand-edit.
- **demo/** — first-class demos (`defineDemo`, `@stapel/showcase`): `_harness.tsx`
  wires a mock runtime + i18n + query client; each `<Name>.demo.tsx` is compiled,
  product-linted, smoke-rendered, and projected to a Ladle story (`pnpm gen:demos`).
  The completeness gate requires ≥1 demo per exported headless component:
  `Recordings.demo.tsx` covers `RecordingsProvider`, and `RecordingList` /
  `RecordingComposer` / `UploadFinalizer` each have their own. Demos never ship.

## Audio, not a container (backend 0.22.0)

stapel-recordings is an audio service, not a video host. An upload of any
supported container is **transport**: the pipeline extracts its audio track,
downmixes it to mono at the deployment's `stored_audio_*` profile, keeps that,
and deletes the container. Nothing in the contract hands the container back, so
this pair has no video element, no "download the original" affordance and no
type that implies one — `MediaUrl` always points at audio.

Two consequences the pair carries:

- **two ceilings, not one.** `max_upload_bytes` is what a deployment will
  ACCEPT (the `error.413.recording_too_large` line); `max_stored_bytes` is what
  it will KEEP. They differ by orders of magnitude, and a host that gates on the
  wrong one refuses uploads the backend wanted. `useUploadLimits()` reads both,
  plus the audio profile, `stored_bytes_per_hour` (what an hour costs),
  the multipart bounds and the extension allowlist — see below.
- **a `409` on the media read can mean "not yet".** Until the convert stage has
  run there is no stored object to sign, so a mid-pipeline recording answers
  `error.409.recording_media_not_stored` on its way to being playable.
  `RecordingMediaBag.isConverting` (and `SharedMediaBag.isConverting`) tells
  that apart from a recording that genuinely has nothing, by the recording's own
  status; the skin renders a wait, not an error box.

## The create → upload → finalize surface

The recording lifecycle is three steps, split across the client so the host owns
the media transfer — with one read before all of them:

0. **the ceilings, before the picker** — `useUploadLimits()` /
   `api.getUploadLimits()` reads `GET /recordings/upload-limits`. A host builds
   its file input's `accept` from `uploadAccept(limits)`, refuses an oversized or
   unlisted file locally with `uploadGate({ …, limits })`, and can say what an
   hour of recording costs with `storedBytesForHours(limits, hours)`. Without it
   the gate falls back to a MIME-prefix guess and lets the backend be the
   authority — a pair that has not read the limits invents no refusal.
1. **create** — `useCreateRecording()` / `<RecordingComposer>` POSTs the draft
   and resolves to `{ recording, upload }`. The `upload` is a single-PUT session:
   `presigned_url`, `max_size_bytes`, `expires_at`.
2. **upload** — the host PUTs the media blob directly at `upload.presigned_url`.
   This is a raw cross-origin PUT to the object store (no `stapel_jwt` cookie, no
   JSON envelope), so it is NOT a client operation; `uploadRecordingBlob(upload,
   blob, { contentType })` in `api/extensions.ts` does it (guarding
   `max_size_bytes` up front) and `isUploadExpired(upload)` gates a stale session.
   A `too_large` refusal carries `sizeBytes`/`limitBytes` (read them with
   `uploadPreflightBytes(error)`) so the sentence names the real numbers.
3. **finalize** — `useFinalizeUpload()` / `<UploadFinalizer>` POSTs
   `/{id}/finalize` (optionally with `file_size_bytes`) to enqueue the
   transcription pipeline; a finalize on a recording not awaiting it fails
   `error.400.recording_invalid_state`.

This is a thin surface over the module's current three endpoints — it grows and
regenerates as the backend widens (e.g. per-recording transcript reads, delete).

## Extension seams (frontend-standard §7)

- Client is injected via `<RecordingsProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client. stapel-recordings
  authenticates via the `stapel_jwt` cookie, so a cross-origin browser host
  builds its runtime with `credentials: "include"`.
- The headless layer is fully replaceable (copy-and-own).

## Machines

None yet — stapel-recordings annotates no `@flow_step`, so the pair ships no flow
machines and `RECORDINGS_FLOWS` is empty. When the backend adds flow annotations,
scaffold `create<X>Flow(deps)` machines from `flows.json`, bind each `id` to the
`RECORDINGS_FLOWS` registry, and keep them under `gen:flows:check`.

## Localization

en + ru + es. The UI keys are authored in `src/i18n/{keys,ru,es}.ts` and shipped
on the `@stapel/recordings-react/i18n/{ru,es}` subpaths (opt-in, kept out of the
main bundle by size-limit and the bundle-purity test). Every `error.*` string is
GENERATED: stapel-recordings ships `translations/errors.{ru,es}.json` for its own
codes and stapel-core covers the cross-cutting ones, so nothing here re-authors a
backend key. Locale parity is a lint anchored on `keys.ts` and a test.
