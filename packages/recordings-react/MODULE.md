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

## The create → upload → finalize surface

The recording lifecycle is three steps, split across the client so the host owns
the media transfer:

1. **create** — `useCreateRecording()` / `<RecordingComposer>` POSTs the draft
   and resolves to `{ recording, upload }`. The `upload` is a single-PUT session:
   `presigned_url`, `max_size_bytes`, `expires_at`.
2. **upload** — the host PUTs the media blob directly at `upload.presigned_url`.
   This is a raw cross-origin PUT to the object store (no `stapel_jwt` cookie, no
   JSON envelope), so it is NOT a client operation; `uploadRecordingBlob(upload,
   blob, { contentType })` in `api/extensions.ts` does it (guarding
   `max_size_bytes` up front) and `isUploadExpired(upload)` gates a stale session.
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

en-only. stapel-recordings ships no `translations/errors.<lang>.json` catalogs
yet, so `gen:errors` emits no per-locale bundle. Add a `./i18n/<locale>` subpath
(following the notifications-react etalon) once the backend ships a catalog.
