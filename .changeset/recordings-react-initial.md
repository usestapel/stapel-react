---
"@stapel/recordings-react": patch
---

New pair: **`@stapel/recordings-react`** — the headless React pair for
stapel-recordings (client priority #1: ironmemo + meettoday need audio/video
recording + transcription). Generated §17-native, directly from the backend
module's OWN per-module contract (`stapel-recordings/docs/{schema,flows,errors}.json`)
rather than the unified monolith schema. Thin surface over the module's current
three endpoints (list/create, detail, finalize-upload) — it grows and
regenerates as the backend widens.

- **API layer** — typed operations over the injected `StapelClient`
  (`listRecordings`, `createRecording`, `getRecording`, `finalizeUpload`), plus
  the `uploadRecordingBlob` single-PUT helper and the `isUploadExpired` guard
  for the presigned upload session (a raw cross-origin PUT that is NOT routed
  through the client). Wire types alias a package-LOCAL generated schema
  (`src/api/generated/schema.ts` — the shared `gen-api.mjs` driver via the
  `API_OUT` knob, sourced from stapel-recordings' `docs/schema.json`), because
  stapel-recordings is not in the monolith. No documented type corrections: the
  contract enumerates no bare-`string` field values, so the generated `string`
  types stand (narrowing would be invention, not correction).
- **model** — namespaced `recordingsQueryKeys`, read hooks (`useRecordings`,
  `useRecording`) and write hooks (`useCreateRecording`, `useFinalizeUpload`)
  that invalidate the module root on success.
- **headless** — `RecordingsProvider`, `RecordingList`, `RecordingComposer`
  (create → surfaces the opened upload session), `UploadFinalizer` (render-prop
  bags, zero visual opinion), each with a `*.demo.tsx` and msw-backed tests.
- **i18n** — `RECORDINGS_I18N_KEYS` + en bundle merged over the generated
  backend error map (44 keys) so every `error.*` code has an en fallback.
  en-only: stapel-recordings ships no locale catalogs yet.
- **flows** — none (stapel-recordings annotates no `@flow_step`); the generated
  registry is correctly empty and drift-gated.
- Self-describing `manifest.json` / `llms.txt` (4 operations, 44 errors),
  drift-gated by the shared root `gen:*` drivers. Version `0.1.0` tracks
  stapel-recordings' 0.1.x minor; `backend.contract` is `>=0.1 <0.2`.
