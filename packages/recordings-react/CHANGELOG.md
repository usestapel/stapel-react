# @stapel/recordings-react

## 0.3.1

### Patch Changes

- ae57230: v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
  flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
  gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
  `baseUrl` examples and the auth QR same-origin guard now use
  `/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
  literals carry the new version segment. Mount your runtimes at
  `/<mod>/api/v1/`.

## 0.3.0

### Minor Changes

- ca3ba45: Track stapel-recordings 0.2.x (scheme B — the pair's minor follows the backend
  minor). Regenerated from the `v0.2.1` contract and surfaced the workspace list
  filter:

  - **`useRecordings(params?)`** now accepts an optional `RecordingListParams`
    (`{ workspaceId }`). With no params it lists the caller's own recordings; with
    `workspaceId` it lists every recording in a workspace the caller is a member
    of (a non-member read fails `error.403.recording_workspace_forbidden`). Backed
    by `RecordingsApi.listRecordings(params?)` sending `?workspace_id=`, and the
    list query key now carries its params so own vs per-workspace views cache
    distinctly. `<RecordingList>` gained a matching optional `workspaceId` prop.

  The regenerated schema also carries the new `resource_key` field on a recording
  and the optional `filename` on an upload session. `source_type` stays an opaque
  `string` — the new `SOURCE_TYPES` backend merge-registry is deploy-configurable,
  so the client does not narrow it. Two new error codes are mapped
  (`recording_workspace_forbidden` 403, `recording_unsupported_media` 415).
  `backend.contract` is now `>=0.2 <0.3`.

- b1b327e: Track stapel-recordings 0.3.x (scheme B — the pair's minor follows the backend
  minor; contract pin bumped to the `0.3.1` HEAD). Regenerated from the updated
  contract, which adds:

  - **`POST /recordings/{id}/reprocess`** — re-runs the whole pipeline for a
    `completed` recording (`pipeline.reprocess_recording`; any other status is a
    no-op `error.409.recording_invalid_state`). Not yet wired to a hook/method in
    this pair (follow-up); the generated schema/error map carry it.
  - **`?resource_key=`** on the recordings list — narrows to the single recording
    an opaque resource key references (a missing/forged key yields an empty
    list). Additive to `RecordingListParams`'s existing `workspaceId` filter, not
    yet exposed as a typed param (follow-up).

  Both are additive to the wire contract — no existing type or hook signature
  changed. `backend.contract` is now `>=0.3 <0.4`.

### Patch Changes

- 4e6f442: Internal plumbing swap (slim wave §21/S2) — the pair's stamped
  `model/runtime.ts` / `model/context.tsx` / `headless/<Mod>Provider.tsx`
  boilerplate (byte-identical across the six standard pairs) now binds
  `@stapel/core`'s `createModuleRuntime` / `createModuleContext` factories
  instead of carrying its own copy. Public API preserved exactly: same exported
  names and signatures (`create<Mod>Runtime`, `<Mod>Runtime`,
  `Create<Mod>RuntimeOptions`, `<Mod>RuntimeContext`, `use<Mod>Runtime`,
  `use<Mod>Api`, `use<Mod>Analytics`, `<Mod>Provider>`), same guard-hook error
  messages. No behavior change.
- c3482e7: README wave (slim wave §21/S4): every pair now documents its setup — a new
  Install + "Wire the app once" section built on core's `<StapelProvider>`
  (previously only auth-react's README showed any wiring, as a 5-level provider
  nest). auth-react's wiring example moves to the one-provider shape with the
  `queryRuntime`/`i18n` escape hatches spelled out.
- d3232a9: Zero-flow scaffolding removed (slim wave §21/S3). These six backends annotate
  no `@flow_step`, so `gen:flows` now skips emission for them and the pair's
  `src/flows/generated/` files are gone. The public flow surface is preserved
  exactly by a tiny hand-written shim (`src/flows/registry.ts`): `<MOD>_FLOWS`
  (still `{}`), `<Mod>FlowId`/`<Mod>FlowSpec` (still `never`), `FlowEndpoint`,
  and `flowEndpoints` keep their names, types, and behavior. `toFlowError` and
  the core flow-machine re-exports are untouched. No public-surface delta; the
  generated registry returns automatically once the backend documents its first
  flow.
- 48f8ce2: New pair: **`@stapel/recordings-react`** — the headless React pair for
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

## 0.1.0

### Minor Changes

- New pair: **`@stapel/recordings-react`** — the headless React pair for
  stapel-recordings (client priority #1: ironmemo + meettoday need audio/video
  recording + transcription). Generated §17-native, directly from the backend
  module's OWN per-module contract
  (`stapel-recordings/docs/{schema,flows,errors}.json`) rather than the unified
  monolith schema. Thin surface over the module's current three endpoints
  (list/create, detail, finalize-upload) — it grows and regenerates as the
  backend widens.

  - **API layer** — typed operations over the injected `StapelClient`
    (`listRecordings`, `createRecording`, `getRecording`, `finalizeUpload`),
    plus the `uploadRecordingBlob` single-PUT helper and the `isUploadExpired`
    guard for the presigned upload session (a raw cross-origin PUT that is NOT
    routed through the client). Wire types alias a package-LOCAL generated
    schema (`src/api/generated/schema.ts` — the shared `gen-api.mjs` driver via
    the `API_OUT` knob, sourced from stapel-recordings' `docs/schema.json`),
    because stapel-recordings is not in the monolith. No documented type
    corrections: the contract enumerates no bare-`string` field values, so the
    generated `string` types stand.
  - **model** — namespaced `recordingsQueryKeys`, read hooks (`useRecordings`,
    `useRecording`) and write hooks (`useCreateRecording`, `useFinalizeUpload`)
    that invalidate the module root on success.
  - **headless** — `RecordingsProvider`, `RecordingList`, `RecordingComposer`
    (create → surfaces the opened upload session), `UploadFinalizer`
    (render-prop bags, zero visual opinion), each with a `*.demo.tsx` and
    msw-backed tests.
  - **i18n** — `RECORDINGS_I18N_KEYS` + en bundle merged over the generated
    backend error map (44 keys). en-only: stapel-recordings ships no locale
    catalogs yet.
  - **flows** — none (no `@flow_step` on the backend); the generated registry is
    correctly empty and drift-gated.
  - Self-describing `manifest.json` / `llms.txt` (4 operations, 44 errors).
    Version `0.1.0` tracks stapel-recordings' 0.1.x minor; `backend.contract` is
    `>=0.1 <0.2`.
