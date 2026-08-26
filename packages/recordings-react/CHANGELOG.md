# @stapel/recordings-react

## 0.6.2

### Patch Changes

- 5c4c17e: Nav manifest: `recordings.detail` mounts at `:recordingId` relative to its parent (was `recordings/:recordingId`, which composed to an unreachable `recordings/recordings/:recordingId`).

## 0.6.1

### Patch Changes

- f952306: Visual pass VISUAL3: the player actually plays, both brand blues become one, the
  detail pane stops reporting a locale code and a model id, and five legacy
  chip-dump stories are deleted.

  **The five console errors, and the player frozen at `0:00 / 0:00`.** The demo's
  minted media URL pointed at `store.demo.stapel.dev`, a host that does not exist:
  every shot of the player, the shared playback and the public share page recorded
  `net::ERR_CONNECTION_CLOSED` and photographed a dead transport under a heading
  saying the recording ran half an hour. The showcase has no CDN and must render
  under a strict CSP, so the demo now carries its own audio — a silent WAV
  generated from a formula (8 kHz 8-bit mono, so the repository holds the formula
  and not a megabyte of base64) whose length IS the duration the fixture reports.
  The transport and the metadata can no longer disagree.

  **N-8 — two brand blues inside one package.** `ShareUnlockGate` and
  `PaymentRequiredNotice` were the two surfaces that never mounted `SkinTheme`.
  Both are surfaces with no owner chrome above them — an anonymous share link, a
  notice a host drops onto a page of its own — so they fell through to antd's
  stock accent, and the one primary button on the link a customer is sent was a
  different blue from the rest of the product. Both are themed now; no colour is
  named anywhere in this package.

  **M-2 — a locale code and a model id printed as metadata.** `Language: en` goes
  through a new `format.language` (`Intl.DisplayNames`, same family as every other
  formatter in `model/format.ts`), so it reads "English" — or the reader's word
  for it. `Transcribed by: whisper-large-v3` is an operator's fact from a
  vocabulary that changes with the deployment's pipeline, so it keeps its place
  but takes the register `cdn-react` gives a `meta_reason`: muted, monospaced,
  where an eye skips it and a support agent finds it.

  **A recording still being transcribed now says so from the first frame.** The
  transcript pane rendered a skeleton while the read was in flight — a promise of
  text that is not on its way, since the pipeline has not written any. It renders
  the pending sentence instead, which is also what makes the state photographable:
  `recordings.transcript-skin`'s two variants were byte-identical until this.

  **N-4.** `recordings.provider`, `recordings.list`, `recordings.composer` and
  `recordings.finalize` — four `state.step` chip dumps of the old harness — are
  deleted. `recordings.list-skin` and `recordings.uploader-skin` are the same
  components with the shipped skin on them and carry the coverage, so the gate
  holds at 11 headless / 13-of-13 skin.

  `test/demos.test.tsx` now runs `assertVariantsRenderDistinctly` against a jsdom
  renderer. It caught the transcript pane on its first run.

## 0.6.0

### Minor Changes

- 80617e9: Ship the product half: a default skin, playback, the owner's transcript, the metered verbs, and the public share page.

  The pair consumed 4 of 10 backend operations and rendered none of them — the intake half (`create → upload → finalize`) with no `src/default/` at all, fifteen minors behind stapel-recordings. It now speaks the whole 0.20.0 contract and ships the screens.

  **Contract.** Regenerated against stapel-recordings 0.20.0 (`backend.contract` `>=0.4 <0.5` → `>=0.20 <0.21`). Six previously unconsumed endpoints are wired: `GET …/{id}/media`, the new owner-facing `GET …/{id}/transcript` (anchor pagination over `sequence_num`), `POST …/{id}/resummarize`, `POST …/{id}/reprocess`, and all three `/shares/{token}` operations. The error bundle went from 6 module codes to 17 — the eleven missing ones, including `error.402.recording_payment_required`, rendered as raw keys.

  **Polling, from the payload.** Two hooks documented themselves as polling and set no interval, so a recording sat on `transcribing` until someone reloaded. `RecordingDTO.is_processing` / `poll_after_seconds` now drive `refetchInterval`, and the field's ABSENCE stops the loop — a client polling a failed recording forever is what the shape exists to prevent. Media URLs re-mint at 80 % of `expires_in` so a player does not die mid-listen.

  **`./default` (new subpath, `antd` + `@stapel/tokens-antd` peers).** Thirteen components: the recordings screen, the recording screen (player + speaker-attributed transcript synced two ways to playback + summary), the `create → upload → finalize` uploader with byte progress, the status chip over the eleven REAL `RecordingStatus` values, the two metered actions with their refusals named, the 402 top-up prompt, and the anonymous share page with its passcode gate. No local `theme.tsx`, no local `ErrorAlert` — both come from `@stapel/tokens-antd/skin`.

  **i18n en + ru + es** on `./i18n/{ru,es}` subpaths (the pair was English-only, 14 keys; it is now 120+ keys in three locales). Dates, durations, counts and byte sizes go through locale formatters instead of raw ISO/enum text.

  Breaking (pre-1.0 = minor): `uploadRecordingBlob` now throws on a non-2xx (`StapelApiError`, core's one dialect) instead of resolving the raw `Response`, and its local size guard throws `UploadPreflightError` with a `reason` rather than a bare `RangeError` — a caller has to tell "over the ceiling" from "the session window closed" to say the right sentence.

## 0.5.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.5.0

### Minor Changes

- 400f9e6: The pair the 2026-08-09 incident happened in.

  `WorkspaceSelection` — the surface products actually consume — gains
  `state: LoadState<readonly Workspace[]>` and LOSES `workspaces` and `loading`.
  It previously had no error field at all, so a host saw `loading: false`,
  `workspaces: []`, `current: null` for a 404 and could not tell that apart from
  a person who belongs to no workspace. `current` stays, documented as null in
  three different situations, which is why a screen must branch on `state`.

  `WorkspaceListBag`, `MembersBag`, `RoleSelectBag` and `useCapabilities` take
  the same cutover: one `state`, no flattened array, no `isLoading`/`isError`
  read fields. `MembersBag` splits the read failure from `writeError` (an
  invite/role/removal that failed is a different sentence). `CanBag` gains
  `isUnknown` — deny-by-default still holds on a failed capability read, but a
  skin can now say which of the two it is. `RecordingListBag` gains `state` and
  loses `recordings`/`isLoading`/`isError`/`error`.

  `<MembersManager/>` renders the roster through `matchList`, so a failed read no
  longer produces an error banner AND antd's built-in "No data" illustration at
  the same time; the role registry gets its own sentence rather than silently
  yielding an empty picker. `<WorkspaceSettings/>` no longer greys out the name
  field and Save with no explanation: `useActionGate` + `firstBlock` state
  either "only the owner can change these settings" or "enter a workspace name"
  as visible text.

  New keys (en + ru): `workspaces.list.load_failed`,
  `workspaces.members.load_failed`, `workspaces.members.empty`,
  `workspaces.roles.load_failed`, `workspaces.retry`,
  `workspaces.settings.blocked.not_owner`,
  `workspaces.settings.blocked.name_required`,
  `recordings.list.load_failed`, `recordings.retry`.

## 0.4.0

### Minor Changes

- 6ef6c44: Gate top-level "the caller's own …" query hooks on `@stapel/core`'s new
  `useActiveSessionReady()` (owner-diagnosed live incident, 2026-07-17): a hook
  with no natural `enabled` condition of its own (`useWorkspaces`, `useWallet`,
  `useTransactions`, `useSubscription`, `useNotificationFeed`/
  `useInfiniteNotificationFeed`, `useCalendar`/`useEvents`/`useAvailability`,
  `useRecordings`) fires the instant a component mounts — which used to race a
  session still bootstrapping and read a live one as "expired". Detail hooks
  keyed by an id (`useWorkspace`/`useMembers`/`useEvent`/`useRecording`) now
  ALSO gate on session readiness in addition to their existing non-empty-id
  check, since an id can be known synchronously (e.g. a URL param) before the
  session settles.

  Deliberately NOT gated: `useCatalog` (billing) and `useLanguages` (profiles,
  unaffected by this changeset but worth noting for symmetry) — both are
  public reference lists a signed-out visitor legitimately needs.

  Zero manual wiring at any call site: `useActiveSessionReady()` reads
  whichever `SessionManager` a session-owning module (e.g.
  `@stapel/auth-react`'s `createAuthRuntime`) registered as "active", and
  defaults to `true` (never blocks) when no such module exists in the host at
  all.

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
